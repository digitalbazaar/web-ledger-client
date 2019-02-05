/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {create} = require('apisauce');
const axios = require('axios');
const https = require('https');
const WebLedgerClientError = require('./WebLedgerClientError');

const DEFAULT_MODE = 'test';
const DEFAULT_HEADERS = {Accept: 'application/ld+json, application/json'};
const WEB_LEDGER_CONTEXT_V1 = 'https://w3id.org/webledger/v1';

class WebLedgerClient {
  /**
   * @param hostname {string} Hostname of the ledger (points to a load balancer
   *   or a specific node).

   * @param [mode='test'] {string} One of 'dev'/'test'/'live'. Determines https
   *   agent settings (does not reject unsigned certs in 'dev' mode, for
   *   example).
   * @param [logger]
   * @param [httpsAgent] {Agent}
   */
  constructor({hostname, mode, logger, httpsAgent}) {
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
    this.ledgerAgent = null;
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
    const baseURL = ledgerAgent.service.ledgerQueryService;
    const queryServiceApi = create({baseURL});

    this.logger.log(`Retrieving Record [ledger: ${this.hostname}]:`, id);

    const response = await queryServiceApi.post(
      `?id=${encodeURIComponent(id)}`, {}, {
        httpsAgent: this.httpsAgent,
        headers: DEFAULT_HEADERS
      });

    if(response.problem) {
      if(response.status === 404) {
        throw new WebLedgerClientError(
          'Record not found.', 'NotFoundError', {baseURL, id});
      }
      if(response.problem) {
        const error = new WebLedgerClientError(
          'Unable to retrieve record.', 'NetworkError');
        if(response.problem === 'CLIENT_ERROR') {
          error.details = {baseURL, id, error: response.data};
        } else {
          error.details = {baseURL, id, error: response.originalError};
        }
        throw error;
      }
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

  async getDocument({service}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const baseURL = this.ledgerAgent.service[service];
    const serviceApi = create({
      baseURL, httpsAgent: this.httpsAgent, headers: DEFAULT_HEADERS,
    });
    const response = await serviceApi.get('/');
    if(response.problem) {
      const error = new Error('Error sending document.');
      if(response.problem === 'CLIENT_ERROR') {
        error.details = response.data;
      } else {
        error.details = response.originalError;
      }
      throw error;
    }
    return response.data;
  }

  async getStatus() {
    return this.getDocument({service: 'ledgerAgentStatusService'});
  }

  async sendConfig({ledgerConfiguration}) {
    return this.sendDocument(
      {document: ledgerConfiguration, service: 'ledgerConfigService'});
  }

  async sendDocument({document, service}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const baseURL = this.ledgerAgent.service[service];
    const serviceApi = create({
      baseURL, httpsAgent: this.httpsAgent, headers: DEFAULT_HEADERS,
    });
    const response = await serviceApi.post('/', document);
    if(response.problem) {
      const error = new Error('Error sending document.');
      if(response.problem === 'CLIENT_ERROR') {
        error.details = response.data;
      } else {
        error.details = response.originalError;
      }
      throw error;
    }
    return response.data;
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
    const agentsApi = create({
      baseURL: `https://${this.hostname}`,
      httpsAgent: this.httpsAgent,
      headers: DEFAULT_HEADERS,
    });
    const ledgerAgentResponse = await agentsApi.get('/ledger-agents');
    if(ledgerAgentResponse.problem) {
      throw ledgerAgentResponse.originalError;
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
    let ledgerAgent;
    if(!id) {
      ledgerAgent = agents[0];
    } else {
      ([ledgerAgent] = agents.filter(agent => agent.id === id));
    }

    if(!ledgerAgent) {
      const error = new Error(`Agent with id "${id}" could not be found`);
      error.name = 'NotFoundError';
      this.logger.error('Could not fetch ledger agents:', error);
      throw error;
    }
    this.ledgerAgent = ledgerAgent;
    return ledgerAgent;
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
