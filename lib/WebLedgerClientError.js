/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
export class WebLedgerClientError extends Error {
  constructor(message, name, details) {
    super(message);
    this.name = name;
    this.details = details;
    // captureStackTrace is node only
    if(typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
