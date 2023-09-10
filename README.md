# wdio-junitcsv
Converts Junit reports for Webdriver IO into CSV format.

## Node package installation

```bash
npm install wdio-junitcsv
```

## Usage

The script takes one argument, a directory path, which it parses for Junit reporter format XML files and merges them into a single CSV file. Output is returned to STDOUT which can be piped to a file or clipboard.

### Command line

```bash
node junitcsv ./path/to/reports
```

### Imported as Node.js module

```javascript
const wdioJunitCSV = require('wdio-junitcsv');

console.log(wdioJunitCSV('./path/to/reports/'));
```

## CSV ouptut fields

| Field name | Description                                                                      |
| ---------- | -------------------------------------------------------------------------------- |
| UUID       | Universal unique identifier for test case - generated from timestamp of test run |
| uniqueId   | ID combining first three characters from test attributes (script ID, test ID, browser name, platform name, device name) |
| specPath   | Directory path to which test suite belongs |
| scriptId   | ID for script extracted from suite name. If present, formed from initial alpha character and subsequent numeric characters |
| testId     | ID for test case extracted from test name. If present, formed from initial alpha character and subsequent numeric characters |
| suiteName | Name of test suite |
| browserName | Browser name from capabilities where supplied |
| platformName | Operating system |
| deviceName | Device name - defaults to desktop for desktop browser sessions |
| testName | Name of test case within suite |
| state | Passed or failed, based on whether `<failed>` element is present in Junit test case |
| error | Taken from error message in Junit report |
| urlInitial | First URL encountered when running the test |
| urlExpected | When a test case fails on URL matching, extracts the expected URL |
| urlActual | When a test case fails on URL matching, extracts the actual URL returned |
| imageVariance | When using `wdio-image-comparison-service` and the test fails, returns the reported degree of variance beteen images |
| start | Time stamp for when test was started |
| duration | Duration of test suite in seconds |

