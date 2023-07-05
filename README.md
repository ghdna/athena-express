# Athena-Express: Simplifying SQL queries on Amazon Athena

[![NPM](https://nodei.co/npm/athena-express.png?compact=true)](https://nodei.co/npm/athena-express/)

[![Build Status](https://travis-ci.org/ghdna/athena-express.svg?branch=master)](https://travis-ci.org/ghdna/athena-express)
[![Package Quality](http://npm.packagequality.com/shield/athena-express.png)](http://packagequality.com/#?package=athena-express)
[![Code Climate](https://codeclimate.com/github/ghdna/athena-express/badges/gpa.svg)](https://codeclimate.com/github/ghdna/athena-express/)
[![Coverage Status](https://coveralls.io/repos/github/ghdna/athena-express/badge.svg?branch=master)](https://coveralls.io/github/ghdna/athena-express?branch=master)
[![Downloads](https://img.shields.io/npm/dt/athena-express.svg)](https://www.npmjs.com/package/athena-express)

###### _As published on the official [AWS Partner Network Blog](https://aws.amazon.com/blogs/apn/using-athena-express-to-simplify-sql-queries-on-amazon-athena/)_

## Synopsis

Athena-Express can simplify executing SQL queries in Amazon Athena **AND** fetching _cleaned-up_ JSON results in the same synchronous or asynchronous request - well suited for web applications.

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
7. Fetching results (rows) via Pagination OR as a continuous stream
8. Synchrnous and Asynchornous fetching of results (rows)

Integrating with Amazon Athena without `athena-express` would require you to identify the appropriate API methods in the AWS SDK, stich them together sequentially, and then build out an error handling & retry mechanism for each of those methods.

> `athena-express` can help you save time & effort in setting up this integration so that you can focus on core application development.

### How is athena-express being used?

The most common use case is integrating a web front-end with Amazon Athena using `athena-express` as a backend. This backend could be any Node.JS application that could be hosted locally, or on an EC2 instance, or AWS Lambda.

Here is an example using AWS Lambda:
<img src="https://image.ibb.co/k3RpNA/Screen-Shot-2018-11-22-at-11-17-58-AM.pngg" alt="athena-express architecture" width="700">

This architecture has a web front-end that invokes an API endpoint hosted on Amazon API Gateway by passing a query request. The query request can be as simple as `SELECT * FROM movies LIMIT 3`

This API Gateway then triggers a Lambda function that has the `athena-express` library imported.

## Setup

### Prerequisites

- You will need either an `IAM Role` (if you're running `athena-express` on AWS Lambda or AWS EC2) **OR** an `IAM User` with `accessKeyId` and `secretAccessKey` (if you're running `athena-express` on a standalone NodeJS application)
- This IAM role or user must have `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached
  - Note: As an alternative to granting `AmazonS3FullAccess` you could granularize and limit write access to a specific `bucket`. Just specify this bucket name during `athena-express` initialization

### Configuration

- `athena-express` needs an [AWS SDK V3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html) [Athena aggregated client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-athena/classes/athena.html) and an [S3 aggregated client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/s3.html), both created with relevant permissions as mentioned in the prerequisites above.
- These AWS SDK objects are passed within the constructor so that it can invoke Amazon Athena SDK. In most cases this is sufficient. The snippet of code that follows will work with these 4 configurations scenarios.
  1.  Use a shared credentials file, as is done with the AWS CLI (https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-shared.html)
  2.  OR if using Lambda, provide an [IAM execution role](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-lambda.html) with `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached
  3.  OR Use [instance profiles](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-iam.html) when using EC2s
  4.  OR Use [environment variables](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-environment.html)

```javascript
const athena = require("@aws-sdk/client-athena");
const s3 = require("@aws-sdk/client-s3");

const athenaExpressConfig = {
  athena: new athena.Athena({}),
  s3: new s3.S3({}),
}; //configuring athena-express with aws sdk object
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```

#### Simple configuration

- Simple configuration requires only the AWS Athena and S3 objects to be passed as a parameter to initialize `athena-express`
- Default values are assumed for all parameter options and `athena-express` creates a new `S3 bucket` in your AWS account for Amazon Athena to store the query results in.

```javascript
const athena = require("@aws-sdk/client-athena");
const s3 = require("@aws-sdk/client-s3");

const athenaExpressConfig = {
  athena: new athena.Athena({}),
  s3: new s3.S3({}),
}; //simple configuration with just an aws sdk object

//Initializing athena-express
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```

#### Advance configuration

- Besides the `Athena` and `S3` client paramaters and the `s3Bucket` parameter that are required, you can add any of the following optional parameters below

```javascript
const athena = require("@aws-sdk/client-athena");
const s3 = require("@aws-sdk/client-s3");

//Example showing all Config parameters.
const athenaExpressConfig = {
  athena: new athena.Athena({}), // required
  s3: new s3.S3({}), // required
  s3Bucket: "s3://mybucketname", // required
  db: "myDbName", // optional
  workgroup: "myWorkGroupName", // optional
  formatJson: true, // optional
  retry: 200, // optional
  getStats: true, // optional
  ignoreEmpty: true, // optional
  encryption: { EncryptionOption: "SSE_KMS", KmsKey: process.env.kmskey }, // optional
  skipResults: false, // optional
  waitForResults: false, // optional
  catalog: "hive", //optional
};

//Initializing AthenaExpress
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```

###### Advance config Parameters:

| Parameter      | Format  | Default Value      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s3Bucket       | string  | none               | The location in Amazon S3 where your query results are stored, such as `s3://path/to/query/bucket/`.                                                                                                                                                                                                                                                                                                                                                                          |
| db             | string  | `default`          | Athena database name that the SQL queries should be executed in. When a `db` name is specified in the config, you can execute SQL queries without needing to explicitly mention DB name. e.g. <br />` athenaExpress.query("SELECT * FROM movies LIMIT 3")` <br /> as opposed to <br />` athenaExpress.query({sql: "SELECT * FROM movies LIMIT 3", db: "moviedb"});`                                                                                                           |
| workgroup      | string  | `primary`          | The name of the workgroup in which the query is being started. <br /> Note: athena-express cannot create workgroups (as it includes a lot of configuration) so you will need to create one beforehand IFF you intend to use a non default workgroup. Learn More here. [Setting up Workgroups](https://docs.aws.amazon.com/athena/latest/ug/user-created-workgroups.html)                                                                                                      |
| formatJson     | boolean | `true`             | Override as false if you rather get the raw unformatted output from S3.                                                                                                                                                                                                                                                                                                                                                                                                       |
| retry          | integer | `200` milliseconds | Wait interval between re-checking if the specific Athena query has finished executing                                                                                                                                                                                                                                                                                                                                                                                         |
| getStats       | boolean | `false`            | Set `getStats: true` to capture additional metadata for your query, such as: <ul><li>`EngineExecutionTimeInMillis`</li><li>`DataScannedInBytes`</li><li>`TotalExecutionTimeInMillis`</li><li>`QueryQueueTimeInMillis`</li><li>`QueryPlanningTimeInMillis`</li><li>`ServiceProcessingTimeInMillis`</li><li>`DataScannedInMB`</li><li>`QueryCostInUSD`</li><li>`Count`</li><li>`QueryExecutionId`</li><li>`S3Location`</li></ul>                                                |
| ignoreEmpty    | boolean | `true`             | Ignore fields with empty values from the final JSON response.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| encryption     | object  | --                 | [Encryption configuation](https://docs.aws.amazon.com/athena/latest/ug/encryption.html) example usage: <br />`{ EncryptionOption: "SSE_KMS", KmsKey: process.env.kmskey}`                                                                                                                                                                                                                                                                                                     |
| skipResults    | boolean | `false`            | For a unique requirement where a user may only want to execute the query in Athena and store the results in S3 but NOT fetch those results in that moment. <br />Perhaps to be retrieved later or simply stored in S3 for auditing/logging purposes. <br />To retrieve the results, you can simply pass the `QueryExecutionId` into athena-express as such: `athenaExpress.query("ab493e66-138f-4b78-a187-51f43fd5f0eb")`                                                     |
| waitForResults | boolean | `true`             | When low latency is the objective, you can skip waiting for a query to be completed in Athena. Returns `QueryExecutionId`, which you can pass into athena-express later as such: `athenaExpress.query("ab493e66-138f-4b78-a187-51f43fd5f0eb")` <br /> Not to be confused with `skipResults`, which actually waits for the query to be completed before returning `QueryExecutionId` and other stats. `waitForResults` is meant for fire-and-forget kind of operations. <br /> |
| catalog        | string  | `null`             | The catalog to which the query results belong                                                                                                                                                                                                                                                                                                                                                                                                                                 |

###### Advance Query Parameters:

```javascript
//Example showing all Query parameters.
let myQuery = {
    sql: "SELECT * FROM elb_logs LIMIT 3" // required,
    db: "sampledb", // optional.
    pagination: 5, //optional
    NextToken: "ARfCDXRjMk...", //optional
    QueryExecutionId: "c274843b-4c5c-4ccf-ac8b-e33d595b927d", //optional
    catalog: "hive" //optional
};
```

| Parameter        | Format                   | Default Value          | Description                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sql              | string <br /> `required` |                        | The SQL query statements to be executed. <br /> E.g. "SELECT \* FROM elb_logs LIMIT 3                                                                                                                                                                                                                                                                                                       |
| db               | string <br />            | `default`              | The name of the database used in the query execution. <br /> You can specify the database name here within the query itself OR in athenaExpressConfig during initialization as shown in [Advance Config Parameters](https://github.com/ghdna/athena-express#advance-config-parameters)                                                                                                      |
| pagination       | string                   | `0` <br /> max: `1000` | Maximum number of results (rows) to return in a single paginated response. <br />Response includes results from page 1 along with `NextToken` and `QueryExecutionId` IFF the response was truncated <br /> To obtain the next set of pages, pass in the `NextToken` and `QueryExecutionId` back to Athena. <br /> See [example here](https://github.com/ghdna/athena-express#more-examples) |
| NextToken        | string                   | `null`                 | A token generated by the Athena service that specifies where to continue pagination if a previous request was truncated. To obtain the next set of pages, pass in the NextToken from the response object of the previous page call.                                                                                                                                                         |
| QueryExecutionId | string                   | `null`                 | The unique ID of the query execution. <br />To be passed into the AthenaExpress query when using the features of `Pagination`, `waitForResults` or `skipResults `                                                                                                                                                                                                                           |
| catalog          | string                   | `null`                 | The catalog to which the query results belong                                                                                                                                                                                                                                                                                                                                               |

## Usage: Invoking athena-express

###### Using Promises to query Athena:

```javascript
/*Option 1: object notation*/
let myQuery = {
  sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT ?" /* required */,
  QueryParams: [3],
  db: "sampledb" /* optional. You could specify a database here or in the advance configuration option mentioned above*/,
};

/*OR Option 2: string notation*/
let myQuery = "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3";

athenaExpress
  .query(myQuery)
  .then((results) => {
    console.log(results);
  })
  .catch((error) => {
    console.log(error);
  });
```

###### Using Async/Await to query Athena:

```javascript
(async () => {
  /*Option 1: object notation*/
  let myQuery = {
    sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT ?" /* required */,
    QueryParams: [3],
    db: "sampledb" /* optional. You could specify a database here or in the configuration constructor*/,
  };

  /*OR Option 2: string notation*/
  let myQuery =
    "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3";

  try {
    let results = await athenaExpress.query(myQuery);
    console.log(results);
  } catch (error) {
    console.log(error);
  }
})();
```

###### Using QueryExecutionID:

Applicable only if you already have the `QueryExecutionID` from an earlier execution. See `skipResults` or `waitForResults` in the advance config params above to learn more.

```javascript
const myQueryExecutionId = "bf6ffb5f-6c36-4a66-8735-3be6275960ae";
let results = await athenaExpress.query(myQueryExecutionId);
console.log(results);
```

## Full Examples

###### Using a standalone NodeJS application

```javascript
"use strict";

const AthenaExpress = require("athena-express"),
  athena = require("@aws-sdk/client-athena"),
  s3 = require("@aws-sdk/client-s3");

const athenaExpressConfig = {
  athena: new athena.Athena({}),
  s3: new s3.S3({}),
  s3Bucket: "s3://my-bucket-for-storing-athena-results-us-east-1",
  getStats: true,
};

const athenaExpress = new AthenaExpress(athenaExpressConfig);

//Invoking a query on Amazon Athena
(async () => {
  let myQuery = {
    sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT ?",
    QueryParams: [3],
    db: "sampledb",
  };

  try {
    let results = await athenaExpress.query(myQuery);
    console.log(results);
  } catch (error) {
    console.log(error);
  }
})();
```

###### Using AWS Lambda

```javascript
"use strict";

const AthenaExpress = require("athena-express"),
  athena = require("@aws-sdk/client-athena"),
  s3 = require("@aws-sdk/client-s3");

/* AWS Credentials are not required here 
    /* Make sure the IAM Execution Role used by this Lambda 
    /* has the necessary permission to execute Athena queries 
    /* and store the result in Amazon S3 bucket
    /* See configuration section above under Setup for more info */

const athenaExpressConfig = {
  athena: new athena.Athena({}),
  s3: new s3.S3({}),
  db: "sampledb",
  getStats: true,
};
const athenaExpress = new AthenaExpress(athenaExpressConfig);

exports.handler = async (event) => {
  const sqlQuery =
    "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT ?";

  try {
    let results = await athenaExpress.query(sqlQuery, [3]);
    return results;
  } catch (error) {
    return error;
  }
};
```

###### Results:

<img src="https://image.ibb.co/fpARNA/carbon-2.png" alt="Athena-Express result" width="400">

## More Examples

##### Pagination

###### Query to fetch results (rows) for page 1

```javascript
async function main() {
  const myQuery = {
    sql: "SELECT * from students LIMIT 100",
    pagination: 10,
  };
  let results = await athenaExpress.query(myQuery);
  console.log(results);
}
main();
```

This will fetch the first 10 results (rows) off the 100 that exits in Athena. To query the next 10 rows, pass the values for `NextToken` and `QueryExecutionId` that were returned in the first query.

###### Query to fetch results (rows) for page 2 and beyond

```javascript
async function main() {
  const myQuery = {
    sql: "SELECT * from students LIMIT 100",
    pagination: 10,
    NextToken:
      "ARfCDXRjMkQsR1NWziK1ARgiip3umf3q0/bZmNZWeQxUDc7iSToT7uJHy2yo8nL5FyxQoIIkuPh/zDD51xld7SoALA+zhMhpZg==",
    QueryExecutionId: "c274843b-4c5c-4ccf-ac8b-e33d595b927d",
  };
  let results = await athenaExpress.query(myQuery);
  console.log(results);
}
main();
```

##### UTILITY queries

###### Show Tables (single column result)

```javascript
const results = await athenaExpress.query("SHOW TABLES");
console.log(results);

//Output:
{
  Items: [{ row: "default" }, { row: "sampledb" }];
}
```

###### Describe Table (dual column result)

```javascript
const results = await athenaExpress.query("DESCRIBE elb_logs");
console.log(results);

//Output:
{
  Items: [
    { request_timestamp: "string" },
    { elb_name: "string" },
    { request_ip: "string" },
    { request_port: "int" },
    { backend_ip: "string" },
    { backend_port: "int" },
    { request_processing_time: "double" },
    { backend_processing_time: "double" },
    { client_response_time: "double" },
    { elb_response_code: "string" },
    { backend_response_code: "string" },
    { received_bytes: "bigint" },
    { sent_bytes: "bigint" },
    { request_verb: "string" },
    { url: "string" },
    { protocol: "string" },
    { user_agent: "string" },
    { ssl_cipher: "string" },
    { ssl_protocol: "string" },
  ];
}
```

## Contributors

[Gary Arora](https://twitter.com/AroraGary)

## License

MIT
