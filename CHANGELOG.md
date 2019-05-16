# web-ledger-client ChangeLog

## 3.1.0 - 2019-05-16

### Added
-  Implement getGenesisBlock API.

## 3.0.0 - 2019-04-10

### Fixed
- Now works in the browser.

### Changed
- **BREAKING**: Node 10.x is required.
- **BREAKING**: The `strictSSL` parameter has been removed from the constructor.
  In order to disable strict SSL in Node, one must use the `httpsAgent`
  parameter to the constructor to pass in a properly configured Node
  [https.Agent](https://nodejs.org/docs/latest-v10.x/api/https.html#https_class_https_agent)
  instance. Example: `const httpsAgent = new https.Agent({rejectUnauthorized: false});`

## 2.1.0 - 2019-04-09

### Added
- Add `getServiceEndpoint` API.
- Add `getTargetNode` API.

## 2.0.0 - 2019-02-20

### Changed
- **BREAKING**: Many of the 1.0 APIs have been changed or renamed.

## 1.0.0 - 2018-11-08

- Initial release.
- Extracted code from did-client-veres-one, did-io.
- Changed from r2 to axios.
