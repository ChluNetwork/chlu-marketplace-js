const expect = require('chai').expect;

describe('Index', () => {
    it('returns an express server', () => {
        const marketplace = require('../src');
        expect(marketplace.listen).to.be.a('function');
    });

    it('contains a ref to the Marketplace', () => {
        const marketplace = require('../src');
        expect(marketplace.locals.mkt).to.not.be.undefined; 
    })
});