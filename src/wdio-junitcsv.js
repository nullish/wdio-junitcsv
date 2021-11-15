// TODO: try https://www.npmjs.com/package/xpath

const fs = require('fs')
const path = require('path')
const joinxmlfiles = require('joinxmlfiles');
const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath');
const colors = require("colors"); // for colourising console output
const {
    v4: uuidv4
} = require('uuid');
const stripAnsi = require('strip-ansi');

const junitcsv = (dir) => {

const xmlInput = joinxmlfiles(dir);
const testSuites = xpath.select('//testsuite', xmlInput);

 /* construction to use for parsing test suites
 let f = xpath.select('//testsuite/properties/property[@name="file"]', xmlInput);
f.forEach(f => { console.log(f.getAttribute("value")) });

test for undefined
test = typeof(unv) == 'undefined' ? '' : unv;

*/   
    // Array to hold output.
    const out = [];
    // Header row
    //out.push('"UUID","uniqueId","specPath","scriptId","testId","suiteName","initialPath","browserName","platformName","deviceName","orientation","testName","state","errorType","error","expectedURL","actualURL","imageVariance","start","end","duration"');

    for (suite of testSuites) {
        var startTime = suite.getAttribute('timestamp');
        var duration = suite.getAttribute('time');
        var props = suite.getElementsByTagName('property');
        for (i = 0; i < props.length; i++) {
            switch (props[i].getAttribute('name')) {
                case 'suiteName':
                var suiteName = props[i].getAttribute('value');
                break;

                case 'capabilities':
                var capabilities = props[i].getAttribute('value');
                break;

                case 'file':
                var specPath = props[i].getAttribute('value');
                break;
            }
        }
        // var specURI = run.specs[0];
        var specPath = specURI.replace(/\/[a-zA-Z0-9()_-]*?\.js/, ""); // Extracts directory from test spec absolute file path.
        // Select platform name based on which variant of field is populated.
        platformName = typeof(platformName) !== 'undefined' ? platformName : run.capabilities.platform
        var deviceName = getMobileDevice(run.capabilities);
        var orientation = checkExist(run.capabilities.orientation);
        var suites = run.suites;
        for (suite of suites) {
            var suiteName = suite.name;
            var suiteURI = getSuiteURI(specURI);
            var tests = suite.tests;
            for (test of tests) {
                var testName = test.name;
                var state = test.state;
                var errorType = checkExist(test.errorType);
                var error = reformatError(checkExist(test.error));
                var urlActual = getAssertionURLs(errorType, test.error).actual;
                var urlExpected = getAssertionURLs(errorType, test.error).expected;
                var imageVariance = getImageVariance(checkExist(test.error));
                var timeUuid = uuidv4(); // timestamp based univeral unique identififier
                var ids = constructUID(suiteName, testName, browserName, platformName, deviceName)
                var uniqueId = ids.uid
                var scriptId = ids.scriptId
                var testId = ids.testId
                var suiteEls = [timeUuid, uniqueId, specPath, scriptId, testId, suiteName, suiteURI, browserName, platformName, deviceName, orientation, testName, state, errorType, error, urlExpected, urlActual, imageVariance, startTime, endTime, duration];
                line = '"' + suiteEls.join('","') + '"';
                out.push(line);
            }
        }
    }
    // Output
    csv = out.join('\n');

    if (!suppress) {
        console.log(csv);
    }

    if (dir) {
        // If directory parameter has been set, also output list of scripts that haven't run
        console.log(`\n\n"EXCEPTIONS NOT RUN"`);
        const scriptFiles = getFileList(dir, true);
        let exceptions = arrayDiff(scriptFiles, scriptList);
        exceptions = exceptions.join("\n");
        console.log(exceptions); // append list of files not run due to connection drop to end of report.
    }
}

function getSuiteURI(specFile) {
    // Extracts initial file URI from test script JS file
    const scriptText = fs.readFileSync(specFile).toString();
    let initURI;
    try {
        initURI = scriptText.match(/(?<=browser\.url\(shuDomain \+ ').*?(?='\))/)[0];
    } catch (e) {
        initURI = "";
    }
    return initURI;
}

