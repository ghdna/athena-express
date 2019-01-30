"use strict";

const COST_PER_MB = 0.000004768, //Based on $5/TB
	BYTES_IN_MB = 1048576,
	COST_FOR_10MB = COST_PER_MB * 10;

const readline = require("readline"),
	csv = require("csvtojson");

module.exports = class AthenaExpress {
	constructor(init) {
		validateConstructor(init);
		this.config = {
			athena: new init.aws.Athena({ apiVersion: "2017-05-18" }),
			s3: new init.aws.S3({ apiVersion: "2006-03-01" }),
			s3Bucket:
				init.s3 ||
				`s3://athena-express-${init.aws.config.credentials.accessKeyId
					.substring(0, 10)
					.toLowerCase()}-${new Date().getFullYear()}`,
			db: init.db || "default",
			retry: Number(init.retry) || 200,
			formatJson: init.formatJson === false ? false : true,
			getStats: init.getStats,
			ignoreEmpty: init.ignoreEmpty === false ? false : true
		};
	}

	async query(query) {
		const config = this.config;
		let results = {};

		if (!config)
			throw new TypeError("Config object not present in the constructor");

		if (!query) throw new TypeError("SQL query is missing");

		try {
			const queryExecutionId = await startQueryExecution(query, config);
			const queryStatus = await checkIfExecutionCompleted(
				queryExecutionId,
				config
			);

			const s3Output =
					queryStatus.QueryExecution.ResultConfiguration
						.OutputLocation,
				statementType = queryStatus.QueryExecution.StatementType;

			results.Items = await getQueryResultsFromS3({
				s3Output,
				statementType,
				config
			});

			if (config.getStats) {
				const dataInMb = Math.round(
					queryStatus.QueryExecution.Statistics.DataScannedInBytes /
						BYTES_IN_MB
				);

				results.DataScannedInMB = dataInMb;
				results.QueryCostInUSD =
					dataInMb > 10 ? dataInMb * COST_PER_MB : COST_FOR_10MB;
				results.EngineExecutionTimeInMillis =
					queryStatus.QueryExecution.Statistics.EngineExecutionTimeInMillis;
				results.Count = results.Items.length;
			}

			return results;
		} catch (error) {
			throw new Error(error);
		}
	}
};

function startQueryExecution(query, config) {
	const QueryString = query.sql || query;

	const params = {
		QueryString,
		ResultConfiguration: {
			OutputLocation: config.s3Bucket
		},
		QueryExecutionContext: {
			Database: query.db || config.db
		}
	};
	return new Promise(function(resolve, reject) {
		const startQueryExecutionRecursively = async function() {
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

function checkIfExecutionCompleted(QueryExecutionId, config) {
	let retry = config.retry;
	return new Promise(function(resolve, reject) {
		const keepCheckingRecursively = async function() {
			try {
				let data = await config.athena
					.getQueryExecution({ QueryExecutionId })
					.promise();
				if (data.QueryExecution.Status.State === "SUCCEEDED") {
					retry = config.retry;
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

function getQueryResultsFromS3(params) {
	const s3Params = {
			Bucket: params.s3Output.split("/")[2],
			Key: params.s3Output
				.split("/")
				.slice(3)
				.join("/")
		},
		input = params.config.s3.getObject(s3Params).createReadStream();

	if (params.config.formatJson) {
		return params.statementType === "UTILITY" ||
			params.statementType === "DDL"
			? cleanUpNonDML(input)
			: cleanUpDML(input, params.config.ignoreEmpty);
	} else {
		return getRawResultsFromS3(input);
	}
}

function getRawResultsFromS3(input) {
	let rawJson = [];
	return new Promise(function(resolve, reject) {
		readline
			.createInterface({ input })
			.on("line", line => {
				rawJson.push(line.trim());
			})
			.on("close", function() {
				resolve(rawJson);
			});
	});
}

function cleanUpDML(input, ignoreEmpty) {
	let cleanJson = [];

	return new Promise(function(resolve, reject) {
		input.pipe(
			csv({ ignoreEmpty })
				.on("data", data => {
					cleanJson.push(JSON.parse(data.toString("utf8")));
				})
				.on("finish", function() {
					resolve(cleanJson);
				})
		);
	});
}

function cleanUpNonDML(input) {
	let cleanJson = [];
	return new Promise(function(resolve, reject) {
		readline
			.createInterface({ input })
			.on("line", line => {
				switch (true) {
					case line.indexOf("\t") > 0:
						line = line.split("\t");
						cleanJson.push({
							[line[0].trim()]: line[1].trim()
						});
						break;
					default:
						if (line.trim().length) {
							cleanJson.push({
								row: line.trim()
							});
						}
				}
			})
			.on("close", function() {
				resolve(cleanJson);
			});
	});
}

function validateConstructor(init) {
	if (!init)
		throw new TypeError("Config object not present in the constructor");

	try {
		let aws = init.s3 ? init.s3 : init.aws.config.credentials.accessKeyId;
		let athena = new init.aws.Athena({ apiVersion: "2017-05-18" });
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
