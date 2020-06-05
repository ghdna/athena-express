"use strict";

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
            workgroup: init.workgroup || "primary",
            retry: Number(init.retry) || 200,
            formatJson: init.formatJson !== false,
            getStats: init.getStats || init.skipResults,
            ignoreEmpty: init.ignoreEmpty !== false,
            skipResults: init.skipResults,
            waitForResults: init.waitForResults !== false,
        };
    }

    async query(query) {
        const config = this.config;
        let initiateQueryInAthena = true;
        let queryExecutionId = null;
        let results = {};

        if (!config)
            throw new TypeError("Config object not present in the constructor");

        if (!query) throw new TypeError("SQL query is missing");
        const queryString = query.sql || query;
        if (
            queryString.trim().length === 36 &&
            queryString.trim().indexOf(" ") === -1
        ) {
            //indicates that the query is actually a QueryExecutionId
            initiateQueryInAthena = false;
            queryExecutionId = queryString;
        }

        try {
            if (initiateQueryInAthena) {
                queryExecutionId = await helpers.startQueryExecution(
                    query,
                    config
                );

                if (!config.waitForResults) {
                    results.QueryExecutionId = queryExecutionId;
                    return results;
                }
            }

            const queryStatus = await helpers.checkIfExecutionCompleted(
                queryExecutionId,
                config
            );

            const s3Output =
                    queryStatus.QueryExecution.ResultConfiguration
                        .OutputLocation,
                statementType = queryStatus.QueryExecution.StatementType;

            if (!config.skipResults || !initiateQueryInAthena) {
                if (/.txt/.test(s3Output) || /.csv/.test(s3Output)) {
                    results.Items = await helpers.getQueryResultsFromS3({
                        s3Output,
                        statementType,
                        config,
                    });
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
                results.QueryExecutionId = queryExecutionId;
                results.S3Location = s3Output;
            }

            return results;
        } catch (error) {
            throw new Error(error);
        }
    }
};
