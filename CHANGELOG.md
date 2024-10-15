# web-ledger-client ChangeLog

## 7.1.0 - 2024-10-dd

### Changed
- Update dependencies.

## 7.0.0 - 2022-06-09

### Changed
- **BREAKING**: Convert to module (ESM).
- **BREAKING**: Require Node.js >=14.
- Update dependencies.
- Lint module.

## 6.0.0 - NONE

### Notes
- 6.0.0 was erroneously released.

## 5.0.0 - 2021-07-23

### Changed
- **BREAKING**: Add ZCAP context to operation invocations.

## 4.0.0 - 2021-06-11

### Removed
- **BREAKING**: Replaced `apisauce` with `@digitalbazaar/http-client`. The
  errors thrown by `http-client` are not the same as `apisauce`.
  - Network errors are now HTTPErrors and not axios errors.

### Changed
- API `getRecord` does not append a `/` before query string any more.
- Updated tests for `getRecord` to no longer expect query string after `/`.

## 3.4.1 - 2021-03-16

### Fixed
- Re-release v3.4.0 due to NPM failure.

## 3.4.0 - 2021-03-11

### Changed
- Use `apisauce@2` to address security vulnerabilities in the older `axios`
  sub-dependency.

### Fixed
- Added a check to ensure `Error.captureStackTrace` is a function before using it.

## 3.3.0 - 2019-10-24

### Changed
- Use eslint@6.
- Update engines in package file to support Node.js 10+.

## 3.2.0 - 2019-05-24

### Added
- A configurable HTTP request timeout.

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
