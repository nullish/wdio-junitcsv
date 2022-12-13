/**
* Translates a DOM object of webdriver Junit test reports into CSV
* and outputs to STDOUT
* @param {string} dir - directory of junit repoort XML files
*/

const fs = require('fs');
const joinxmlfiles = require('joinxmlfiles');
const xpath = require('xpath');
const {
    v4: uuidv4,
} = require('uuid');
const stripAnsi = require('strip-ansi');

const wdioJunitCsv = (...args) => {
const dir = args[0] || process.argv[2];
const xmlInput = joinxmlfiles(dir); // execute module to to join XML files into single DOM object
const testSuites = xpath.select('//testsuite', xmlInput);
    // Array to hold output.
    const out = [];
    // Header row
    out.push('"UUID","uniqueId","specPath","scriptId","testId","suiteName","browserName","platformName","deviceName","testName","state","error","errorType","urlExpected","urlActual","imageVariance","start","duration"');

    for (suite of testSuites) {
        const startTime = suite.getAttribute('timestamp');
        const duration = suite.getAttribute('time');
        const props = suite.getElementsByTagName('property');
        for (i = 0; i < props.length; i++) {
            switch (props[i].getAttribute('name')) {
                case 'suiteName':
                var suiteName = props[i].getAttribute('value');
                break;

                case 'capabilities':
                var capabilities = props[i].getAttribute('value');
                break;

                case 'file':
                var specURI = props[i].getAttribute('value');
                break;
            }
        }
        const specPath = specURI.replace(/\/[a-zA-Z0-9()_-]*?\.js/, ""); // Extracts directory from test spec absolute file path.
        const arrCapabilities = capabilities.split('.');
        const browserName = arrCapabilities[1].match(/^([0-9]|_)+$/) ? arrCapabilities[0] : '';
        const platformName = arrCapabilities[1].match(/^([0-9]|_)+$/) ? arrCapabilities[2] : arrCapabilities[1];
        const deviceName = getDeviceName(arrCapabilities);
        const testCases = suite.getElementsByTagName('testcase');
        for (i=0; i<testCases.length; i++) {
            const testName = testCases[i].getAttribute('name');
            const elState = testCases[i].getElementsByTagName('failure');
            const state = elState.length > 0 ? "failed" : "passed";
            if (state == 'failed') {
                var error = reformatError(testCases[i].getElementsByTagName('error')[0].getAttribute('message'));
            } else {
                var error = "";
            }
            const timeUuid = uuidv4(); // timestamp based univeral unique identififier
            const ids = constructUID(suiteName, testName, browserName, platformName, deviceName);
            const uniqueId = ids.uid;
            const scriptId = ids.scriptId;
            const testId = ids.testId;
            const errorType = getErrorType(error);
            const urlActual = getAssertionURLs(error).actual;
            const urlExpected = getAssertionURLs(error).expected;
            const imageVariance = getImageVariance(checkExist(error));
            const suiteEls = [timeUuid, uniqueId, specPath, scriptId, testId, suiteName, browserName, platformName, deviceName, testName, state, error, errorType, urlExpected, urlActual, imageVariance, startTime, duration];
            line = '"' + suiteEls.join('","') + '"';
            out.push(line);
        }
    }
    // Output
    csv = out.join('\n');
    console.log(csv);
};

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

function getDeviceName(arrCaps) {
    if (arrCaps[1].match(/^([0-9]|_)+$/)) {
        var deviceName = 'desktop';
    } else if (arrCaps[1] == 'android') {
        var deviceName = arrCaps[1] + '-' + arrCaps[2];
    } else {
        var deviceName = arrCaps[0];
    }
    return deviceName;
}

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

function getErrorType(e) {
    // Categorises type of error based on detail received
    if (e.length == 0) return "";
    if (e.match(/element wasn't found|still not existing/)) return "Element not found";
    if (e.match(/Received:\s{1,}[0-9]{1,}/)) return "Image mismatch";
    if (e.match(/^Expect window to have url/)) return "URL mismatch";
    return e.length;
}

function constructUID(scriptName, testName, browserName, platformName, deviceName) {
    // Construct uinique identifier for reports, combining suite, test and capabilities details.

    var scriptId = makeId(scriptName);
    let testId = makeId(testName);
    let browserPfx = makePrefix(browserName);
    let platformPfx = makePrefix(platformName);
    let devicePfx = makePrefix(deviceName);

    let uid = `${scriptId}:${testId}:${browserPfx}:${platformPfx}:${deviceName}`;

    return {
        "uid": uid,
        "scriptId": scriptId,
        "testId": testId
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

    function makeId(str) {
        // Extracts an indentifier of one upper cse alpha character followed by digits padded to 3 characters with zeros if needed.
        var idMatch = str.match(/^([A-Z])([0-9]+)/); // E.g. patterns: A1, A12, B24
        if (idMatch !== null) {
            idMatch = idMatch[1] + idMatch[2].padStart(2, 0); // yields initial letter followed by numerical value, padded with zeros to min three digits
        } else {
            idMatch = "";
        }
        return idMatch;
    }
};

function getImageVariance(errDetail) {
    /* Receives wdio error message. If the message contains image comparison variane from baseline 
    the function returns the the value of the variance. */
    var ivary = errDetail.match(/(?!Received:\s)[0-9]*?$/g);
    if (!ivary) {
        ivary = "";
    } else {
        ivary = ivary[0];
    }
    return ivary;
}

function getAssertionURLs(errDetail) {
    // Receives assertion error type and detailm, and returns expected and actual URLs.
    function removeDomain(inUrl = "") {
        if (inUrl.match(/https?:.*?\/{2}.*?\//)) {
            let outUrl = "/" + inUrl.replace(/https?:.*?\/{2}.*?\//, "");
            return outUrl;
        } else {
            return "";
        }
    }
    let urlActual = "";
    let urlExpected = "";
    if (errDetail.match(/(\s|http(s?):)\/.*?\s/g) && errDetail.includes("Expect window to have url containing")) {
        const urls = errDetail.match(/(\s|http(s?):)\/.*?\s/g);
        urlExpected = stripAnsi(urls[0]).trim();
        urlActual = stripAnsi(removeDomain(urls[1]));
    }
    return {
        "expected": urlExpected,
        "actual": urlActual,
    };
}

module.exports = wdioJunitCsv;
