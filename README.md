# Athena-Express: Simplifying SQL queries on Amazon Athena

[![NPM](https://nodei.co/npm/athena-express.png?compact=true)](https://nodei.co/npm/athena-express/)

[![Build Status](https://travis-ci.org/ghdna/athena-express.svg?branch=master)](https://travis-ci.org/ghdna/athena-express)
[![Code Climate](https://codeclimate.com/github/ghdna/athena-express/badges/gpa.svg)](https://codeclimate.com/github/ghdna/athena-express/)
[![Coverage Status](https://coveralls.io/repos/github/ghdna/athena-express/badge.svg?branch=master)](https://coveralls.io/github/ghdna/athena-express?branch=master)

## Synopsis

`athena-express` can simplify executing SQL queries in Amazon Athena **AND** fetch the JSON results in the same synchronous call - well suited for web applications. 


It's lightweight (~4KB uncompressed) and has zero dependencies.

##### Example:
![athena-express example](https://image.ibb.co/mX1wTK/Screen_Shot_2018_08_22_at_8_34_47_PM.png)





## Amazon Athena Background

[Amazon Athena](https://aws.amazon.com/athena/), launched at AWS re:Invent 2016, made it easier to analyze data in Amazon S3 using standard SQL. Under the covers, it uses [Presto](https://prestodb.io/), which is an opensource SQL engine developed by Facebook in 2012 to query their 300 Petabyte data warehouse. It's incredibly powerful!

Amazon Athena combines the strength of Presto with serverless & self-managed capabilities of AWS. By simply pointing Athena to your data in Amazon S3, one could start querying using standard SQL. Most results are delivered within seconds and there’s no need for complex ETL jobs to prepare your data for analysis. This makes it easy for anyone with SQL skills to quickly analyze large-scale datasets.

## How athena-express simplifies using Amazon Athena

`athena-express` simplifies integrating Amazon Athena with any Node.JS application - running as a standalone application or as a Lambda function. As a wrapper on AWS SDK, Athena-Express  bundles the following steps listed on the official [AWS Documentation](https://docs.aws.amazon.com/athena/latest/APIReference/Welcome.html):

1.	Initiates a query execution
2.	Keeps checking until the query has finished executing
3.	Fetches the results of the query execution from Amazon S3

And as added features

4.	Formats the results into a clean, user-friendly JSON array
5.	Handles errors by recursively retrying for `ThrottlingException`, `NetworkingError`, and `TooManyRequestsException`
6.	Provides optional helpful stats including cost per query in USD

Integrating with Amazon Athena without `athena-express` would require you to identify the appropriate API methods in the AWS SDK, stich them together sequentially, and then build out an error handling & retry mechanism for each of those methods. 

`athena-express` can help you save time & effort in setting up this integration so that you can focus on core application development. 


### How is athena-express being used?
The most common use case is integrating a web front-end with Amazon Athena using athena-express as a backend. This backend could be any Node.JS application including Lambda functions.

Here is an example application architecture with a Lambda function: 
![athena-express architecture](https://image.ibb.co/k3RpNA/Screen-Shot-2018-11-22-at-11-17-58-AM.png)

This architecture has a web front-end that invokes an API endpoint hosted on Amazon API Gateway by passing a query request. The query request can be as simple as `SELECT * FROM movies LIMIT 3`

This API Gateway then triggers a Lambda function that has the `athena-express` library imported. 


## Setup

### Prerequisites

-   You will need an `IAM Role` (if using `AWS Lambda` or `AWS EC2`) **OR** an `IAM User` with `accessKeyId` and `secretAccessKey` if using a standalone NodeJS application
-   This IAM role/user must have `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached 
    -   Note: As an alternative to granting `AmazonS3FullAccess` you could granularize and limit write access to a specific `bucket` that you must specify during `athena-express` initialization

### Configuration
- `athena-express` needs an AWS SDK object created with relevant permissions as mentioned in the prerequisites above.
- This AWS object is passed within the constructor so that it can invoke Amazon Athena SDK. It's up to you how you create this `aws` object. Here are few options: 
	1. Create an `aws` object by explicitly passing in the `accessKeyId` and `secretAccessKey` generated in prerequisites
	```javascript 
    const aws = require("aws-sdk");
    const awsCredentials = {
        region: "us-east-1",
        accessKeyId: "AKIAIHV5B6DGMEXVCXGA",
        secretAccessKey: "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"
    };
    aws.config.update(awsCredentials);

    const athenaExpressConfig = { aws }; //configuring athena-express with aws sdk object
    const athenaExpress = new AthenaExpress(athenaExpressConfig);
	```
	2. OR if using Lambda, provide an [IAM execution role](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/using-lambda-iam-role-setup.html) with `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached
 	```javascript 
    const aws = require("aws-sdk");
	const athenaExpressConfig = { aws }; //configuring athena-express with aws sdk object
    const athenaExpress = new AthenaExpress(athenaExpressConfig);
	```  
	3. OR Use [instance profiles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html) when using EC2s
	4. OR Use [environment variables](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html)



#### Option 1: Simple configuration

- Simple configuration requires only the AWS SDK object to be passed as a parameter to initialize `athena-express`
- Default values are assumed for all parameter options and `athena-express` creates a new `S3 bucket` in your AWS account for Amazon Athena to store the query results in.

```javascript
const AthenaExpress = require("athena-express"),
	aws = require("aws-sdk"),
	awsCredentials = { 
		region: "STRING_VALUE",
		accessKeyId: "STRING_VALUE",
		secretAccessKey: "STRING_VALUE"
	};

aws.config.update(awsCredentials);

//configuring athena-express with aws sdk object
const athenaExpressConfig = {
	aws, /* required */
};

//Initializing athena-express
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```


#### Option 2: Advance configuration

- Advance configuration specifies all parameters. 
- You can pick and choose any of the optional parameters below

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

Advance config Parameters:

-   `s3` - (String) S3 bucket name/prefix to store Athena query results
-   `db` - (String) Athena database that the SQL queries will be executed in

    ```javascript
    //So you can execute Athena queries simply by passing the SQL statement
    athenaExpress.query("SELECT * FROM movies LIMIT 3");

    //Instead of specifying the DB name in every query
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



## Usage: Invoking athena-express

###### Using Promises:

```javascript
let query = {
	sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3" /* required */,
	db: "sampledb" /* optional. You could specify a database here or in the advance configuration option mentioned above*/
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
![athena-express results](https://image.ibb.co/hA5RNA/Screen-Shot-2018-11-23-at-6-41-17-PM.png)

## Contributors

[Gary Arora](https://twitter.com/AroraGary)

## License

MIT
