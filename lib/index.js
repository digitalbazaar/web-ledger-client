/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const tls = require('tls');
tls.DEFAULT_ECDH_CURVE = 'auto';

const WebLedgerClient = require('./web-ledger-client.js');

module.exports = WebLedgerClient;
