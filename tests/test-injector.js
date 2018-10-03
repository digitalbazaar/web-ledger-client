'use strict';

const contexts = require('../lib/contexts');
const Injector = require('../lib/Injector');
const injector = new Injector();

// FIXME: determine how to simplify/move this code out of test
const jsonld = injector.use('jsonld');
const documentLoader = jsonld.documentLoader;

jsonld.documentLoader = async url => {
  if(url in contexts) {
    return {
      contextUrl: null,
      documentUrl: url,
      document: contexts[url]
    };
  }
  return documentLoader(url);
};
injector.use('jsonld', jsonld);
const jsigs = require('jsonld-signatures');
jsigs.use('jsonld', jsonld);
injector.use('jsonld-signatures', jsigs);

injector.env = {nodejs: true};

module.exports = injector;
