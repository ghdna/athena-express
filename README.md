# Athena-Express: Simplify SQL queries on Amazon Athena

[![NPM](https://nodei.co/npm/athena-express.png?compact=true)](https://nodei.co/npm/athena-express/)

[![Build Status](https://travis-ci.org/ghdna/athena-express.svg?branch=master)](https://travis-ci.org/ghdna/athena-express)
[![Code Climate](https://codeclimate.com/github/ghdna/athena-express/badges/gpa.svg)](https://codeclimate.com/github/ghdna/athena-express/)
[![Coverage Status](https://coveralls.io/repos/github/ghdna/athena-express/badge.svg?branch=master)](https://coveralls.io/github/ghdna/athena-express?branch=master)

## Synopsis

athena-express makes it easier to execute SQL queries on Amazon Athena by chaining together a bunch of methods in the AWS SDK. This allows you to execute SQL queries **AND** fetch JSON results in the same synchronous call - well suited for web applications. 


It's lightweight (~4KB uncompressed) and has zero dependencies.

##### Example:
![athena-express example](https://image.ibb.co/mX1wTK/Screen_Shot_2018_08_22_at_8_34_47_PM.png)

## Motivation

[Amazon Athena](https://aws.amazon.com/athena/), launched at AWS re:Invent 2016, made it easier to analyze data in Amazon S3 using standard SQL. Under the covers, it uses [Presto](https://prestodb.io/), which is an opensource SQL engine developed by Facebook in 2012 to query their 300 Petabyte data warehouse. It's incredibly powerful!

**Good News** is that Amazon Athena combines the colossal strength of Presto with serverless & self-managed capabilities of AWS

**Not So Good News** is that using Amazon Athena via the AWS' SDK requires too many moving parts to setup including the manual error handling.

**Enter athena-express!**

athena-express essentially bundles following steps as listed on the official [AWS Documentation](https://docs.aws.amazon.com/athena/latest/APIReference/Welcome.html):

- Start a query execution
- Keep checking until the said query has finished executing
- Fetch the results of said query execution from Amazon S3

And as an added bonus

- Format the results into a clean, friendly JSON array
- Handle Athena errors by recursively retrying for `ThrottlingException`, `NetworkingError`, and `TooManyRequestsException`
- Provides helpful stats including cost per query in USD

## Prerequisites

-   You will need an `IAM Role` (if executing from `AWS Lambda`) **OR** an `IAM User` with `accessKeyId` and `secretAccessKey`
-   This IAM role/user must have at least `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached to its permissions
    -   As an alternative to granting `AmazonS3FullAccess` you could granularize the policy to a specific bucket that you must specify during athena-express initialization

## Configuration Options
Athena-Express needs an AWS SDK object (created with the relevant permissions) passed within the constructor so that it can trigger Athena SDK. It's up to you how you create this `aws` object. Few options: 
- Create an aws object by explicitly passing in the `secretAccessKey` and `accessKeyId` as shown in the options below
- OR Use [IAM roles](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/using-lambda-iam-role-setup.html) - when using Lambda - see full example below  
- OR Use [instance profiles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html) when using EC2s
- OR Use [environment variables](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html)



#### Simple Configuration

Simple Configuration requires only the AWS SDK object to be passed as a parameter to initialize Athena Express. Default values are assumed for all other parameter options and AthenaExpress creates a new `S3 bucket` in your AWS account for Amazon Athena to store the query results in.

```javascript
const AthenaExpress = require("athena-express"),
	aws = require("aws-sdk"),
	awsCredentials = { 
		region: "STRING_VALUE",
		accessKeyId: "STRING_VALUE",
		secretAccessKey: "STRING_VALUE"
	};

aws.config.update(awsCredentials);

//AthenaExpress config object
const athenaExpressConfig = {
	aws, /* required */
};

//Initializing AthenaExpress
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```


#### Advance Configuration:

All parameters 

```javascript
const AthenaExpress = require("athena-express"),
	aws = require("aws-sdk"),
	awsCredentials = { 
		region: "STRING_VALUE",
		accessKeyId: "STRING_VALUE",
		secretAccessKey: "STRING_VALUE"
	};

aws.config.update(awsCredentials);

//AthenaExpress config object
const athenaExpressConfig = {
	aws, /* required */
	s3: "STRING_VALUE", /* optional */
    db: "STRING_VALUE", /* optional */
	formatJson: BOOLEAN, /* optional default=true */
	retry: Integer, /* optional default=200 */
    getStats: BOOLEAN /* optional default=false */
};

//Initializing AthenaExpress
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```

Advance Config Parameters:

-   `s3` - (String) S3 bucket name/prefix to store athena results
-   `db` - (String) Set the Athena database name here to execute all succeeding athena queries.

    ```javascript
    //So you can execute Athena queries simply by passing the SQL statement
    athenaExpress.query("SELECT * FROM movies LIMIT 3");

    //Instead of SQL & DB object
    athenaExpress.query({
    	sql: "SELECT * FROM movies LIMIT 3",
    	db: "moviedb"
    });
    ```
  -   `formatJson` - (Boolean default `true`) Override as false if you rather get the raw unformatted JSON from Athena. 
-   `retry` - (Integer default `200` milliseconds) Interval between re-checking if the specific Athena query has finished executing
-   `getStats` - (Boolean default `false`) Get stats for your query. These stats include data scanned in megabytes, athena execution time in milliseconds, item count, and query cost in USD based on the [Athena Pricing Documentation](https://aws.amazon.com/athena/pricing/). Example:
```javascript
{  
	DataScannedInMB: 6,
	QueryCostInUSD: 0.00004768,
	EngineExecutionTimeInMillis: 2234,
	Count: 5,
   	Items: [  
      {  
         ...
      },
   ]
}
```



## Usage

###### Using Promises:

```javascript
let query = {
	sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3" /* required */,
	db: "sampledb" /* optional. You could specify a database here or in the configuration constructor*/
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
		sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3" /* required */,
		db: "sampledb" /* optional. You could specify a database here or in the configuration constructor*/
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
"use strict";

const AthenaExpress = require("athena-express"),
	aws = require("aws-sdk"),
	awsCredentials = {
		region: "us-east-1",
		accessKeyId: "AKIAIHV5B6DGMEXVCXGA",
		secretAccessKey: "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"
	};

aws.config.update(awsCredentials);

const athenaExpressConfig = {
	aws,
	s3: "s3://my-bucket-for-storing-athena-results-us-east-1",
    getStats: true
};

const athenaExpress = new AthenaExpress(athenaExpressConfig);

//Invoking a query on Amazon Athena
(async () => {
	let query = {
		sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3",
		db: "sampledb",
		getStats: true 
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
"use strict";

const AthenaExpress = require("athena-express"),
	aws = require("aws-sdk");

	/* AWS Credentials are not required here 
    /* because the IAM Role assumed by this Lambda 
    /* has the necessary permission to execute Athena queries 
    /* and store the result in Amazon S3 bucket */

const athenaExpressConfig = {
	aws,
	db: "sampledb",
	getStats: true
};
const athenaExpress = new AthenaExpress(athenaExpressConfig);

exports.handler = async (event, context, callback) => {
	const sqlQuery = "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3";

	try {
		let results = await athenaExpress.query(sqlQuery);
		callback(null, results);
	} catch (error) {
		callback(error, null);
	}
};
```

###### Results:

```javascript
{ Items:
   [ { elb_name: 'elb_demo_002',
       request_port: '26144',
       request_ip: '240.220.175.143' },
     { elb_name: 'elb_demo_008',
       request_port: '25515',
       request_ip: '244.189.63.245' },
     { elb_name: 'elb_demo_008',
       request_port: '26779',
       request_ip: '249.110.119.93' },
     { elb_name: 'elb_demo_005',
       request_port: '2208',
       request_ip: '243.70.142.250' },
     { elb_name: 'elb_demo_006',
       request_port: '11341',
       request_ip: '245.231.42.125' } ],
  DataScannedInMB: 3,
  QueryCostInUSD: 0.00004768,
  EngineExecutionTimeInMillis: 2172,
  Count: 5 }
```

## Contributors

[Gary Arora](https://twitter.com/AroraGary)

## License

MIT
