# Athena-Express: Simplifying SQL queries on Amazon Athena

[![NPM](https://nodei.co/npm/athena-express.png?compact=true)](https://nodei.co/npm/athena-express/)

[![Build Status](https://travis-ci.org/ghdna/athena-express.svg?branch=master)](https://travis-ci.org/ghdna/athena-express)
[![Package Quality](http://npm.packagequality.com/shield/athena-express.png)](http://packagequality.com/#?package=athena-express)
[![Code Climate](https://codeclimate.com/github/ghdna/athena-express/badges/gpa.svg)](https://codeclimate.com/github/ghdna/athena-express/)
[![Coverage Status](https://coveralls.io/repos/github/ghdna/athena-express/badge.svg?branch=master)](https://coveralls.io/github/ghdna/athena-express?branch=master)
[![Downloads](https://img.shields.io/npm/dt/athena-express.svg)](https://www.npmjs.com/package/athena-express)

###### _As published on the official [AWS Partner Network Blog](https://aws.amazon.com/blogs/apn/using-athena-express-to-simplify-sql-queries-on-amazon-athena/)_

## Synopsis

Athena-Express can simplify executing SQL queries in Amazon Athena **AND** fetching _cleaned-up_ JSON results in the same synchronous call - well suited for web applications.

##### Example:

<img src="https://image.ibb.co/cWNvFV/carbon-1.png" alt="Athena-Express Example" width="700">

## Amazon Athena Background

[Amazon Athena](https://aws.amazon.com/athena/), launched at AWS re:Invent 2016, made it easier to analyze data in Amazon S3 using standard SQL. Under the covers, it uses [Presto](https://prestodb.io/), which is an opensource SQL engine developed by Facebook in 2012 to query their 300 Petabyte data warehouse. It's incredibly powerful!

Amazon Athena combines the strength of Presto with serverless & self-managed capabilities of AWS. By simply pointing Athena to your data in Amazon S3, one could start querying using standard SQL. Most results are delivered within seconds and there’s no need for complex ETL jobs to prepare your data for analysis. This makes it easy for anyone with SQL skills to quickly analyze large-scale datasets.

## How athena-express simplifies using Amazon Athena

`athena-express` simplifies integrating Amazon Athena with any Node.JS application - running as a standalone application or as a Lambda function. As a wrapper on AWS SDK, Athena-Express bundles the following steps listed on the official [AWS Documentation](https://docs.aws.amazon.com/athena/latest/APIReference/Welcome.html):

1. Initiates a query execution
2. Keeps checking until the query has finished executing
3. Fetches the results of the query execution from Amazon S3

And as added features

4. Formats the results into a clean, user-friendly JSON array
5. Handles specific Athena errors by recursively retrying for `ThrottlingException`, `NetworkingError`, and `TooManyRequestsException`
6. Provides optional helpful stats including cost per query in USD

Integrating with Amazon Athena without `athena-express` would require you to identify the appropriate API methods in the AWS SDK, stich them together sequentially, and then build out an error handling & retry mechanism for each of those methods.

`athena-express` can help you save time & effort in setting up this integration so that you can focus on core application development.

### How is athena-express being used?

The most common use case is integrating a web front-end with Amazon Athena using `athena-express` as a backend. This backend could be any Node.JS application including AWS Lambda.

Here is an example using AWS Lambda:
<img src="https://image.ibb.co/k3RpNA/Screen-Shot-2018-11-22-at-11-17-58-AM.pngg" alt="athena-express architecture" width="700">

This architecture has a web front-end that invokes an API endpoint hosted on Amazon API Gateway by passing a query request. The query request can be as simple as `SELECT * FROM movies LIMIT 3`

This API Gateway then triggers a Lambda function that has the `athena-express` library imported.

## Setup

### Prerequisites

- You will need either an `IAM Role` (if you're running `athena-express` on AWS Lambda or AWS EC2) **OR** an `IAM User` with `accessKeyId` and `secretAccessKey` (if you're running `athena-express` on a standalone NodeJS application)
- This IAM role/user must have `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached
  - Note: As an alternative to granting `AmazonS3FullAccess` you could granularize and limit write access to a specific `bucket`. Just specify this bucket name during `athena-express` initialization

### Configuration

- `athena-express` needs an AWS SDK object created with relevant permissions as mentioned in the prerequisites above.
- This AWS object is passed within the constructor so that it can invoke Amazon Athena SDK. It's up to you how you create this `aws` object. Here are 4 options: 1. Create an `aws` object by explicitly passing in the `accessKeyId` and `secretAccessKey` generated in prerequisites

  ```javascript
  const aws = require("aws-sdk");
  const awsCredentials = {
  region: "YOUR_AWS_REGION",
  accessKeyId: "YOUR_AWS_ACCESS_KEY_ID",
  secretAccessKey: "YOUR_AWS_SECRET_ACCESS_KEY"
  };
  aws.config.update(awsCredentials);

  const athenaExpressConfig = { aws }; //configuring athena-express with aws sdk object
  const athenaExpress = new AthenaExpress(athenaExpressConfig);
  `` 2. OR if using Lambda, provide an [IAM execution role](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/using-lambda-iam-role-setup.html) with `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached ``javascript
  const aws = require("aws-sdk");
  const athenaExpressConfig = { aws }; //configuring athena-express with aws sdk object
  const athenaExpress = new AthenaExpress(athenaExpressConfig);
  ```

  3.  OR Use [instance profiles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html) when using EC2s 4. OR Use [environment variables](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html)

#### Option 1: Simple configuration

- Simple configuration requires only the AWS SDK object to be passed as a parameter to initialize `athena-express`
- Default values are assumed for all parameter options and `athena-express` creates a new `S3 bucket` in your AWS account for Amazon Athena to store the query results in.

```javascript
const aws = require('aws-sdk');

const athenaExpressConfig = { aws }; //simple configuration with just an aws sdk object

//Initializing athena-express
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```

#### Option 2: Advance configuration

- Besides the `aws` sdk paramater that is required, you can add any of the following optional parameters below

```javascript
const aws = require("aws-sdk");

//Advance configuration with all options
const athenaExpressConfig = {
	aws, /* required */
	s3: "STRING_VALUE", /* optional */
	db: "STRING_VALUE", /* optional */
	formatJson: BOOLEAN, /* optional default=true */
	retry: Function || Integer, /* optional default=200 */
	getStats: BOOLEAN, /* optional default=false */
	ignoreEmpty: BOOLEAN, /* optional default=true */
	encryption: OBJECT /* optional */
	workGroup: "STRING_VALUE", /* optional */
	commonErrorRetry: Function || Integer, /* optional */
};

//Initializing AthenaExpress
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```

###### Advance config Parameters:

| Parameter        | Format              | Default Value                                 | Description                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s3               | string              | `athena-express` creates a new bucket for you | S3 bucket name/prefix to store Athena query results                                                                                                                                                                                                                                                                                                               |
| db               | string              | `default`                                     | Athena database name that the SQL queries should be executed in. When a `db` name is specified in the config, you can execute SQL queries without needing to explicitly mention DB name. e.g. <br />`athenaExpress.query("SELECT * FROM movies LIMIT 3")` <br /> as opposed to <br />`athenaExpress.query({sql: "SELECT * FROM movies LIMIT 3", db: "moviedb"});` |
| formatJson       | boolean             | `true`                                        | Override as false if you rather get the raw unformatted output from S3.                                                                                                                                                                                                                                                                                           |
| retry            | integer             | `200` milliseconds                            | Wait interval between re-checking if the specific Athena query has finished executing                                                                                                                                                                                                                                                                             |
| getStats         | boolean             | `false`                                       | Get stats & additional metadata for your query, such as: <ul><li>`DataScannedInMB`</li><li>`QueryCostInUSD`</li><li>`EngineExecutionTimeInMillis`</li><li>`Count`</li><li>`QueryExecutionId`</li><li>`S3Location`</li></ul>                                                                                                                                       |
| ignoreEmpty      | boolean             | `true`                                        | Ignore fields with empty values from the final JSON response.                                                                                                                                                                                                                                                                                                     |
| encryption       | object              | Not included                                  | [Encryption configuation](https://docs.aws.amazon.com/athena/latest/ug/encryption.html) example usage: <br />`{ EncryptionOption: "SSE_KMS", KmsKey: process.env.kmskey}`                                                                                                                                                                                         |
| workGoup         | String              | Not included                                  | Allows defining the AWS Athena workgroup. Helpful if security is defined at this granularity.                                                                                                                                                                                                                                                                     |
| commonErrorRetry | Function or Integer | 2000 (ms)                                     | Can be simply set to an Integer value or it can be a Function that computes the common error retry wait interval.                                                                                                                                                                                                                                                 |

## Usage: Invoking athena-express

###### Using Promises:

```javascript
let query = {
  sql: 'SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3' /* required */,
  db: 'sampledb' /* optional. You could specify a database here or in the advance configuration option mentioned above*/
};

athenaExpress
  .query(query)
  .then(results => {
    console.log(results);
  })
  .catch(error => {
    console.log(error);
  });
```

###### Using Async/Await:

```javascript
(async () => {
  let query = {
    sql: 'SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3' /* required */,
    db: 'sampledb' /* optional. You could specify a database here or in the configuration constructor*/
  };

  try {
    let results = await athenaExpress.query(query);
    console.log(results);
  } catch (error) {
    console.log(error);
  }
})();
```

## Full Example

###### Using standard NodeJS application

```javascript
'use strict';

const AthenaExpress = require('athena-express'),
  aws = require('aws-sdk'),
  awsCredentials = {
    region: 'YOUR_AWS_REGION',
    accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY'
  };

aws.config.update(awsCredentials);

const athenaExpressConfig = {
  aws,
  s3: 's3://my-bucket-for-storing-athena-results-us-east-1',
  getStats: true
};

const athenaExpress = new AthenaExpress(athenaExpressConfig);

//Invoking a query on Amazon Athena
(async () => {
  let query = {
    sql: 'SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3',
    db: 'sampledb'
  };

  try {
    let results = await athenaExpress.query(query);
    console.log(results);
  } catch (error) {
    console.log(error);
  }
})();
```

###### Using AWS Lambda

```javascript
'use strict';

const AthenaExpress = require('athena-express'),
  aws = require('aws-sdk');

/* AWS Credentials are not required here 
    /* because the IAM Role assumed by this Lambda 
    /* has the necessary permission to execute Athena queries 
    /* and store the result in Amazon S3 bucket */

const athenaExpressConfig = {
  aws,
  db: 'sampledb',
  getStats: true
};
const athenaExpress = new AthenaExpress(athenaExpressConfig);

exports.handler = async (event, context, callback) => {
  const sqlQuery = 'SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3';

  try {
    let results = await athenaExpress.query(sqlQuery);
    callback(null, results);
  } catch (error) {
    callback(error, null);
  }
};
```

###### Results:

<img src="https://image.ibb.co/fpARNA/carbon-2.png" alt="Athena-Express result" width="400">

## More Examples

##### UTILITY queries - Added in v3.0

###### Show Tables (single column result)

```javascript
const results = await athenaExpress.query('SHOW TABLES');
console.log(results);

//Output:
{
  Items: [{ row: 'default' }, { row: 'sampledb' }];
}
```

###### Describe Table (dual column result)

```javascript
const results = await athenaExpress.query('DESCRIBE elb_logs');
console.log(results);

//Output:
{
  Items: [
    { request_timestamp: 'string' },
    { elb_name: 'string' },
    { request_ip: 'string' },
    { request_port: 'int' },
    { backend_ip: 'string' },
    { backend_port: 'int' },
    { request_processing_time: 'double' },
    { backend_processing_time: 'double' },
    { client_response_time: 'double' },
    { elb_response_code: 'string' },
    { backend_response_code: 'string' },
    { received_bytes: 'bigint' },
    { sent_bytes: 'bigint' },
    { request_verb: 'string' },
    { url: 'string' },
    { protocol: 'string' },
    { user_agent: 'string' },
    { ssl_cipher: 'string' },
    { ssl_protocol: 'string' }
  ];
}
```

## Contributors

[Gary Arora](https://twitter.com/AroraGary)

## License

MIT
