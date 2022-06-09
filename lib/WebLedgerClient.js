/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as constants from './constants.js';
import {httpClient, DEFAULT_HEADERS} from '@digitalbazaar/http-client';
import {WebLedgerClientError} from './WebLedgerClientError.js';

/**
 * A SSL capable HTTP Agent.
 *
 * @see https://nodejs.org/api/https.html
 * @typedef {object} Agent
 */

/* eslint-disable jsdoc/valid-types -- jsdoc can't parse @context and @id */
/**
 * A Document used by the Ledger.
 *
 * @see https://w3c.github.io/json-ld-syntax/
 * @see https://w3c-dvcg.github.io/ld-signatures/
 * @typedef {object} JSON-LD
 * @property {string} @context - Used to define the terms in the document.
 * @property {string} @id - A unique id for the document.
 */
/* eslint-enable jsdoc/valid-types */

export class WebLedgerClient {
  /**
   * @class WebLedgerClient
   *
   * @param {object} options - Options for the WebLedgerClient.
   * @param {string} options.hostname - The hostname of the ledger node.
   * @param {object} [options.logger] - The logger to use.
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
   * @param {object} options - Options for getRecord.
   * @param {string} options.id - The ID URI for the record.
   *
   * @returns {Promise<object>} - The record object.
   */
  async getRecord({id}) {
    if(!id) {
      throw new TypeError('Invalid or missing Record URI.');
    }

    const ledgerAgent = await this.getAgent();
    const baseURL = ledgerAgent.service.ledgerQueryService;

    this.logger.log(`Retrieving Record [ledger: ${this.hostname}]:`, id);

    let response;
    try {
      response = await httpClient.post(baseURL, {
        searchParams: `?id=${encodeURIComponent(id)}`,
        // send an empty body
        json: {},
        agent: this.httpsAgent,
        timeout: this.timeout
      });
    } catch(e) {
      const {response} = e;
      if(!response) {
        throw e;
      }
      if(response.status === 404) {
        throw new WebLedgerClientError(
          'Record not found.', 'NotFoundError',
          {baseURL, id, status: response.status});
      }
      const error = new WebLedgerClientError(
        'Error retrieving record.', 'NetworkError');
      error.details = {
        baseURL, id, error: e, status: response.status
      };
      // errors in the 400 range can have response.data
      if(response.status >= 400 && response.status < 500) {
        // httpClient puts the data on the error object
        error.details.error = e.data || response.data || e;
      }
      throw error;
    }

    if(!(response && response.data && response.data.record)) {
      throw new WebLedgerClientError(
        'Fetched Record has empty body/"record" property.', 'DataError',
        {baseURL, id});
    }

    const {data: {meta, record}} = response;

    return {
      found: true,
      retry: false,
      id,
      hostname: this.hostname,
      meta,
      record,
    };
  }

