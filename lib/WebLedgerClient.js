/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _get = require('lodash.get');
const constants = require('./constants');
const {httpClient, DEFAULT_HEADERS} = require('@digitalbazaar/http-client');
const {create} = require('apisauce');
const WebLedgerClientError = require('./WebLedgerClientError');

/**
 * A SSL capable HTTP Agent.
 * @see https://nodejs.org/api/https.html
 * @typedef {Object} Agent
 */

/**
 * A Document used by the Ledger.
 * @see https://w3c.github.io/json-ld-syntax/
 * @see https://w3c-dvcg.github.io/ld-signatures/
 * @typedef {Object} JSON-LD
 * @property {string} @context - Used to define the terms in the document.
 * @property {string} @id - A unique id for the document.
 */

class WebLedgerClient {
  /**
   * @param {Object} options - Options for the WebLedgerClient.
   * @param {string} options.hostname - The hostname of the ledger node.
   * @param {Object} [options.logger] - The logger to use.
   * @param {Agent} [options.httpsAgent] - A NodeJS HTTPS Agent (`https.Agent`)
   *   instance.
   * @param {number} [options.timeout=60000] - HTTP request timeout in ms.
   */
  constructor({httpsAgent, hostname, logger, timeout = 60000}) {
    this.hostname = hostname;
    if(!hostname) {
      throw new TypeError('Missing ledger hostname.');
    }

    this.logger = logger || console;

    this.httpsAgent = httpsAgent;
    this.ledgerAgent = null;
    this.ledgerAgentStatus = null;
    this.timeout = timeout;
  }

  /**
   * Fetches a Record for a given ID.
   *
   * @param {Object} options - Options for getRecord.
   * @param {string} options.id - The ID URI for the record.
   *
   * @returns {Promise<Object>} - The record object.
   */
  async getRecord({id}) {
    if(!id) {
      throw new TypeError('Invalid or missing Record URI.');
    }

    const ledgerAgent = await this.getAgent();
    const baseURL = ledgerAgent.service.ledgerQueryService;
    const queryServiceApi =
      create({baseURL, httpsAgent: this.httpsAgent, timeout: this.timeout});

    this.logger.log(`Retrieving Record [ledger: ${this.hostname}]:`, id);

    const response = await queryServiceApi.post(
      `?id=${encodeURIComponent(id)}`, {}, {
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

  /**
   * Gets a document.
   *
   * @param {Object} options - Options for getDocument.
   * @param {Object} [options.headers={}] - Headers for the request.
   * @param {string} options.service - The name of the service to use.
   *
   * @returns {Promise<Object>} The requested document.
   */
  async getDocument({headers = {}, service}) {
    const baseURL = await this.getServiceEndpoint({serviceId: service});
    try {
      const response = await httpClient.get('', {
        prefixUrl: baseURL,
        httpsAgent: this.httpsAgent,
        timeout: this.timeout,
        headers: {...DEFAULT_HEADERS, ...headers}
      });
      return response.data;
    } catch(e) {
      const {response} = e;
      // do not hide client side errors
      if(!response) {
        throw e;
      }
      const error = new WebLedgerClientError(
        'Error retrieving document.', 'NetworkError');
      error.details = {
        baseURL, error: e, service,
        status: response.status
      };
      // if we get an error in the 400 range add the response.data
      // to the error if present
      if(response.status >= 400 && response.status < 500) {
        error.details.error = response.data || e;
      }
      throw error;
    }
  }

  /**
   * Get the genesis block from the ledger via the 'ledgerBlockService'.
   *
   * @returns {Promise<Object>} The genesis block.
   */
  async getGenesisBlock() {
    const {genesis: {block}} = await this.getDocument(
      {service: 'ledgerBlockService'});
    return block;
  }

  /**
   * Get the service endpoint URL for the given service ID.
   *
   * @param {Object} options - The options to use.
   * @param {string} options.serviceId - The ID for the service of interest.
   *
   * @returns {Promise<string>} The service endpoint URL.
   */
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

  /**
   * Get the status of a Document from the ledger Agent Status Service.
   *
   * @param {Object} [options={}] - Options for getStatus.
   * @param {Object} [options.headers = {}] - Headers for the request.
   *
   * @returns {Promise<Object>} A document with a status.
   */
  async getStatus({headers = {}} = {}) {
    return this.getDocument({headers, service: 'ledgerAgentStatusService'});
  }

  /**
   * Returns the targetNode for the ledger agent associated with
   * the WebLedgerClient instance.
   *
   * @returns {Promise<string>} The targetNode.
   */
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

  /**
   * Sends a configuration Document to a service.
   *
   * @param {Object} options - Options for sendConfig.
   * @param {JSON-LD} options.ledgerConfiguration - Doc with config options.
   *
   * @returns {Promise<Object>} The result of the send.
   */
  async sendConfig({ledgerConfiguration}) {
    return this.sendDocument(
      {document: ledgerConfiguration, service: 'ledgerConfigService'});
  }

  /**
   * Sends a document to a ledger service.
   *
   * @param {Object} options - Options for sendDocument.
   * @param {JSON-LD} options.document - A valid document for the ledger.
   * @param {string} options.service - The name of a ledger service.
   * @param {Object} [options.headers={}] - Headers for the request.
   * @throws {WebLedgerClientError}
   *
   * @returns {Promise<Object>} The result of the send.
   */
  async sendDocument({document, service, headers = {}}) {
    const requestHeaders = Object.assign(
      {}, constants.DEFAULT_HEADERS, headers);
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const baseURL = this.ledgerAgent.service[service];
    const serviceApi =
      create({baseURL, httpsAgent: this.httpsAgent, timeout: this.timeout});
    const response = await serviceApi.post('/', document, {
      headers: requestHeaders
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
   * @param {Object} options - Options for this function.
   * @param {Object} options.operation - The operation to send.
   * @param {Object} [options.headers={}] - The headers for the request.
   *
   * @returns {Promise<Object>} A response object.
   */
  async sendOperation({operation, headers = {}}) {
    const service = 'ledgerOperationService';
    return this.sendDocument({document: operation, service, headers});
  }

  /**
   * Resolves with a list of ledger agents.
   *
   * @param {Object} [options={}] - Options for getAgents.
   * @param {Object} [options.headers={}] - The headers for the request.
   *
   * @returns {Promise<Array<Object>>} An array of ledger agents.
   */
  async getAgents({headers = {}} = {}) {
    const baseURL = `https://${this.hostname}`;
    const requestHeaders = Object.assign(
      {}, constants.DEFAULT_HEADERS, headers);
    const agentsApi =
      create({baseURL, httpsAgent: this.httpsAgent, timeout: this.timeout});
    const response = await agentsApi.get('/ledger-agents', {}, {
      headers: requestHeaders
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
   * @param {Object} [options={}] - Options for getAgent.
   * @param {string} [options.id] - The ledger agent ID.
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
   * @param {Object} options - Options for wrap.
   * @param {Object} options.record - The record to wrap into an operation.
   * @param {boolean} [options.addCreator=true]
   * - Assign the ledger agent's `targetNode`
   *  as the `creator` in the wrapped operation.
   * @param {('create'|'update')} [options.operationType=create]
   * - The type of wrapper to generate.
   *
   * @returns {Promise<Object>} - The wrapped record.
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
