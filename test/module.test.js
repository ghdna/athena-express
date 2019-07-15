'use strict';

const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const AthenaExpress = require('..');

chai.should();

const THROW_IN_STARRTQUERYEXECUTION = 'startQueryExecution';
const THROW_IN_GETQUERYEXECUTIOIN = 'getQueryExecution';

class S3 {
  getObject(params) {
    return {
      createReadStream: () => {
        const keys = params.Key.split('/');
        const filename = keys[keys.length - 1];
        return fs.createReadStream(`${__dirname}/test-data/${filename}`);
      }
    };
  }
}

class Athena {
  constructor() {
    this.attempts = {
      startQueryExecution: 0,
      getQueryExecution: 0
    };

    this.exceptionsToThrow = [];
    this.status = {
      State: 'SUCCEEDED',
      SubmissionDateTime: '2019-07-10T16:59:21.673Z',
      CompletionDateTime: '2019-07-10T16:59:22.141Z'
    };
    this.lastStatement = undefined;
    this.Statistics = undefined;
  }

  throwErrorWhen(methodName, errorObj, attemptCounts) {
    this.exceptionsToThrow.push({ methodName, errorObj, attemptCounts });
  }

  throwRegisteredErrors(methodName) {
    const throwableDefinition = this.exceptionsToThrow.find(
      descriptor => descriptor.methodName === methodName && descriptor.attemptCounts.includes(this.attempts[methodName])
    );
    if (throwableDefinition) {
      throw throwableDefinition.errorObj;
    }
  }

  statisticsToReturn(Statistics) {
    this.Statistics = Statistics;
  }

  statusOnGetQueryExecution(status) {
    this.status = status;
  }

  startQueryExecution(params) {
    this.lastStatement = params.QueryString;
    return {
      promise: () => {
        try {
          this.attempts['startQueryExecution']++;
          this.throwRegisteredErrors(THROW_IN_STARRTQUERYEXECUTION);

          if (params.QueryString && params.QueryString.toLowerCase().startsWith('select')) {
            return Promise.resolve({ QueryExecutionId: 'dml' });
          } else {
            return Promise.resolve({ QueryExecutionId: 'utility' });
          }
        } catch (err) {
          return Promise.reject(err);
        }
      }
    };
  }

  getQueryExecution(params) {
    const { QueryExecutionId } = params;
    return {
      promise: async () => {
        try {
          this.attempts['getQueryExecution']++;
          this.throwRegisteredErrors(THROW_IN_GETQUERYEXECUTIOIN);

          return Promise.resolve({
            QueryExecution: {
              QueryExecutionId,
              StatementType: QueryExecutionId.toUpperCase(),
              ResultConfiguration: {
                OutputLocation: `s3://bucket_name/results/sql-log/s3_athena_${QueryExecutionId}_response.csv`
              },
              QueryExecutionContext: { Database: 'db_name' },
              Status: this.status,
              Statistics: this.Statistics
            }
          });
        } catch (err) {
          return Promise.reject(err);
        }
      }
    };
  }
}

const getAthenaConfig = () => {
  return {
    aws: {
      Athena,
      S3
    },
    retry: 10,
    commonErrorRetry: 10, // allow retry tests to run quickly
    s3: 's3://bucket_name/results/sql-log',
    encryption: {}
  };
};

