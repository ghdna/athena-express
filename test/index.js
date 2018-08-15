"use strict";

const expect = require("chai").expect,
	athenaExpress = require("..");

describe("Repository Structure", function() {
	it("should export AthenaExpress constructor directly from package", function() {
		expect(athenaExpress).to.be.a("function");
		expect(athenaExpress).to.equal(athenaExpress.AthenaExpress);
	});

	it("should export AthenaExpress constructor", function() {
		expect(athenaExpress.AthenaExpress).to.be.a("function");
	});
});
