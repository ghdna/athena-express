
# Athena-Express: Simplify SQL queries on Amazon Athena

## Synopsis

Athena-Express makes it easier to execute SQL queries on Amazon Athena and returns the response in a neatly formatted JSON array. 

It's lightweight (~4KB uncompressed) and has zero dependencies.

**Example:**
```javascript
athenaExpress.executeQuery("SELECT * FROM movies LIMIT 3");
```
**Response:**
```javascript
[{name: "Mission: Impossible Fallout", year: "2018"},
 {name: "Captain America: Civil War", year: "2016"},
 {name: "Star Wars: The Last Jedi", year: "2017"}]
```


## Motivation

[Amazon Athena](https://aws.amazon.com/athena/), launched at AWS re:Invent 2016, made it easier to analyze data in Amazon S3 using standard SQL. Under the covers, it uses [Presto](https://prestodb.io/), which is an opensource SQL engine developed by Facebook in 2012 to query their 300 Petabyte data warehouse. It's incredibly powerful!

**Good News** is that Amazon Athena combines the colossal strength of Presto with  serverless & self-managed capabilities of AWS

**Not So Good News** is that using Amazon Athena via the AWS' SDK requires too many moving parts to setup including the manual error handling. 

**Enter Athena-Express!**

Athena-Express essentially bundles following steps as listed on the official [AWS Documentation](https://docs.aws.amazon.com/athena/latest/APIReference/Welcome.html):
1. Start a query execution
2. Keep checking until the said query has finished executing
3. Fetch the results of said query execution from Amazon S3

And as an added bonus
4. Format the results into a clean, friendly JSON array
5. Handle common Athena errors



## Prerequisites 

- You will need an `IAM Role` (if executing from `AWS Lambda`) **OR** an `IAM User` with `accessKeyId` and `secretAccessKey`
- This IAM role/user must have at least `AmazonAthenaFullAccess` and `AmazonS3FullAccess` policies attached to its permissions
  * As an alternative to granting `AmazonS3FullAccess` you could granularize the policy to a specific bucket that you must specify during Athena-Express initialization  


## Configuration & Initialization options
#### Zero config mode:
In zero config mode, AthenaExpress creates a new `S3 bucket` in your AWS account for Amazon Athena to store the query results in. 
```javascript
const AthenaExpress = require("athena-express"),
	aws = require("aws-sdk"),
	awsCredentials = { /* required */
		region: "STRING_VALUE",
		accessKeyId: "STRING_VALUE",
		secretAccessKey: "STRING_VALUE",
	};

aws.config.update(awsCredentials);

//Initializing AthenaExpress with zero configuration
const athenaExpress = new AthenaExpress({ aws });
```


#### Minimal config mode: (recommended)
In minimal config mode, you specify an `S3 bucket` in your AWS account for Amazon Athena to store the query results in. 
```javascript
const AthenaExpress = require("athena-express"),
	aws = require("aws-sdk"),
	awsCredentials = { /* required */
		region: "STRING_VALUE",
		accessKeyId: "STRING_VALUE",
		secretAccessKey: "STRING_VALUE"
	};

aws.config.update(awsCredentials);

//AthenaExpress config object
const athenaExpressConfig = { 
	aws, /* required */
	s3: "STRING_VALUE"
};

//Initializing AthenaExpress with minimal configuration
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```
Minimum Config Parameters:
- `s3` - (String) S3 bucket name/prefix you want created in your AWS account. e.g. `s3://my-bucket-us-east-1`


#### Advance config mode:
All config options
```javascript
//AthenaExpress config object
const athenaExpressConfig = {
	aws, /* required */
	s3: "STRING_VALUE", 
    formatJson: BOOLEAN, 
    retry: Integer, 
    db: "STRING_VALUE"
};

//Initializing AthenaExpress with all configuration options
const athenaExpress = new AthenaExpress(athenaExpressConfig);
```
Advance Config Parameters:
- `s3` - (String) S3 bucket name/prefix you want created in your AWS account
- `formatJson` - (Boolean) default value is true. Override as false if you rather get the raw unformatted JSON from Athena
- `retry` - (Integer) default value is 200 (milliseconds) of interval to keep checking if the specific Athena query has finished executing
- `db` - (String) Set the Athena database name here to execute athena queries without needing to specify a `db` everytime during execution. 
   ```javascript 
   //So you can execute Athena queries simply by passing the SQL statement
   athenaExpress.executeQuery("SELECT * FROM movies LIMIT 3");  
  
  //Instead of SQL & DB object
  athenaExpress.executeQuery({
		sql: "SELECT * FROM movies LIMIT 3",
		db: "moviedb"
   });  
  ``` 


## Usage
###### Using Promises:
```javascript
let query = {
	sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3", /* required */
	db: "sampledb" /* assumes 'default' database if not specified here  */
};

athenaExpress
	.executeQuery(query)
	.then(results => { console.log(results); })
	.catch(error => { console.log(error); });
```

###### Using Async/Await:
```javascript
(async () => {
	let query = {
		sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3", /* required */
		db: "sampledb" /* assumes 'default' database if not specified here  */
	};

	try {
		let results = await athenaExpress.executeQuery(query);
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
    s3: "s3://my-bucket-for-storing-athena-results-us-east-1"
};

//Initializing AthenaExpress with minimal configuration
const athenaExpress = new AthenaExpress(athenaExpressConfig);

//Invoking a query on Amazon Athena
(async () => {
    let query = {
        sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3", 
        db: "sampledb" 
    };

    try {
        let results = await athenaExpress.executeQuery(query);
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
    /* but the IAM Role assumed by this Lambda 
    /* must have the necessary permission to execute Athena queries 
    /* and store the result in Amazon S3 bucket */
    
const athenaExpressConfig = {
	aws,
	s3: "s3://my-bucket-for-storing-athena-results-us-east-1"
};

//Initializing AthenaExpress with minimal configuration
const athenaExpress = new AthenaExpress(athenaExpressConfig);

exports.handler = async (event, context, callback) => {
	let query = {
		sql: "SELECT elb_name, request_port, request_ip FROM elb_logs LIMIT 3",
		db: "sampledb"
	};

	try {
		let results = await athenaExpress.executeQuery(query);
		callback(null, results);
	} catch (error) {
		callback(error, null);
	}
};
```

###### Results:
```javascript
	[{
		elb_name: "elb_demo_005",
		request_port: "8222",
		request_ip: "245.85.197.169"
	},
	{
		elb_name: "elb_demo_003",
		request_port: "24615",
		request_ip: "251.165.102.100"
	},
	{
		elb_name: "elb_demo_007",
		request_port: "24251",
		request_ip: "250.120.176.53"
	}]
```



## Contributors

[Gary Arora](https://twitter.com/AroraGary)

## License

MIT