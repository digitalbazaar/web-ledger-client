/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const constants = require('./constants');
const {create} = require('apisauce');
const https = require('https');
const WebLedgerClientError = require('./WebLedgerClientError');

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

    this.mode = mode || constants.DEFAULT_MODE;
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
  async getRecord({id}) {
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
        headers: constants.DEFAULT_HEADERS
      });

    if(response.problem) {
      if(response.status === 404) {
        throw new WebLedgerClientError(
          'Record not found.', 'NotFoundError',
          {baseURL, id, status: response.status});
      }
      if(response.problem) {
        const error = new WebLedgerClientError(
          'Error retrieving record.', 'NetworkError');
        if(response.problem === 'CLIENT_ERROR') {
          error.details = {baseURL, id, error: response.data,
            status: response.status
          };
        } else {
          error.details = {baseURL, id, error: response.originalError,
            status: response.status
          };
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
      throw new WebLedgerClientError(
        'Fetched Record has empty body/"object" property', 'DataError',
        {baseURL, id});
    }

    // full Record
    result.type = 'WebLedgerRecord'; //FIXME: check if type is correct
    result.record = record;

    return result;
  }

  async getDocument({headers = {}, service}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const baseURL = this.ledgerAgent.service[service];
    const serviceApi = create({baseURL});
    const requestHeaders = Object.assign(
      {}, constants.DEFAULT_HEADERS, headers);
    const response = await serviceApi.get('/', {}, {
      httpsAgent: this.httpsAgent, headers: requestHeaders
    });
    if(response.problem) {
      const error = new WebLedgerClientError(
        'Error retrieving document.', 'NetworkError');
      if(response.problem === 'CLIENT_ERROR') {
        error.details = {baseURL, service, error: response.data,
          status: response.status
        };
      } else {
        error.details = {
          baseURL, service, error: response.originalError,
          status: response.status
        };
      }
      throw error;
    }
    return response.data;
  }

  async getStatus({headers = {}} = {}) {
    return this.getDocument({headers, service: 'ledgerAgentStatusService'});
  }

  async sendConfig({ledgerConfiguration}) {
    return this.sendDocument(
      {document: ledgerConfiguration, service: 'ledgerConfigService'});
  }

  async sendDocument({document, service, headers = {}}) {
    const requestHeaders = Object.assign(
      {}, constants.DEFAULT_HEADERS, headers);
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const baseURL = this.ledgerAgent.service[service];
    const serviceApi = create({baseURL});
    const response = await serviceApi.post('/', document, {
      httpsAgent: this.httpsAgent, headers: requestHeaders
    });
    if(response.problem) {
      const error = new WebLedgerClientError(
        'Error sending document.', 'NetworkError',
        {baseURL, service, document});
      if(response.problem === 'CLIENT_ERROR') {
        error.details = {
          baseURL, document, service, error: response.data,
          status: response.status
        };
      } else {
        error.details = {
          baseURL, document, service, error: response.originalError
        };
      }
      throw error;
    }
    return response.data;
  }

  /**
   * Sends an operation to a Web Ledger node.
   *
   * @param operation {object} Object the operation to send
   * @param [headers={}] {object} Optional headers to pass through with request
   *
   * @returns {Promise<object>} response object
   */
  async sendOperation({operation, headers = {}}) {
    const service = 'ledgerOperationService';
    return this.sendDocument({document: operation, service, headers});
  }

  /**
   * Resolves with a list of ledger agents.
   *
   * @param [headers={}] {object} Optional headers to pass through with request
   *
   * @returns {Promise<Array<object>>}
   */
  async getAgents({headers = {}} = {}) {
    const baseURL = `https://${this.hostname}`;
    const requestHeaders = Object.assign(
      {}, constants.DEFAULT_HEADERS, headers);
    const agentsApi = create({baseURL});
    const response = await agentsApi.get('/ledger-agents', {}, {
      headers: requestHeaders, httpsAgent: this.httpsAgent
    });
    if(response.problem) {
      if(response.status === 404) {
        throw new WebLedgerClientError(
          'Record not found.', 'NotFoundError',
          {baseURL, status: response.status});
      }
      if(response.problem) {
        const error = new WebLedgerClientError(
          'Error retrieving record.', 'NetworkError');
        if(response.problem === 'CLIENT_ERROR') {
          error.details = {
            baseURL, error: response.data, status: response.status
          };
        } else {
          error.details = {
            baseURL, error: response.originalError, status: response.status
          };
        }
        throw error;
      }
    }
    return response.data.ledgerAgent;
  }

  /**
   * Resolves with a single ledger agent for given options. If "id" is not
   * specified the first ledger agent will be resolved.
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
      const error = new WebLedgerClientError(
        'Ledger agent not found.', 'NotFoundError', {id});
      this.logger.error('Could not fetch ledger agent.', error);
      throw error;
    }
    this.ledgerAgent = ledgerAgent;
    return ledgerAgent;
  }

  /**
   * Wraps a Record in a Web Ledger Operation.
   */
  static wrap({creator, record, operationType = 'create'}) {
    const operation = {'@context': constants.WEB_LEDGER_CONTEXT_V1_URL};
    if(creator) {
      operation.creator = creator;
    }

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
        throw new WebLedgerClientError(
          'Unknown operation type.', 'SyntaxError', {operationType});
    }

    return operation;
  }
}

module.exports = WebLedgerClient;
