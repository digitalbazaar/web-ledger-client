/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const tls = require('tls');
tls.DEFAULT_ECDH_CURVE = 'auto';

const WebLedgerClient = require('./WebLedgerClient');

module.exports = WebLedgerClient;