  /**
   * Gets a document.
   *
   * @param {object} options - Options for getDocument.
   * @param {object} [options.headers={}] - Headers for the request.
   * @param {string} options.service - The name of the service to use.
   *
   * @returns {Promise<object>} The requested document.
   */
  async getDocument({headers = {}, service}) {
    const baseURL = await this.getServiceEndpoint({serviceId: service});
    try {
      const response = await httpClient.get(baseURL, {
        agent: this.httpsAgent,
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
        // httpClient puts the data on the error object
        error.details.error = e.data || response.data || e;
      }
      throw error;
    }
  }

  /**
   * Get the genesis block from the ledger via the 'ledgerBlockService'.
   *
   * @returns {Promise<object>} The genesis block.
   */
  async getGenesisBlock() {
    const {genesis: {block}} = await this.getDocument(
      {service: 'ledgerBlockService'});
    return block;
  }

  /**
   * Get the service endpoint URL for the given service ID.
   *
   * @param {object} options - The options to use.
   * @param {string} options.serviceId - The ID for the service of interest.
   *
   * @returns {Promise<string>} The service endpoint URL.
   */
  async getServiceEndpoint({serviceId}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const serviceURL = this.ledgerAgent.service?.[serviceId];
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
   * @param {object} [options={}] - Options for getStatus.
   * @param {object} [options.headers = {}] - Headers for the request.
   *
   * @returns {Promise<object>} A document with a status.
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
   * @param {object} options - Options for sendConfig.
   * @param {JSON-LD} options.ledgerConfiguration - Doc with config options.
   *
   * @returns {Promise<object>} The result of the send.
   */
  async sendConfig({ledgerConfiguration}) {
    return this.sendDocument(
      {document: ledgerConfiguration, service: 'ledgerConfigService'});
  }

  /**
   * Sends a document to a ledger service.
   *
   * @param {object} options - Options for sendDocument.
   * @param {JSON-LD} options.document - A valid document for the ledger.
   * @param {string} options.service - The name of a ledger service.
   * @param {object} [options.headers={}] - Headers for the request.
   * @throws {WebLedgerClientError}
   *
   * @returns {Promise<object>} The result of the send.
   */
  async sendDocument({document, service, headers = {}}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const baseURL = this.ledgerAgent.service[service];
    try {
      const response = await httpClient.post(baseURL, {
        agent: this.httpsAgent,
        timeout: this.timeout,
        json: document,
        headers: {...DEFAULT_HEADERS, ...headers}
      });
      return response.data || null;
    } catch(e) {
      const {response} = e;
      if(!response) {
        throw e;
      }
      const error = new WebLedgerClientError(
        'Error sending document.', 'NetworkError',
        {baseURL, service, document});
      error.details = {
        baseURL, document, service, error: e
      };
      if(response.status >= 400 && response.status < 500) {
        error.details.status = response.status;
        error.details.error = e.data || response.data || e;
      }
      throw error;
    }
  }

  /**
   * Sends an operation to a Web Ledger node.
   *
   * @param {object} options - Options for this function.
   * @param {object} options.operation - The operation to send.
   * @param {object} [options.headers={}] - The headers for the request.
   *
   * @returns {Promise<object>} A response object.
   */
  async sendOperation({operation, headers = {}}) {
    const service = 'ledgerOperationService';
    return this.sendDocument({document: operation, service, headers});
  }

  /**
   * Resolves with a list of ledger agents.
   *
   * @param {object} [options={}] - Options for getAgents.
   * @param {object} [options.headers={}] - The headers for the request.
   *
   * @returns {Promise<Array<object>>} An array of ledger agents.
   */
  async getAgents({headers = {}} = {}) {
    const baseURL = `https://${this.hostname}`;
    try {
      const {data} = await httpClient.get(`${baseURL}/ledger-agents`, {
        headers: {...DEFAULT_HEADERS, ...headers},
        agent: this.httpsAgent,
        timeout: this.timeout
      });
      return data.ledgerAgent;
    } catch(e) {
      const {response} = e;
      if(!response) {
        throw e;
      }
      if(response.status === 404) {
        throw new WebLedgerClientError(
          'Record not found.', 'NotFoundError',
          {baseURL, status: response.status});
      }
      const error = new WebLedgerClientError(
        'Error retrieving record.', 'NetworkError');
      error.details = {
        baseURL, error: response.originalError, status: response.status
      };
      if(response.status >= 400 && response.status < 500) {
        error.details.error = e.data || response.data || e;
      }
      throw error;
    }
  }

  /**
   * Resolves with a single ledger agent for given options. If "id" is not
   * specified the first ledger agent will be resolved.
   *
   * @param {object} [options={}] - Options for getAgent.
   * @param {string} [options.id] - The ledger agent ID.
   *
   * @returns {Promise<object>} A ledger agent.
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
   * @param {object} options - Options for wrap.
   * @param {object} options.record - The record to wrap into an operation.
   * @param {boolean} [options.addCreator=true]
   * - Assign the ledger agent's `targetNode`
   *  as the `creator` in the wrapped operation.
   * @param {('create'|'update')} [options.operationType=create]
   * - The type of wrapper to generate.
   *
   * @returns {Promise<object>} - The wrapped record.
   */
  async wrap({addCreator = true, record, operationType = 'create'}) {
    if(!this.ledgerAgent) {
      await this.getAgent();
    }
    const operation = {
      '@context': [
        constants.WEB_LEDGER_CONTEXT_V1_URL,
        constants.ZCAP_CONTEXT_V1_URL
      ]
    };

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
