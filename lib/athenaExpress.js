const readline = require('readline');
const csv = require('csvtojson');

const COST_PER_MB = 0.000004768; // Based on $5/TB
const BYTES_IN_MB = 1048576;
const COST_FOR_10MB = COST_PER_MB * 10;

module.exports = class AthenaExpress {
  constructor(init) {
    validateConstructor(init);
    const awsOptions = init.awsOptions || {};
    this.config = {
      athena: new init.aws.Athena({ ...awsOptions, apiVersion: '2017-05-18' }),
      s3: new init.aws.S3({ ...awsOptions, apiVersion: '2006-03-01' }),
      s3Bucket:
        init.s3 ||
        `s3://athena-express-${init.aws.config.credentials.accessKeyId
          .substring(0, 10)
          .toLowerCase()}-${new Date().getFullYear()}`,
      encryption: init.encryption,
      db: init.db || 'default',
      retry:
        init.retry instanceof Function
          ? init.retry
          : (retryVal => {
              return () => retryVal;
            })(Number(init.retry) || 200),
      commonErrorRetry:
        init.commonErrorRetry instanceof Function
          ? init.commonErrorRetry
          : (retryVal => {
              return () => retryVal;
            })(Number(init.commonErrorRetry) || 2000),
      formatJson: init.formatJson !== false,
      getStats: init.getStats,
      ignoreEmpty: init.ignoreEmpty !== false,
      workGroup: init.workGroup
    };
  }

  async query(query, ignoreResultsFile = false) {
    const config = this.config;
    const results = {};

    if (!query) {
      throw new TypeError('SQL query is missing');
    }

    const queryExecutionId = await startQueryExecution(query, config);
    const queryStatus = await checkIfExecutionCompleted(queryExecutionId, config);
    const s3Output = queryStatus.QueryExecution.ResultConfiguration.OutputLocation;
    const statementType = queryStatus.QueryExecution.StatementType;
    if (!ignoreResultsFile) {
      results.Items = await getQueryResultsFromS3({
        s3Output,
        statementType,
        config
      });
    }

    if (config.getStats) {
      const dataInMb = Math.round(queryStatus.QueryExecution.Statistics.DataScannedInBytes / BYTES_IN_MB);

      results.DataScannedInMB = dataInMb;
      results.QueryCostInUSD = dataInMb > 10 ? dataInMb * COST_PER_MB : COST_FOR_10MB;
      results.EngineExecutionTimeInMillis = queryStatus.QueryExecution.Statistics.EngineExecutionTimeInMillis;
      results.Count = results.Items.length;
      results.QueryExecutionId = queryExecutionId;
      results.S3Location = s3Output;
    }

    return results;
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
  if (config.encryption) {
    params.ResultConfiguration.EncryptionConfiguration = config.encryption;
  }
  if (config.workGroup) {
    params.WorkGroup = config.workGroup;
  }

  return new Promise(function(resolve, reject) {
    const startQueryExecutionRecursively = async function() {
      try {
        const data = await config.athena.startQueryExecution(params).promise();
        resolve(data.QueryExecutionId);
      } catch (err) {
        if (isCommonAthenaError(err.code)) {
          setTimeout(() => {
            startQueryExecutionRecursively();
          }, config.commonErrorRetry());
        } else {
          reject(err);
        }
      }
    };
    startQueryExecutionRecursively();
  });
}

function checkIfExecutionCompleted(QueryExecutionId, config) {
  return new Promise(function(resolve, reject) {
    const keepCheckingRecursively = async function() {
      try {
        const data = await config.athena.getQueryExecution({ QueryExecutionId }).promise();
        if (data.QueryExecution.Status.State === 'SUCCEEDED') {
          resolve(data);
        } else if (data.QueryExecution.Status.State === 'FAILED') {
          reject(data.QueryExecution.Status.StateChangeReason);
        } else {
          setTimeout(() => {
            keepCheckingRecursively();
          }, config.retry());
        }
      } catch (err) {
        if (isCommonAthenaError(err.code)) {
          setTimeout(() => {
            keepCheckingRecursively();
          }, config.commonErrorRetry());
        } else {
          reject(err);
        }
      }
    };
    keepCheckingRecursively();
  });
}

function getQueryResultsFromS3(params) {
  const s3Params = {
    Bucket: params.s3Output.split('/')[2],
    Key: params.s3Output
      .split('/')
      .slice(3)
      .join('/')
  };

  const input = params.config.s3.getObject(s3Params).createReadStream();
  if (params.config.formatJson) {
    return params.statementType === 'UTILITY' || params.statementType === 'DDL'
      ? cleanUpNonDML(input)
      : cleanUpDML(input, params.config.ignoreEmpty);
  } else {
    return getRawResultsFromS3(input);
  }
}

function getRawResultsFromS3(input) {
  const rawJson = [];
  return new Promise(function(resolve) {
    readline
      .createInterface({ input })
      .on('line', line => {
        rawJson.push(line.trim());
      })
      .on('close', function() {
        resolve(rawJson);
      });
  });
}

function cleanUpDML(input, ignoreEmpty) {
  const cleanJson = [];

  return new Promise(function(resolve) {
    input.pipe(
      csv({ ignoreEmpty })
        .on('data', data => {
          cleanJson.push(JSON.parse(data.toString('utf8')));
        })
        .on('finish', function() {
          resolve(cleanJson);
        })
    );
  });
}

function cleanUpNonDML(input) {
  const cleanJson = [];
  return new Promise(function(resolve) {
    readline
      .createInterface({ input })
      .on('line', line => {
        const indx = line.indexOf('\t');
        if (indx > 0) {
          const tabSplits = line.split('\t');
          cleanJson.push({
            [tabSplits[0].trim()]: tabSplits[1].trim()
          });
        } else if (line.trim().length) {
          cleanJson.push({
            row: line.trim()
          });
        }
      })
      .on('close', function() {
        resolve(cleanJson);
      });
  });
}

function validateConstructor(init) {
  if (!init) {
    throw new TypeError('Config object not present in the constructor');
  }

  try {
    const awsS3 = init.s3 ? init.s3 : init.aws.config.credentials.accessKeyId;
    if (!awsS3) {
      throw Error();
    }

    if (!init.aws || !(init.aws.Athena instanceof Function)) {
      throw Error();
    }
  } catch (e) {
    throw new TypeError('AWS object not present or incorrect in the constructor');
  }
}

function isCommonAthenaError(err) {
  return (
    err === 'TooManyRequestsException' ||
    err === 'ThrottlingException' ||
    err === 'NetworkingError' ||
    err === 'UnknownEndpoint'
  );
}