function getFileList(dir) {
    // Get list of files from specified directory
    const fileNames = fs.readdirSync(dir);
    let fileArray = [];
    var i = 0;
    fileNames.forEach(fileName => {
        fileArray.push(fileName.replace(/\..*/g, ""));
    });
    return fileArray;
}

function arrayDiff(arrX, arrY) {
    // returns elements in array X that do not appear in array Y
    arrDiff = arrX.filter(elX => !arrY.includes(elX));
    return arrDiff;
}

function getMobileDevice(e) {
    // Gets mobile device name and model depending on how it's captured in capabilities object.
    var deviceName;
    if (typeof(e.deviceManufacturer) !== 'undefined') {
        deviceName = e.deviceManufacturer + ' ' + e.deviceModel;
    } else if (typeof(e.deviceName) !== 'undefined') {
        deviceName = e.deviceName;
    } else {
        deviceName = '';
    }
    return deviceName;
};

function checkExist(e) {
    // Check if attribute exists in JS object and return empty string if not
    if (typeof(e) == 'undefined') {
        return "";
    } else {
        return e;
    }
}

function reformatError(e) {
	// Removes control characters, commas and inverted commas to prevent borken column delimiting.
	if (e.length = 0) {
		return "";
	} else {
		let rErr = stripAnsi(e);
		rErr = rErr.replace(/\n/g, '');
		rErr = rErr.replace(/"|,/g, ' ');
		return rErr;
	}
}

function constructUID(scriptName, testName, browserName, platformName, deviceName) {
    // Construct uinique identifier for reports, combining suite, test and capabilities details.
    var scriptId = scriptName.match(/(?<=^T|P)[0-9]+/);
    if (scriptId !== null) {
        scriptId = scriptId.toString();
        scriptId = "T" + scriptId.padStart(2, 0);
    } else {
        scriptId = "";
    }
    let shouldAssert = testName.match(/^S[0-9]+/g)[0];

    let browserPfx = makePrefix(browserName);
    let platformPfx = makePrefix(platformName);
    let devicePfx = makePrefix(deviceName);

    let uid = `${scriptId}:${shouldAssert}:${browserPfx}:${platformPfx}:${devicePfx}`;

    return {
        "uid": uid,
        "scriptId": scriptId,
        "testId": shouldAssert
    };

    function makePrefix(str) {
        let pfx = "";
        if (str) {
            pfx = str.match(/^.{3}/g).toString();
        } else {
            pfx = "";
        }
        return pfx;
    }
};

function getImageVariance(errDetail) {
    /* Receives wdio error message. If the message contains image comparison variane from baseline 
    the function returns the the value of the variance. */
    var ivary = errDetail.match(/(?<=Received:\s{1,}\u001b\[31m)[0-9]{1,}/g);
    if (!ivary) {
        ivary = "";
    } else {
        ivary = ivary.toString();
    }
    return ivary;
}

function getAssertionURLs(errType, errDetail = "") {
    // Receives assertion error type and detailm, and returns expected and actual URLs.
    function removeDomain(inUrl = "") {
        if (inUrl.match(/https?:.*?\/{2}.*?\//)) {
            let outUrl = "/" + inUrl.replace(/https?:.*?\/{2}.*?\//, "");
            return outUrl
        } else {
            return "";
        }
    }
    let urlActual = "";
    let urlExpected = "";
    if (errDetail.match(/(?<=").*?(?=")/g) && errDetail.includes("Expect window to have url containing")) {
        const urls = errDetail.match(/(?<=").*?(?=")/g);
        urlExpected = stripAnsi(urls[0]);
        urlActual = stripAnsi(removeDomain(urls[1]));
    }
    return {
        "expected": urlExpected,
        "actual": urlActual
    }
}

junitcsv('../reports/');
module.exports = jsontocsv;