/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _get = require('lodash.get');
const constants = require('./constants');
const {create} = require('apisauce');
const WebLedgerClientError = require('./WebLedgerClientError');

class WebLedgerClient {
  /**
   * @param {string} hostname - The hostname of the ledger node.
   * @param [logger] - The logger to use.
   * @param {Agent} [httpsAgent] - A NodeJS HTTPS Agent (`https.Agent`) instance
   */
  constructor({httpsAgent, hostname, logger}) {
    this.hostname = hostname;
    if(!hostname) {
      throw new TypeError('Missing ledger hostname.');
    }

    this.logger = logger || console;

    this.httpsAgent = httpsAgent;
    this.ledgerAgent = null;
    this.ledgerAgentStatus = null;
  }

  /**
   * Fetches a Record for a given ID.
   *
   * @param {string} id - the ID URI for the record.
   *
   * @returns {Promise<object>} - the record object.
   */
  async getRecord({id}) {
    if(!id) {
      throw new TypeError('Invalid or missing Record URI.');
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
      const error = new WebLedgerClientError(
        'Error retrieving record.', 'NetworkError');
      if(response.problem === 'CLIENT_ERROR') {
        error.details = {
          baseURL, id, error: response.data, status: response.status
        };
      } else {
        error.details = {
          baseURL, id, error: response.originalError, status: response.status
        };
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
      throw new WebLedgerClientError(
        'Fetched Record has empty body/"record" property.', 'DataError',
        {baseURL, id});
    }

    // full Record
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
        error.details = {
          baseURL, error: response.data, service, status: response.status
        };
      } else {
        error.details = {
          baseURL, error: response.originalError, service,
          status: response.status
        };
      }
      throw error;
    }
    return response.data;
  }

  async getServiceEndpoint({serviceId}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const serviceURL = _get(this.ledgerAgent.service, serviceId);
    if(!serviceURL) {
      throw new WebLedgerClientError(
        'Service ID not found.', 'NotFoundError',
        {ledgerAgent: this.ledgerAgent, serviceId});
    }
    return serviceURL;
  }

  async getStatus({headers = {}} = {}) {
    return this.getDocument({headers, service: 'ledgerAgentStatusService'});
  }

  async getTargetNode() {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const {ledgerAgentStatus: {targetNode}} = this;
    if(!targetNode) {
      throw new WebLedgerClientError(
        'The ledger agent does not define `targetNode`.', 'NotFoundError',
        {ledgerAgentStatus: this.ledgerAgentStatus});
    }
    return targetNode;
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
   * @param {Object} operation - the operation to send.
   * @param {Object} [headers={}] - the headers to pass through with request.
   *
   * @returns {Promise<Object>} response object
   */
  async sendOperation({operation, headers = {}}) {
    const service = 'ledgerOperationService';
    return this.sendDocument({document: operation, service, headers});
  }

  /**
   * Resolves with a list of ledger agents.
   *
   * @param {Object} [headers={}] - the headers to pass through with request.
   *
   * @returns {Promise<Array<Object>>} An array of ledger agents.
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
    return response.data.ledgerAgent;
  }

  /**
   * Resolves with a single ledger agent for given options. If "id" is not
   * specified the first ledger agent will be resolved.
   *
   * @param {string} [id] - the ledger agent ID.
   *
   * @returns {Promise<Object>} A ledger agent.
   */
  async getAgent({id} = {}) {
    const agents = await this.getAgents();
    let ledgerAgent;
    if(!id) {
      [ledgerAgent] = agents;
    } else {
      ledgerAgent = agents.find(agent => agent.id === id);
    }

    if(!ledgerAgent) {
      const error = new WebLedgerClientError(
        'Ledger agent not found.', 'NotFoundError', {id});
      this.logger.error('Could not fetch ledger agent.', error);
      throw error;
    }
    this.ledgerAgent = ledgerAgent;
    this.ledgerAgentStatus = await this.getStatus();
    return ledgerAgent;
  }

  /**
   * Wraps a Record in a Web Ledger Operation.
   *
   * @param {Object} record - the record to wrap into an operation.
   * @param {boolean} [addCreator=true] - assign the ledger agent's `targetNode`
   *   as the `creator` in the wrapped operation.
   * @param {('create'|'update')} [operationType=create] - the type of wrapper
   *   to generate.
   *
   * @returns {Promise<Object>} - the wrapped record.
   */
  async wrap({addCreator = true, record, operationType = 'create'}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const operation = {'@context': constants.WEB_LEDGER_CONTEXT_V1_URL};

    // TODO: throw here if targetNode is not defined?
    if(addCreator && this.ledgerAgentStatus.targetNode) {
      operation.creator = this.ledgerAgentStatus.targetNode;
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
