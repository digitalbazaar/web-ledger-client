/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const url = require('url');
const r2 = require('r2');
const https = require('https');

const contexts = require('../contexts');

const DEFAULT_MODE = 'test';
const VERES_ONE_V1_CONTEXT = 'https://w3id.org/veres-one/v1';
const DEFAULT_HEADERS = {
  'content-type': 'application/ld+json, application/json',
  'accept': 'application/json'
};

class VeresOneClient {
  /**
   * @param injector {Injector}
   *
   * @param hostname {string} Hostname of the ledger (points to a load balancer
   *   or a specific node).

   * @param [mode='test'] {string} One of 'dev'/'test'/'live'. Determines https
   *   agent settings (does not reject unsigned certs in 'dev' mode, for
   *   example).
   * @param [logger]
   * @param [httpsAgent] {Agent}
   */
  constructor({injector, hostname, mode, logger, httpsAgent}) {
    this.injector = injector;

    this.hostname = hostname;
    if(!hostname) {
      throw new Error('Missing ledger hostname');
    }

    this.mode = mode || DEFAULT_MODE;
    this.logger = logger || console;

    this.httpsAgent = httpsAgent;
    if(mode === 'dev' && !this.httpsAgent) {
      this.httpsAgent = new https.Agent({rejectUnauthorized: false});
    }
  }

  /**
   * Fetches a DID Document for a given DID. If it contains a #hash fragment,
   * it's likely a key id, so just return the subgraph, not the full doc.
   *
   * @param did {string} DID uri (possibly with hash fragment)
   *
   * @returns {Promise<object>} Resolves to DID Document Fetch Result
   */
  async get({did}) {
    if(!did) {
      throw new Error('Invalid or missing DID URI');
    }
    const [docUri, hashFragment] = did.split('#');

    const ledgerAgent = await this.getAgent();
    const queryServiceUrl = url.parse(ledgerAgent.service.ledgerQueryService);
    queryServiceUrl.search = `id=${docUri}`;
    const didUrl = url.format(queryServiceUrl);

    this.logger.log(`Retrieving DID Document [ledger: ${this.hostname}]:`,
      docUri);

    let response;
    try {
      response = await r2({
        url: didUrl,
        method: 'POST',
        agent: this.httpsAgent,
        headers: {
          'accept': 'application/ld+json, application/json'
        }
      }).response;
    } catch(error) {
      this.logger.error('Failed to fetch DID document:', error);
      throw error;
    }

    const body = await response.json();

    const result = {
      found: true,
      retry: false,
      did: docUri,
      hostname: this.hostname,
      meta: body.meta
    };

    const didDoc = body.object;

    if(!didDoc) {
      throw new Error('Fetched DID Document has empty body/"object" property');
    }

    const context = didDoc['@context'];

    if(!hashFragment) {
      // full DID Doc
      result.type = 'LedgerDidDocument';
      result.doc = didDoc;
    } else {
      // Request for a subgraph (likely just the key node)
      const jsonld = this.injector.use('jsonld');
      const map = await jsonld.createNodeMap(didDoc);
      const subGraph = map[did];
      if(!subGraph) {
        throw new Error(
          `Failed to get subgraph within a DID Document, uri: ${did}`
        );
      }

      // result.type = 'Key'; <- not sure what this should be
      result.doc = await jsonld.compact(subGraph, context);
    }

    return result;
  }

  /**
   * Sends an operation to a Veres One ledger node.
   *
   * @returns {Promise<object>} response
   */
  async send(options = {}) {
    const ledgerAgent = await this.getAgent(options);
    const {operation} = options;

    const headers = Object.assign({}, DEFAULT_HEADERS, options.headers);

    return r2({
      url: ledgerAgent.service.ledgerOperationService,
      method: 'POST',
      agent: this.httpsAgent,
      headers,
      json: operation
    }).response;
  }

  /**
   * Resolves with a list of ledger agent urls.
   *
   * @returns {Promise<Array<object>>}
   */
  async getAgents(options = {}) {
    const ledgerAgentsUrl = `https://${this.hostname}/ledger-agents`;

    const headers = {
      'accept': 'application/ld+json, application/json'
    };

    let ledgerAgentRes;
    try {
      ledgerAgentRes = await r2({
        url: ledgerAgentsUrl,
        method: 'GET',
        agent: this.httpsAgent,
        headers
      }).json;
    } catch(error) {
      this.logger.error('Could not fetch ledger agents:', error);
      throw error;
    }

    return ledgerAgentRes.ledgerAgent;
  }

  /**
   * Resolves with a single ledger agent for given options (first one).
   *
   * @param options {object} See docstring for `getAgents()` above.
   *
   * @returns {Promise<object>}
   */
  async getAgent(options) {
    const agents = await this.getAgents(options);
    return agents[0];
  }

  static signRequestHeaders({path, headers, signHeaders, keyId, key, method}) {
    const httpSignature = require('http-signature');

    httpSignature.signRequest({
      getHeader: (header) => {
        // case insensitive lookup
        return headers[Object.keys(headers).find(
          key => key.toLowerCase() === header.toLowerCase())];
      },
      setHeader: (header, value) => {
        headers[header] = value;
      },
      method,
      path
    }, {
      headers: signHeaders,
      keyId,
      key
    });
  }

  /**
   * Sends an operation to a Veres One accelerator.
   *
   * @param options {object}
   *
   * @param options.operation {object} WebLedgerOperation
   *
   * @param [options.hostname] {string} Accelerator hostname
   * @param [options.env] {string} Used to determine default hostname
   *
   * Keys for signing the http request headers
   * @param [options.authKey] {LDKeyPair}
   *
   * @returns response {Promise<Response>} from a fetch() POST.
   */
  async sendToAccelerator(options) {
    const { operation, authKey } = options;
    const hostname = options.hostname || this.hostname;

    const acceleratorPath = '/accelerator/proofs';
    const acceleratorUrl = `https://${hostname}${acceleratorPath}`;

    const headers = {
      'accept': 'application/ld+json, application/json',
      'host': hostname
    };

    if(authKey && authKey.keyType === 'RsaVerificationKey2018') {
      const secretKey = await authKey.export();

      VeresOneClient.signRequestHeaders({
        path: acceleratorPath,
        headers,
        signHeaders: [ '(request-target)', 'date', 'host' ],
        keyId: authKey.id,
        key: secretKey.secretKeyBase58 || secretKey.secretKeyPem,
        method: 'POST'
      });
    }

    const requestOptions = {
      url: acceleratorUrl,
      method: 'POST',
      agent: this.httpsAgent,
      headers,
      json: operation
    };
    let response;

    try {
      response = await r2(requestOptions).response;
    } catch(error) {
      this.logger.error('Error sending request to accelerator:', requestOptions,
        error);
    }

    return response;
  }

  /**
   * Wraps a DID Document in a Web Ledger Operation.
   */
  wrap({didDocument, operationType = 'create'}) {
    const operation = {
      '@context': contexts[VERES_ONE_V1_CONTEXT]
    };

    switch(operationType) {
      case 'create':
        operation.type = 'CreateWebLedgerRecord';
        operation.record = didDocument.doc;
        break;
      case 'update':
        operation.type = 'UpdateWebLedgerRecord';
        operation.recordPatch = didDocument.commit();
        break;
      default:
        throw new Error(`Unknown operation type "${operationType}"`);
    }

    return operation;
  }
}

module.exports = VeresOneClient;