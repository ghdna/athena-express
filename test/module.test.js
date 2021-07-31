"use strict";

const chai = require("chai"),
	expect = chai.expect,
	AthenaExpress = require(".."),
	aws = require("aws-sdk");

chai.should();
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);
const helpers = require("../lib/helpers.js");

describe("Negative Scenarios", () => {
	it("should not have config object undefined", function() {
		expect(function() {
			new AthenaExpress();
		}).to.throw(TypeError, "Config object not present in the constructor");
	});
	it("should not have aws object undefined", function() {
		expect(function() {
			const athenaExpress = new AthenaExpress({});
		}).to.throw(
			TypeError,
			"AWS object not present or incorrect in the constructor"
		);
	});
});

describe("Async Iterable (queryIterable)", () => {
	it('should return an async iterable that go over all existing page until the end', async () => {
		stub(helpers, 'startQueryExecution').resolves('query id xxx');
		stub(helpers, 'checkIfExecutionCompleted').resolves({
			QueryExecution: {
				ResultConfiguration: {
					OutputLocation: 'S3 path with query result.csv',
				},
                StatementType: 'statementType value',
				Statistics: {
					DataScannedInBytes: 10000,
				}
			},
		});
		let state = 0;
		stub(helpers, 'getQueryResultsFromS3').callsFake(async () => {
			state++;
			switch (state) {
				case 1:
					return {
						items: [1, 2, 3],
						nextToken: 'p2',
					};
				case 2:
					return {
						items: [4, 5, 6],
						nextToken: 'p3',
					}
				default:
					return {
						items: [7, 8],
					}
			}
		});
		stub(helpers, 'validateConstructor');
		const target = new AthenaExpress({
			aws: {
				Athena: class {},
				S3: class {},
				config: {
					credentials: {
						accessKeyId: 'fake access id',
					},
				},
			},
		});
		stub(target, 'query').callThrough();

		const iterable = target.queryIterable('sql statement');
		const result = [];
		for await (const page of iterable) {
			result.push(...page.Items);
		}

		expect(target['query']).to.have.been.calledWithExactly({ sql: 'sql statement', pagination: 999 });
		expect(target['query']).to.have.been.calledWithExactly({ sql: 'sql statement', pagination: 999, NextToken: 'p2', QueryExecutionId: 'query id xxx' });
		expect(target['query']).to.have.been.calledWithExactly({ sql: 'sql statement', pagination: 999, NextToken: 'p3', QueryExecutionId: 'query id xxx' });
		expect(target['query']).to.have.been.callCount(3);
		expect(result).to.be.eql([1, 2, 3, 4, 5, 6, 7, 8]);
	});
})