describe('AthenaExpress Tests', () => {
  describe('Negative Scenarios', () => {
    it('Should not have config object undefined', function() {
      expect(function() {
        // eslint-disable-next-line no-new
        new AthenaExpress();
      }).to.throw(TypeError, 'Config object not present in the constructor');
    });

    it('should not have aws object undefined', function() {
      expect(function() {
        // eslint-disable-next-line no-new
        new AthenaExpress({ s3: {} });
      }).to.throw(TypeError, 'AWS object not present or incorrect in the constructor');
    });

    it('should not have aws object without an Athena constructor inside of it', function() {
      expect(function() {
        // eslint-disable-next-line no-new
        new AthenaExpress({ aws: {} });
      }).to.throw(TypeError, 'AWS object not present or incorrect in the constructor');
    });

    it('should fail when s3 bucket is not defined and the aws credentials.accessKeyId is undefined', function() {
      expect(function() {
        // eslint-disable-next-line no-new
        new AthenaExpress({ aws: { config: { credentials: { accessKeyId: undefined } } } });
      }).to.throw(TypeError, 'AWS object not present or incorrect in the constructor');
    });
  });

  describe('Testing query method...', () => {
    it('Non DML query example', async function() {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());
      const result = await athenaExpress.query("SHOW TABLES 'table_name_pattern'");

      console.log(JSON.stringify(result));

      expect(result).to.eql({
        Items: [
          {
            row: 'table_name'
          }
        ]
      });
    });

    it('DML query example', async function() {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());
      const result = await athenaExpress.query(
        'SELECT distinct(yearmonth_field) FROM table_name order by yearmonth_field'
      );

      console.log(JSON.stringify(result));
      console.log('...');

      expect(result).to.deep.eql({
        Items: [
          {
            yearmonth_field: '201712'
          }
        ]
      });
    });

    it('Throws exception when query is not passed in', function(done) {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());

      athenaExpress
        .query()
        .then(() => done())
        .catch(err => {
          try {
            expect(err).to.be.instanceOf(TypeError);
            expect(err.message).to.equal('SQL query is missing');
            expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(0);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    it('(startQueryExecution) No Retry on non common AWS error', function(done) {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());
      const err = new TypeError();
      err.code = 'BadError';

      athenaExpress.config.athena.throwErrorWhen(THROW_IN_STARRTQUERYEXECUTION, err, [1]);

      athenaExpress
        .query('SELECT yearmonth_field FROM table_name order by yearmonth_field')
        .then(() => done())
        .catch(err => {
          try {
            expect(err.code).to.equal('BadError');
            expect(err).to.be.instanceOf(TypeError);
            expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(0);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    it('(startQueryExecution) Retry twice on common error', async function() {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());

      const err = new TypeError();
      err.code = 'ThrottlingException';

      athenaExpress.config.athena.throwErrorWhen(THROW_IN_STARRTQUERYEXECUTION, err, [1]);
      const result = await athenaExpress.query('SELECT yearmonth_field FROM table_name order by yearmonth_field');

      expect(athenaExpress.config.athena.attempts[THROW_IN_STARRTQUERYEXECUTION]).to.be.equals(2);

      console.log(JSON.stringify(result));
      console.log('...');

      expect(result).to.deep.eql({
        Items: [
          {
            yearmonth_field: '201712'
          }
        ]
      });
    });

    it('(getQueryExecution) Retry twice due to ThrottlingException', async function() {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());

      const err = new TypeError();
      err.code = 'ThrottlingException';

      athenaExpress.config.athena.throwErrorWhen(THROW_IN_GETQUERYEXECUTIOIN, err, [1, 2]);
      const result = await athenaExpress.query('SELECT yearmonth_field FROM table_name order by yearmonth_field');

      expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(3);

      console.log(JSON.stringify(result));
      console.log('...');

      expect(result).to.deep.eql({
        Items: [
          {
            yearmonth_field: '201712'
          }
        ]
      });
    });

    it('(getQueryExecution) Retry on NetworkingError', async function() {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());

      const err = new TypeError();
      err.code = 'NetworkingError';

      athenaExpress.config.athena.throwErrorWhen(THROW_IN_GETQUERYEXECUTIOIN, err, [1]);

      const result = await athenaExpress.query('SELECT yearmonth_field  FROM table_name order by yearmonth_field');

      expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.greaterThan(1);

      expect(result).to.deep.eql({
        Items: [
          {
            yearmonth_field: '201712'
          }
        ]
      });
    });

    it('(getQueryExecution) Retry on UnknownEndpoint', async function() {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());
      const err = new TypeError();
      err.code = 'UnknownEndpoint';

      athenaExpress.config.athena.throwErrorWhen(THROW_IN_GETQUERYEXECUTIOIN, err, [1]);

      const result = await athenaExpress.query('SELECT yearmonth_field  FROM table_name order by yearmonth_field');

      expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.greaterThan(1);

      expect(result).to.deep.eql({
        Items: [
          {
            yearmonth_field: '201712'
          }
        ]
      });
    });

    it('(getQueryExecution) Retry on TooManyRequestsException', async function() {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());

      const err = new TypeError();
      err.code = 'TooManyRequestsException';
      athenaExpress.config.athena.throwErrorWhen(THROW_IN_GETQUERYEXECUTIOIN, err, [1]);

      const result = await athenaExpress.query('SELECT yearmonth_field FROM table_name order by yearmonth_field');

      expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.greaterThan(1);

      expect(result).to.deep.eql({
        Items: [
          {
            yearmonth_field: '201712'
          }
        ]
      });
    });

    it('(getQueryExecution) No Retry on non common AWS error', function(done) {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());
      const err = new TypeError();
      err.code = 'BadError';

      athenaExpress.config.athena.throwErrorWhen(THROW_IN_GETQUERYEXECUTIOIN, err, [1]);

      athenaExpress
        .query('SELECT yearmonth_field FROM table_name order by yearmonth_field')
        .then(() => done())
        .catch(err => {
          try {
            expect(err.code).to.equal('BadError');
            expect(err).to.be.instanceOf(TypeError);
            expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(1);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    it('(getQueryExecution) Retries infinitely when status is not SUCCEEDED or FAILED', function(done) {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());
      athenaExpress.config.athena.statusOnGetQueryExecution({
        State: 'UNHANDLED_STATUS',
        StateChangeReason: 'Forced Error In Test',
        SubmissionDateTime: '2019-07-10T16:59:21.673Z',
        CompletionDateTime: '2019-07-10T16:59:22.141Z'
      });

      let currentCount = 0;
      const abortCount = 10;
      const _setTimeout = global.setTimeout;
      global.setTimeout = (callbackfn, millis) => {
        if (++currentCount < abortCount) {
          _setTimeout(callbackfn, millis);
        } else {
          global.setTimeout = _setTimeout;
          throw Error('Aborted.. infinite loop protection.');
        }
      };

      athenaExpress
        .query('SELECT yearmonth_field FROM table_name order by yearmonth_field')
        .then(() => done())
        .catch(err => {
          try {
            expect(err.message).to.equal('Aborted.. infinite loop protection.');
            expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(abortCount);
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    it('(getQueryExecution) Retry can be functions', function(done) {
      this.timeout(10000);
      const athenaConfig = getAthenaConfig();

      let customRetryCallCount = 0;
      const retryFn = () => {
        customRetryCallCount++;
        return 10;
      };
      athenaConfig.retry = retryFn;

      const athenaExpress = new AthenaExpress(athenaConfig);

      athenaExpress.config.athena.statusOnGetQueryExecution({
        State: 'UNHANDLED_STATUS',
        StateChangeReason: 'Forced Error In Test',
        SubmissionDateTime: '2019-07-10T16:59:21.673Z',
        CompletionDateTime: '2019-07-10T16:59:22.141Z'
      });

      let timeoutCallCount = 0;
      const abortCount = 10;
      const _setTimeout = global.setTimeout;
      global.setTimeout = (callbackfn, millis) => {
        if (++timeoutCallCount < abortCount) {
          _setTimeout(callbackfn, millis);
        } else {
          global.setTimeout = _setTimeout;
          throw Error('Aborted.. infinite loop protection.');
        }
      };

      athenaExpress
        .query('SELECT yearmonth_field FROM table_name order by yearmonth_field')
        .then(() => done())
        .catch(err => {
          try {
            expect(err.message).to.equal('Aborted.. infinite loop protection.');
            expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(abortCount);
            expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(
              customRetryCallCount
            );
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    it('(getQueryExecution) commonErrorRetry can be functions', async function() {
      this.timeout(10000);
      const athenaConfig = getAthenaConfig();

      let customCommonErrorRetryCallCount = 0;
      const commonErrorRetryFn = () => {
        customCommonErrorRetryCallCount++;
        return 10;
      };
      athenaConfig.commonErrorRetry = commonErrorRetryFn;

      const athenaExpress = new AthenaExpress(athenaConfig);

      const err = new TypeError();
      err.code = 'TooManyRequestsException';
      athenaExpress.config.athena.throwErrorWhen(THROW_IN_GETQUERYEXECUTIOIN, err, [1, 2, 3]);

      const result = await athenaExpress.query('SELECT yearmonth_field FROM table_name order by yearmonth_field');

      expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equal(4);
      expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(
        customCommonErrorRetryCallCount + 1
      );
      expect(result).to.deep.eql({
        Items: [
          {
            yearmonth_field: '201712'
          }
        ]
      });
    });

    it('(getQueryExecution) Status State of FAILED is handled appropriately', function(done) {
      this.timeout(10000);
      const athenaExpress = new AthenaExpress(getAthenaConfig());
      athenaExpress.config.athena.statusOnGetQueryExecution({
        State: 'FAILED',
        StateChangeReason: 'Forced Error In Test',
        SubmissionDateTime: '2019-07-10T16:59:21.673Z',
        CompletionDateTime: '2019-07-10T16:59:22.141Z'
      });

      athenaExpress
        .query('SELECT yearmonth_field FROM table_name order by yearmonth_field')
        .then(() => done())
        .catch(err => {
          try {
            expect(err).to.equal('Forced Error In Test');
            expect(athenaExpress.config.athena.attempts[THROW_IN_GETQUERYEXECUTIOIN]).to.be.equals(1);
            done();
          } catch (err) {
            done(err);
          }
        });
    });
  });

  describe('Testing configurable behaviors...', () => {
    it('Returns stats when getStats is true, cost per MB', async function() {
      this.timeout(10000);
      const config = getAthenaConfig();
      config.getStats = true;

      const athenaExpress = new AthenaExpress(config);
      athenaExpress.config.athena.statisticsToReturn({
        DataScannedInBytes: 100000,
        EngineExecutionTimeInMillis: 100000
      });
      const result = await athenaExpress.query("SHOW TABLES 'table_name_pattern");

      expect(result).to.eql({
        Items: [{ row: 'table_name' }],
        DataScannedInMB: 0,
        QueryCostInUSD: 0.00004768,
        EngineExecutionTimeInMillis: 100000,
        Count: 1,
        QueryExecutionId: 'utility',
        S3Location: 's3://bucket_name/results/sql-log/s3_athena_utility_response.csv'
      });
    });

    it('Returns raw response when formatJson is false', async function() {
      this.timeout(10000);
      const config = getAthenaConfig();
      config.formatJson = false;

      const athenaExpress = new AthenaExpress(config);

      const result = await athenaExpress.query("SHOW TABLES 'table_name_pattern'");

      console.log(JSON.stringify(result));

      expect(result).to.eql({
        Items: ['table_name']
      });
    });
  });
});
