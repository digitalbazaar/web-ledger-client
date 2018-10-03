const nock = require('nock');
const chai = require('chai');
chai.use(require('dirty-chai'));
chai.should();

const {expect} = chai;

const tls = require('tls');
tls.DEFAULT_ECDH_CURVE = 'auto';

const webLedgerClient = require('../lib/index').client;
const injector = require('./test-injector');

const TEST_HOSTNAME = 'genesis.testnet.veres.one';
const TEST_DID = 'did:v1:test:nym:2pfPix2tcwa7gNoMRxdcHbEyFGqaVBPNntCsDZexVeHX';
const TEST_DID_RESULT = require('./dids/genesis.testnet.did.json');
const LEDGER_AGENTS_DOC = require('./dids/ledger-agents.json');

describe('web ledger client', () => {
  let client;

  beforeEach(() => {
    client = new webLedgerClient({
      injector, mode: 'test', hostname: TEST_HOSTNAME
    });
  });

  describe('veres one client', () => {
    describe('getAgent', () => {
      it('should resolve with an agent url for a ledger', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        const agent = await client.getAgent({mode: 'test'});
        expect(agent.id.startsWith('urn:uuid:')).to.be.true();
        const {ledgerConfigService} = agent.service;
        expect(ledgerConfigService.endsWith('/config')).to.be.true();
      });
    });

    describe('get', () => {
      it('should fetch a did doc from ledger via https', async () => {
        nock('https://genesis.testnet.veres.one')
          .get(`/ledger-agents`)
          .reply(200, LEDGER_AGENTS_DOC);

        nock('https://genesis.testnet.veres.one')
          .post('/ledger-agents/72fdcd6a-5861-4307-ba3d-cbb72509533c' +
               '/query?id=' + TEST_DID)
          .reply(200, TEST_DID_RESULT);

        const result = await client.get({id: TEST_DID});
        expect(result.record.id).to.equal(TEST_DID);
        expect(result.meta.sequence).to.equal(0);
      });
    });
  });
});
