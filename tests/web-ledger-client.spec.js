/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const nock = require('nock');
const chai = require('chai');
chai.should();

const {expect} = chai;

const {constants, WebLedgerClient} = require('..');

const TEST_HOSTNAME = 'genesis.testnet.veres.one';
const TEST_DID_RESULT = require('./dids/genesis.testnet.did.json');
const TEST_DID = TEST_DID_RESULT.record.id;
const LEDGER_AGENTS_DOC = require('./dids/ledger-agents.json');

describe('web ledger client', () => {
  let client;

  beforeEach(() => {
    client = new WebLedgerClient({mode: 'test', hostname: TEST_HOSTNAME});
  });

  describe('veres one client', () => {
    describe('getAgent', () => {
      it('should resolve with an agent url for a ledger', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

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

    describe('getRecord', () => {
      it('should fetch a did doc from ledger via https', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        nock('https://genesis.testnet.veres.one')
          .post('/ledger-agents/72fdcd6a-5861-4307-ba3d-cbb72509533c' +
               '/query/?id=' + encodeURIComponent(TEST_DID))
          .reply(200, TEST_DID_RESULT);

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
               '/query/?id=' + encodeURIComponent(TEST_DID))
          .reply(404);

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
               '/query/?id=' + encodeURIComponent(TEST_DID))
          .reply(400, reply);

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
          .post('/')
          .reply(201);
        const record = {id: 'https://example.com/foo'};
        const operation = WebLedgerClient.wrap({record});
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
        const {ledgerAgent: [{service: {ledgerOperationService}}]} =
          LEDGER_AGENTS_DOC;
        nock(ledgerOperationService)
          .post('/')
          .reply(404);
        const record = {id: 'https://example.com/foo'};
        const operation = WebLedgerClient.wrap({record});
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
        const {ledgerAgent: [{service: {ledgerOperationService}}]} =
          LEDGER_AGENTS_DOC;
        const reply = {helpful: 'information'};
        nock(ledgerOperationService)
          .post('/')
          .reply(400, reply);
        const record = {id: 'https://example.com/foo'};
        const operation = WebLedgerClient.wrap({record});
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
      const record = {id: 'https://example.com/foo'};
      it('wraps a record into a create operation by default', () => {
        const result = WebLedgerClient.wrap({record});
        expect(result).to.exist;
        result.should.be.an('object');
        result['@context'].should.equal(constants.WEB_LEDGER_CONTEXT_V1_URL);
        result.record.should.eql(record);
        result.type.should.equal('CreateWebLedgerRecord');
      });
      it('wraps a record into a create operation explicitly', () => {
        const result = WebLedgerClient.wrap({record, operationType: 'create'});
        expect(result).to.exist;
        result.should.be.an('object');
        result['@context'].should.equal(constants.WEB_LEDGER_CONTEXT_V1_URL);
        result.record.should.eql(record);
        result.type.should.equal('CreateWebLedgerRecord');
      });
      it('wraps a record into an update operation', () => {
        const result = WebLedgerClient.wrap({record, operationType: 'update'});
        expect(result).to.exist;
        result.should.be.an('object');
        result['@context'].should.equal(constants.WEB_LEDGER_CONTEXT_V1_URL);
        expect(result.record).not.to.exist;
        result.recordPatch.should.eql(record);
        result.type.should.equal('UpdateWebLedgerRecord');
      });
      it('throws on invalid operationType', () => {
        let error;
        let result;
        try {
          result = result = WebLedgerClient.wrap(
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
