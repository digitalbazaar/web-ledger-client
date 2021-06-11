/*!
 * Copyright (c) 2019-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

module.exports = class WebLedgerClientError extends Error {
  constructor(message, name, details) {
    super(message);
    this.name = name;
    this.details = details;
    // captureStackTrace is node only
    if(typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};
