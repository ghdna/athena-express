var clientConfig = {
	bucketUri: "s3://aws-athena-query-results-919476868523-us-east-1"
};

var awsConfig = {
	region: "us-east-1",
	accessKeyId: "AKIAJZX5UJVWZ6DI7BFQ",
	secretAccessKey: "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"
};

var athena = require("athena-client");
var client = athena.createClient(clientConfig, awsConfig);

console.time("Athena");
client.execute("SHOW DATABASES", function(err, data) {
	if (err) {
		return console.error(err);
	}
	console.timeEnd("Athena");
	console.log(data);
});
