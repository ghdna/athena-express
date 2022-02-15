"use strict";
//helpers.js

const readline = require("readline"),
    csv = require("csvtojson");

let s3Metadata = null;

function startQueryExecution(config) {
    const params = {
        QueryString: config.sql,
        WorkGroup: config.workgroup,
        ResultConfiguration: {
            OutputLocation: config.s3Bucket,
        },
        QueryExecutionContext: {
            Database: config.db,
            Catalog: config.catalog,
        },
    };
    if (config.encryption)
        params.ResultConfiguration.EncryptionConfiguration = config.encryption;

    return new Promise(function (resolve, reject) {
        const startQueryExecutionRecursively = async function () {
            try {
                let data = await config.athena
                    .startQueryExecution(params)
                    .promise();
                resolve(data.QueryExecutionId);
            } catch (err) {
                isCommonAthenaError(err.code)
                    ? setTimeout(() => {
                          startQueryExecutionRecursively();
                      }, 2000)
                    : reject(err);
            }
        };
        startQueryExecutionRecursively();
    });
}

function checkIfExecutionCompleted(config) {
    let retry = config.retry;
    return new Promise(function (resolve, reject) {
        const keepCheckingRecursively = async function () {
            try {
                let data = await config.athena
                    .getQueryExecution({
                        QueryExecutionId: config.QueryExecutionId,
                    })
                    .promise();
                if (data.QueryExecution.Status.State === "SUCCEEDED") {
                    retry = config.retry;
                    s3Metadata = config.athena
                        .getQueryResults({
                            QueryExecutionId: config.QueryExecutionId,
                            MaxResults: 1,
                        })
                        .promise();
                    resolve(data);
                } else if (data.QueryExecution.Status.State === "FAILED") {
                    reject(data.QueryExecution.Status.StateChangeReason);
                } else {
                    setTimeout(() => {
                        keepCheckingRecursively();
                    }, retry);
                }
            } catch (err) {
                if (isCommonAthenaError(err.code)) {
                    retry = 2000;
                    setTimeout(() => {
                        keepCheckingRecursively();
                    }, retry);
                } else reject(err);
            }
        };
        keepCheckingRecursively();
    });
}

async function getQueryResultsFromS3(params) {
    const s3Params = {
        Bucket: params.s3Output.split("/")[2],
        Key: params.s3Output.split("/").slice(3).join("/"),
    };

    if (params.statementType === "UTILITY" || params.statementType === "DDL") {
        const input = params.config.s3.getObject(s3Params).createReadStream();
        return { items: await cleanUpNonDML(input) };
        
    } else if (Boolean(params.config.pagination)) {
        //user wants DML response paginated

        const paginationFactor = Boolean(params.config.NextToken) ? 0 : 1

        let paginationParams = {
            QueryExecutionId: params.config.QueryExecutionId,
            MaxResults: params.config.pagination + paginationFactor,
            NextToken: params.config.NextToken,
        };

        const queryResults = await params.config.athena
            .getQueryResults(paginationParams)
            .promise();
        if (params.config.formatJson) {
            return {
                items: await cleanUpPaginatedDML(queryResults, paginationFactor),
                nextToken: queryResults.NextToken,
            };
        } else {
            return {
                items: await queryResults,
                nextToken: queryResults.NextToken,
            };
        }
    } else {
        //user doesn't want DML response paginated
        const input = params.config.s3.getObject(s3Params).createReadStream();
        if (params.config.formatJson) {
            return {
                items: await cleanUpDML(input, params.config.ignoreEmpty, params.config.flatKeys),
            };
        } else {
            return { items: await getRawResultsFromS3(input) };
        }
    }
}

async function cleanUpPaginatedDML(queryResults, paginationFactor) {
    const dataTypes = await getDataTypes();
    const columnNames = Object.keys(dataTypes).reverse();
    let rowObject = {};
    let unformattedS3RowArray = null;
    let formattedArray = [];

    for (let i = paginationFactor; i < queryResults.ResultSet.Rows.length; i++) {
        unformattedS3RowArray = queryResults.ResultSet.Rows[i].Data;

        for (let j = 0; j < unformattedS3RowArray.length; j++) {
            if (unformattedS3RowArray[j].hasOwnProperty("VarCharValue")) {
                [rowObject[columnNames[j]]] = [
                    unformattedS3RowArray[j].VarCharValue,
                ];
            }
        }

        formattedArray.push(addDataType(rowObject, dataTypes));
        rowObject = {};
    }
    return formattedArray;
}

