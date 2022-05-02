/*!
 * Copyright (c) 2018-2022 Digital Bazaar, Inc. All rights reserved.
 */
import nock from 'nock';
import chai from 'chai';
const should = chai.should();

const {expect} = chai;

import {
  constants, WebLedgerClient, WebLedgerClientError
} from '../lib/index.js';

import {createRequire} from 'module';
const requireJson = createRequire(import.meta.url);

const TEST_HOSTNAME = 'genesis.testnet.veres.one';
const TEST_DID_RESULT = requireJson('./dids/genesis.testnet.did.json');
const TEST_DID = TEST_DID_RESULT.record.id;
const LEDGER_AGENTS_DOC = requireJson('./dids/ledger-agents.json');
const LEDGER_AGENT_STATUS = requireJson('./dids/ledger-agent-status.json');

const jsonldHeaders = {
  'content-type': 'application/ld+json, application/json'
};

describe('web ledger client', () => {
  let client;

  beforeEach(() => {
    client = new WebLedgerClient({hostname: TEST_HOSTNAME});
  });

  describe('veres one client', () => {
    describe('getAgent', () => {
      it('should resolve with an agent url for a ledger', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        _nockLedgerAgentStatus();

        const agent = await client.getAgent();
        expect(agent.id.startsWith('urn:uuid:')).to.be.true;
        const {ledgerConfigService} = agent.service;
        expect(ledgerConfigService.endsWith('/config')).to.be.true;
      });
      it('returns NotFoundError', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(404);

        let error;
        let result;
        try {
          result = await client.getAgent();
        } catch(e) {
          error = e;
        }
        expect(result).not.to.exist;
        expect(error).to.exist;
        error.name.should.equal('NotFoundError');
        error.details.status.should.equal(404);
      });
      it('handles a 400 properly', async () => {
        const reply = {helpful: 'information'};
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(400, reply);
        let error;
        let result;
        try {
          result = await client.getAgent();
        } catch(e) {
          error = e;
        }
        expect(result).not.to.exist;
        expect(error).to.exist;
        error.name.should.equal('NetworkError');
        error.details.error.should.eql(reply);
        error.details.status.should.equal(400);
      });
    }); // end getAgent

    describe('getServiceEndpoint', () => {
      beforeEach(() => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);
        _nockLedgerAgentStatus();
      });
      it('returns a service endpoint', async () => {
        const result = await client.getServiceEndpoint(
          {serviceId: 'ledgerOperationService'});
        should.exist(result);
        result.should.be.a('string');
        result.should.equal(LEDGER_AGENT_STATUS.service.ledgerOperationService);
      });
      it('throws NotFoundError for an unknown service ID', async () => {
        let error;
        let result;
        try {
          result = await client.getServiceEndpoint(
            {serviceId: 'unknownService'});
        } catch(e) {
          error = e;
        }
        should.exist(error);
        should.not.exist(result);
        error.should.be.instanceof(WebLedgerClientError);
        error.name.should.equal('NotFoundError');
        should.exist(error.details.serviceId);
        should.exist(error.details.ledgerAgent);
      });
    }); // end getServiceEndpoint

    describe('getTargetNode', () => {
      beforeEach(() => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);
      });
      it('returns the `targetNode` for a ledger agent', async () => {
        _nockLedgerAgentStatus();
        const result = await client.getTargetNode();
        should.exist(result);
        result.should.be.a('string');
        result.should.equal(LEDGER_AGENT_STATUS.targetNode);
      });
      it('throws NotFoundError if `targetNode` is not defined', async () => {
        _nockLedgerAgentStatus({removeTargetNode: true});
        let error;
        let result;
        try {
          result = await client.getTargetNode();
        } catch(e) {
          error = e;
        }
        should.exist(error);
        should.not.exist(result);
        error.should.be.instanceof(WebLedgerClientError);
        error.name.should.equal('NotFoundError');
        should.exist(error.details.ledgerAgentStatus);
      });
    }); // end getTargetNode

    describe('getRecord', () => {
      it('should fetch a did doc from ledger via https', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        nock('https://genesis.testnet.veres.one')
          .post('/ledger-agents/72fdcd6a-5861-4307-ba3d-cbb72509533c' +
               '/query?id=' + encodeURIComponent(TEST_DID))
          .reply(200, TEST_DID_RESULT, jsonldHeaders);

        _nockLedgerAgentStatus();

        const result = await client.getRecord({id: TEST_DID});
        expect(result.record.id).to.equal(TEST_DID);
        expect(result.meta.sequence).to.equal(0);
      });
      it('returns NotFoundError on missing did doc', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        nock('https://genesis.testnet.veres.one')
          .post('/ledger-agents/72fdcd6a-5861-4307-ba3d-cbb72509533c' +
               '/query?id=' + encodeURIComponent(TEST_DID))
          .reply(404);

        _nockLedgerAgentStatus();

        let error;
        let result;
        try {
          result = await client.getRecord({id: TEST_DID});
        } catch(e) {
          error = e;
        }
        expect(result).not.to.exist;
        expect(error).to.exist;
        error.name.should.equal('NotFoundError');
        error.details.status.should.equal(404);
      });
      it('returns NetworkError on http error', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);
        const reply = {helpful: 'information'};
        nock('https://genesis.testnet.veres.one')
          .post('/ledger-agents/72fdcd6a-5861-4307-ba3d-cbb72509533c' +
               '/query?id=' + encodeURIComponent(TEST_DID))
          .reply(400, reply);

        _nockLedgerAgentStatus();

        let error;
        let result;
        try {
          result = await client.getRecord({id: TEST_DID});
        } catch(e) {
          error = e;
        }
        expect(result).not.to.exist;
        expect(error).to.exist;
        error.name.should.equal('NetworkError');
        error.details.error.should.eql(reply);
        error.details.status.should.equal(400);
      });
    }); // end getRecord

    describe('sendOperation', () => {
      it('successfully sends an operation', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);
        const {ledgerAgent: [{service: {ledgerOperationService}}]} =
          LEDGER_AGENTS_DOC;
        nock(ledgerOperationService)
          .post('')
          .reply(201);

        _nockLedgerAgentStatus();

        const record = {id: 'https://example.com/foo'};
        const operation = await client.wrap({record});
        let error;
        let result;
        try {
          result = await client.sendOperation({operation});
        } catch(e) {
          error = e;
        }
        expect(error).not.to.exist;
        expect(result).to.be.null;
      });
      it('handles a 404 properly', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        _nockLedgerAgentStatus();

        const {ledgerAgent: [{service: {ledgerOperationService}}]} =
          LEDGER_AGENTS_DOC;
        nock(ledgerOperationService)
          .post('')
          .reply(404);
        const record = {id: 'https://example.com/foo'};
        const operation = await client.wrap({record});
        let error;
        let result;
        try {
          result = await client.sendOperation({operation});
        } catch(e) {
          error = e;
        }
        expect(result).not.to.exist;
        expect(error).to.exist;
        error.name.should.equal('NetworkError');
        error.details.status.should.equal(404);
      });
      it('handles a 400 properly', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        _nockLedgerAgentStatus();

        const {ledgerAgent: [{service: {ledgerOperationService}}]} =
          LEDGER_AGENTS_DOC;
        const reply = {helpful: 'information'};
        nock(ledgerOperationService)
          .post('')
          .reply(400, reply);
        const record = {id: 'https://example.com/foo'};
        const operation = await client.wrap({record});
        let error;
        let result;
        try {
          result = await client.sendOperation({operation});
        } catch(e) {
          error = e;
        }
        expect(result).not.to.exist;
        expect(error).to.exist;
        error.name.should.equal('NetworkError');
        error.details.status.should.equal(400);
        error.details.error.should.eql(reply);
      });
    }); // end sendOperation

    describe('wrap', () => {
      beforeEach(() => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);
        _nockLedgerAgentStatus();
      });
      const record = {id: 'https://example.com/foo'};
      it('wraps a record into a create operation by default', async () => {
        const result = await client.wrap({record});
        expect(result).to.exist;
        result.should.be.an('object');
        result['@context'].should.eql([
          constants.WEB_LEDGER_CONTEXT_V1_URL,
          constants.ZCAP_CONTEXT_V1_URL
        ]);
        result.record.should.eql(record);
        result.type.should.equal('CreateWebLedgerRecord');
        result.creator.should.equal(LEDGER_AGENT_STATUS.targetNode);
      });
      it('wraps a record into a create operation explicitly', async () => {
        const result = await client.wrap({record, operationType: 'create'});
        expect(result).to.exist;
        result.should.be.an('object');
        result['@context'].should.eql([
          constants.WEB_LEDGER_CONTEXT_V1_URL,
          constants.ZCAP_CONTEXT_V1_URL
        ]);
        result.record.should.eql(record);
        result.type.should.equal('CreateWebLedgerRecord');
        result.creator.should.equal(LEDGER_AGENT_STATUS.targetNode);
      });
      it('wraps a record into an update operation', async () => {
        const result = await client.wrap({record, operationType: 'update'});
        expect(result).to.exist;
        result.should.be.an('object');
        result['@context'].should.eql([
          constants.WEB_LEDGER_CONTEXT_V1_URL,
          constants.ZCAP_CONTEXT_V1_URL
        ]);
        expect(result.record).not.to.exist;
        result.recordPatch.should.eql(record);
        result.type.should.equal('UpdateWebLedgerRecord');
        result.creator.should.equal(LEDGER_AGENT_STATUS.targetNode);
      });
      it('throws on invalid operationType', async () => {
        let error;
        let result;
        try {
          result = result = await client.wrap(
            {record, operationType: 'foo'});
        } catch(e) {
          error = e;
        }
        expect(result).not.to.exist;
        expect(error).to.exist;
        error.name.should.equal('SyntaxError');
      });
    }); // end wrap
  });
});

function _nockLedgerAgentStatus({removeTargetNode = false} = {}) {
  const {ledgerAgent: [{service: {ledgerAgentStatusService}}]} =
    LEDGER_AGENTS_DOC;
  const ledgerAgentStatus = JSON.parse(JSON.stringify(LEDGER_AGENT_STATUS));
  if(removeTargetNode) {
    delete ledgerAgentStatus.targetNode;
  }
  nock(ledgerAgentStatusService)
    .get('')
    .reply(200, ledgerAgentStatus, jsonldHeaders);
}
