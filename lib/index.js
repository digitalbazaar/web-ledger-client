/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const tls = require('tls');
tls.DEFAULT_ECDH_CURVE = 'auto';

module.exports = {
  constants: require('./constants'),
  WebLedgerClient: require('./WebLedgerClient'),
  WebLedgerClient: require('./WebLedgerClient'),
  WebLedgerClientError: require('./WebLedgerClientError'),
};
