/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const url = require('url');
const axios = require('axios');
const https = require('https');

const DEFAULT_MODE = 'test';
const DEFAULT_HEADERS = {
  'Accept': 'application/ld+json, application/json'
};
const WEB_LEDGER_CONTEXT_V1 = 'https://w3id.org/webledger/v1';

class WebLedgerClient {
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
   * Fetches a Record for a given ID.
   *
   * @param id {string} ID uri
   *
   * @returns {Promise<object>} Resolves to Record Fetch Result
   */
  async get({id}) {
    if(!id) {
      throw new Error('Invalid or missing Record URI');
    }

    const ledgerAgent = await this.getAgent();
    const queryServiceUrl = url.parse(ledgerAgent.service.ledgerQueryService);
    queryServiceUrl.search = `id=${id}`;
    const idUrl = url.format(queryServiceUrl);

    this.logger.log(`Retrieving Record [ledger: ${this.hostname}]:`, id);

    let response;
    try {
      response = await axios.post(idUrl, {}, {
        httpsAgent: this.httpsAgent,
        headers: DEFAULT_HEADERS
      });
    } catch(error) {
      if(error.response && error.response.status !== 404) {
        this.logger.error('Failed to fetch Record:', error);
      }
      throw error;
    }

    const body = response.data;

    const result = {
      found: true,
      retry: false,
      id,
      hostname: this.hostname,
      meta: body.meta
    };

    const {record} = body;

    if(!record) {
      throw new Error('Fetched Record has empty body/"object" property');
    }

    // full Record
    result.type = 'WebLedgerRecord'; //FIXME: check if type is correct
    result.record = record;

    return result;
  }

  /**
   * Sends an operation to a Web Ledger node.
   *
   * @param operation {object} Object to be wrapped in a Web Ledger operation
   * @param [headers={}] {object} Optional headers to pass through with request
   *
   * @returns {Promise<object>} Axios response object
   */
  async send({operation, headers = {}}) {
    const ledgerAgent = await this.getAgent();

    headers = Object.assign({}, DEFAULT_HEADERS, headers);

    return axios.post(ledgerAgent.service.ledgerOperationService, operation, {
      httpsAgent: this.httpsAgent,
      headers
    });
  }

  /**
   * Resolves with a list of ledger agents.
   *
   * @returns {Promise<Array<object>>}
   */
  async getAgents() {
    const ledgerAgentsUrl = `https://${this.hostname}/ledger-agents`;

    let ledgerAgentResponse;
    try {
      ledgerAgentResponse = await axios.get(ledgerAgentsUrl, {
        httpsAgent: this.httpsAgent,
        headers: DEFAULT_HEADERS
      });
    } catch(error) {
      this.logger.error('Could not fetch ledger agents:', error);
      throw error;
    }

    return ledgerAgentResponse.data.ledgerAgent;
  }

  /**
   * Resolves with a single ledger agent for given options. If "id" is not
   * specified the first ledger agent will be resolved.
   *
   *
   * @returns {Promise<object>}
   */
  async getAgent({id} = {}) {
    const agents = await this.getAgents();

    if(!id) {
      return agents[0]; //TODO: Should we be returning the first ledger agent
    }

    const [agent] = agents.filter(agent => agent.id === id);

    if(!agent) {
      const error = new Error(`Agent with id "${id}" could not be found`);
      error.name = 'NotFoundError';
      this.logger.error('Could not fetch ledger agents:', error);
      throw error;
    }

    return agent;
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
   * Wraps a Record in a Web Ledger Operation.
   */
  static wrap({record, operationType = 'create'}) {
    const operation = {
      '@context': WEB_LEDGER_CONTEXT_V1
    };

    switch(operationType) {
      case 'create':
        operation.type = 'CreateWebLedgerRecord';
        operation.record = record;
        break;
      case 'update':
        operation.type = 'UpdateWebLedgerRecord';
        operation.recordPatch = record;
        break;
      default:
        throw new Error(`Unknown operation type "${operationType}"`);
    }

    return operation;
  }
}

module.exports = WebLedgerClient;
