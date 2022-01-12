"use strict";
//athenaExpress.js

const COST_PER_MB = 0.000004768, //Based on $5/TB
    BYTES_IN_MB = 1048576,
    COST_FOR_10MB = COST_PER_MB * 10;

const helpers = require("./helpers.js");

module.exports = class AthenaExpress {
    constructor(init) {
        helpers.validateConstructor(init);
        this.config = {
            athena: new init.aws.Athena({
                apiVersion: "2017-05-18",
            }),
            s3: new init.aws.S3({
                apiVersion: "2006-03-01",
            }),
            s3Bucket:
                init.s3 ||
                `s3://athena-express-${init.aws.config.credentials.accessKeyId
                    .substring(0, 10)
                    .toLowerCase()}-${new Date().getFullYear()}`,
            encryption: init.encryption,
            db: init.db || "default",
            catalog: init.catalog || null,
            sql: null,
            workgroup: init.workgroup || "primary",
            retry: Number(init.retry) || 200,
            formatJson: init.formatJson !== false,
            getStats: init.getStats || init.skipResults,
            ignoreEmpty: init.ignoreEmpty !== false,
            skipResults: init.skipResults,
            waitForResults: init.waitForResults !== false,
            QueryExecutionId: null,
            pagination: Number(init.pagination) || 0,
            NextToken: init.nextToken || null,
        };
    }

    async query(query) {
        const config = { ...this.config };

        let initiateQueryInAthena = true;

        let results = {};

        if (!config)
            throw new TypeError("Config object not present in the constructor");

        if (!query) throw new TypeError("SQL query is missing");

        if (typeof query === "object") {
            const loweredCaseKeys = helpers.lowerCaseKeys(query);

            if (loweredCaseKeys.hasOwnProperty("nexttoken")) {
                config.NextToken = loweredCaseKeys.nexttoken;
            }
            if (loweredCaseKeys.hasOwnProperty("pagination")) {
                config.pagination = loweredCaseKeys.pagination;
            }
            if (loweredCaseKeys.hasOwnProperty("db")) {
                config.db = loweredCaseKeys.db;
            }
            if (loweredCaseKeys.hasOwnProperty("catalog")) {
                config.catalog = loweredCaseKeys.catalog;
            }
            if (loweredCaseKeys.hasOwnProperty("sql")) {
                config.sql = loweredCaseKeys.sql;
            }
            if (loweredCaseKeys.hasOwnProperty("queryexecutionid")) {
                config.QueryExecutionId = loweredCaseKeys.queryexecutionid;
                initiateQueryInAthena = false;
            }
        } else if (
            query.trim().length === 36 &&
            query.trim().indexOf(" ") === -1
        ) {
            //indicates that the query is actually a string containing just the QueryExecutionId
            initiateQueryInAthena = false;
            config.QueryExecutionId = query;
        } else {
            config.sql = query;
        }

        try {
            if (initiateQueryInAthena) {
                config.QueryExecutionId = await helpers.startQueryExecution(
                    config
                );

                if (!config.waitForResults) {
                    results.QueryExecutionId = config.QueryExecutionId;
                    return results;
                }
            }

            const queryStatus = await helpers.checkIfExecutionCompleted(config);

            const s3Output =
                    queryStatus.QueryExecution.ResultConfiguration
                        .OutputLocation,
                statementType = queryStatus.QueryExecution.StatementType;

            if (!config.skipResults || !initiateQueryInAthena) {
                if (/.txt/.test(s3Output) || /.csv/.test(s3Output)) {
                    const queryResultsFromS3 = await helpers.getQueryResultsFromS3(
                        {
                            s3Output,
                            statementType,
                            config,
                        }
                    );
                    results.Items = queryResultsFromS3.items;
                    if (queryResultsFromS3.nextToken) {
                        results.NextToken = queryResultsFromS3.nextToken;
                        results.QueryExecutionId = config.QueryExecutionId;
                    }
                }
            }

            if (config.getStats) {
                const statistics = queryStatus.QueryExecution.Statistics;
                results = Object.assign(results, statistics);
                const dataInMb = Math.round(
                    queryStatus.QueryExecution.Statistics.DataScannedInBytes /
                        BYTES_IN_MB
                );

                results.DataScannedInMB = dataInMb;
                results.QueryCostInUSD =
                    dataInMb > 10 ? dataInMb * COST_PER_MB : COST_FOR_10MB;
                results.Count = results.Items ? results.Items.length : 0;
                results.QueryExecutionId = config.QueryExecutionId;
                results.S3Location = s3Output;
            }

            return results;
        } catch (error) {
            throw new Error(error);
        }
    }
};
