const expect = require('chai').expect;

describe('Index', () => {
    it('returns the Marketplace library', () => {
        const Marketplace = require('../src');
        expect(Marketplace).to.be.a('function');
    });
});