function getRawResultsFromS3(input) {
    let rawJson = [];
    return new Promise(function (resolve, reject) {
        readline
            .createInterface({
                input,
            })
            .on("line", (line) => {
                rawJson.push(line.trim());
            })
            .on("close", function () {
                resolve(rawJson);
            });
    });
}

function getDataTypes() {
    return new Promise(async function (resolve) {
        const columnInfoArray = (await s3Metadata).ResultSet.ResultSetMetadata
            .ColumnInfo;
        let columnInfoArrayLength = columnInfoArray.length;
        let columnInfoObject = {};
        while (columnInfoArrayLength--) {
            [columnInfoObject[columnInfoArray[columnInfoArrayLength].Name]] = [
                columnInfoArray[columnInfoArrayLength].Type,
            ];
        }
        resolve(columnInfoObject);
    });
}

async function cleanUpDML(input, ignoreEmpty, flatKeys) {
    let cleanJson = [];
    const dataTypes = await getDataTypes();
    return new Promise(function (resolve) {
        input.pipe(
            csv({
                ignoreEmpty,
                flatKeys
            })
                .on("data", (data) => {
                    cleanJson.push(
                        addDataType(
                            JSON.parse(data.toString("utf8")),
                            dataTypes
                        )
                    );
                })
                .on("finish", function () {
                    resolve(cleanJson);
                })
        );
    });
}

function addDataType(input, dataTypes) {
    let updatedObjectWithDataType = {};

    for (const key in input) {
        if (!input[key]) {
            updatedObjectWithDataType[key] = null;
        } else {
            switch (dataTypes[key]) {
                case "varchar":
                    updatedObjectWithDataType[key] = input[key];
                    break;
                case "boolean":
                    updatedObjectWithDataType[key] = JSON.parse(
                        input[key].toLowerCase()
                    );
                    break;
                case "integer":
                case "tinyint":
                case "smallint":
                case "int":
                case "float":
                case "double":
                    updatedObjectWithDataType[key] = Number(input[key]);
                    break;
                default:
                    updatedObjectWithDataType[key] = input[key];
            }
        }
    }
    return updatedObjectWithDataType;
}

function cleanUpNonDML(input) {
    let cleanJson = [];
    return new Promise(function (resolve) {
        readline
            .createInterface({
                input,
            })
            .on("line", (line) => {
                switch (true) {
                    case line.indexOf("\t") > 0:
                        line = line.split("\t");
                        cleanJson.push({
                            [line[0].trim()]: line[1].trim(),
                        });
                        break;
                    default:
                        if (line.trim().length) {
                            cleanJson.push({
                                row: line.trim(),
                            });
                        }
                }
            })
            .on("close", function () {
                resolve(cleanJson);
            });
    });
}

function validateConstructor(init) {
    if (!init)
        throw new TypeError("Config object not present in the constructor");

    try {
        let aws = init.s3 ? init.s3 : init.aws.config.credentials.accessKeyId;
        let athena = new init.aws.Athena({
            apiVersion: "2017-05-18",
        });
    } catch (e) {
        throw new TypeError(
            "AWS object not present or incorrect in the constructor"
        );
    }
}

function isCommonAthenaError(err) {
    return err === "TooManyRequestsException" ||
        err === "ThrottlingException" ||
        err === "NetworkingError" ||
        err === "UnknownEndpoint"
        ? true
        : false;
}

const lowerCaseKeys = (obj) =>
    Object.keys(obj).reduce((acc, key) => {
        acc[key.toLowerCase()] = obj[key];
        return acc;
    }, {});

module.exports = {
    validateConstructor,
    startQueryExecution,
    checkIfExecutionCompleted,
    getQueryResultsFromS3,
    lowerCaseKeys,
};
