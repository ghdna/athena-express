"use strict";

const rewire = require("rewire");
const chai = require("chai"),
    expect = chai.expect,
    helpers = rewire("../lib/helpers.js"),
    { DateTime } = require("luxon");

chai.should();

describe("helpers date conversions", () => {
    const addDataTypeFn = helpers.__get__('addDataType');

    it("should ignore date types if disabled in config", () => {
        let input = {"_col0":"2012-12-30 17:00:00.000 America/Los_Angeles"};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = addDataTypeFn(input, dataTypes, useUtcDates);

        expect(expected).to.deep.equal(input);
    });

    it("should ignore useUtcDates flag when there are no dates", () => {
        let input = {"_col0":"1000"};
        let dataTypes = {"_col0":"real"};

        expect(addDataTypeFn(input, dataTypes, true)).to.deep.equal(addDataTypeFn(input, dataTypes, false));
    });

    it("should transform a date input and assume it's UTC", () => {
        let value = "2012-12-30";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"date"};
        let useUtcDates = true;
        let expected = "2012-12-30T00:00:00.000Z";
        let output = addDataTypeFn(input, dataTypes, useUtcDates);

        expect(output['_col0'].toISOString()).to.deep.equal(expected);
    });

    it("should transform a timestamp without time zone input", () => {
        let value = "2012-12-30 00:00:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp"};
        let useUtcDates = true;
        let expected = "2012-12-30T00:00:00.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output['_col0'].toISOString()).to.deep.equal(expected);
    });

    it("should transform a timestamp with UTC time zone input", () => {
        let value = "2012-12-31 01:00 UTC";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2012-12-31T01:00:00.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform a timestamp with Z (UTC) time zone input", () => {
        let value = "2012-12-31 01:00:00Z";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2012-12-31T01:00:00.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should not transform a timestamp with GMT ISO time zone input since is not valid SQL syntax", () => {
        let value = "2012-12-31 01:00 GMT+1";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(input);
    });

    it("should ignore time with timezone", () => {
        let value = "15:00:07.656 UTC";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"time with time zone"};
        let useUtcDates = true;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should transform a timestamp with offset time zone input", () => {
        let value = "2012-12-31 01:00 +01:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2012-12-31T00:00:00.000Z"

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should ignore time", () => {
        let value = "15:56:22.008";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"time"};
        let useUtcDates = true;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime", () => {
        let value = "2021-07-19 16:01:35.000";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp"};
        let useUtcDates = true;
        let expected = "2021-07-19T16:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime with UTC", () => {
        let value = "2021-07-19 16:01:35.000 UTC";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2021-07-19T16:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime with UTC+1", () => {
        let value = "2021-07-19 16:01:35.000 +01:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2021-07-19T15:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime with UTC+8", () => {
        let value = "2021-07-19 16:01:35.000 +08:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2021-07-19T08:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime with UTC-6", () => {
        let value = "2021-07-19 16:01:35.000 -06:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2021-07-19T22:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime with UTC+12 (yesterday)", () => {
        let value = "2021-07-19 04:01:35.000 +12:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2021-07-18T16:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime with UTC-12 (tomorrow)", () => {
        let value = "2021-07-20 16:01:35.000 -12:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = "2021-07-21T04:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should transform the output of from_unixtime with America/Los_Angeles", () => {
        let value = "2021-07-19 16:01:35.000 America/Los_Angeles";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = true;
        let expected = DateTime.fromSQL(value).isInDST ? "2021-07-19T23:01:35.000Z" : "2021-07-20T00:01:35.000Z";

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output["_col0"].toISOString()).to.deep.equal(expected);
    });

    it("should not transform a date input when disabled", () => {
        let value = "2012-12-30";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"date"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform a timestamp without time zone input when disabled", () => {
        let value = "2012-12-30 00:00:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform a timestamp with UTC time zone input when disabled", () => {
        let value = "2012-12-31 01:00 UTC";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should transform a timestamp with Z (UTC) time zone input when disabled", () => {
        let value = "2012-12-31 01:00:00Z";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should transform a timestamp with GMT ISO time zone input when disabled", () => {
        let value = "2012-12-31 01:00 GMT+1";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should ignore time with timezone when disabled", () => {
        let value = "15:00:07.656 UTC";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"time with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should transform a timestamp with offset time zone input when disabled", () => {
        let value = "2012-12-31 01:00 +01:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should ignore time when disabled", () => {
        let value = "15:56:22.008";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"time"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform the output of from_unixtime when disabled", () => {
        let value = "2021-07-19 16:01:35.000";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform the output of from_unixtime with UTC when disabled", () => {

        let value = "2021-07-19 16:01:35.000 UTC";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform the output of from_unixtime with GMT+1 when disabled", () => {
        let value = "2021-07-19 16:01:35.000 +01:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform the output of from_unixtime with GMT+8 when disabled", () => {
        let value = "2021-07-19 16:01:35.000 +08:00";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform the output of from_unixtime with America/Los_Angeles when disabled", () => {
        let value = "2021-07-19 16:01:35.000 America/Los_Angeles";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        let output = addDataTypeFn(input, dataTypes, useUtcDates);
        expect(output).to.deep.equal(expected);
    });

    it("should not transform the output to UTC when no offset is provided", () => {
        let value = "2021-07-19 16:01:35.000";
        let input = {"_col0":value};
        let dataTypes = {"_col0":"timestamp with time zone"};
        let useUtcDates = false;
        let expected = {"_col0":value};

        expect(addDataTypeFn(input, dataTypes, useUtcDates)).to.deep.equal(expected);
    });
});

describe("helpers ICU support", () => {
    const icuSupport = helpers.__get__('icuSupport');

    it("should return true for v13 since ICU is now included", () => {
       const supported = icuSupport({'versions': {'node': '13.0.0'}});
       expect(supported).to.equal(true);
    });

    it("should return true for v13+ since ICU is now included", () => {
       const supported = icuSupport({'versions': {'node': '16.0.0'}});
       expect(supported).to.equal(true);
    });

    it("should return true for v12 if ICU is included", () => {
       const supported = icuSupport({'versions': {'node': '12.0.0', 'icu': '69.0'}});
       expect(supported).to.equal(true);
    });

    it("should return false for v12- since ICU is not included", () => {
       const supported = icuSupport({'versions': {'node': '11.0.0'}});
       expect(supported).to.equal(false);
    });
});
