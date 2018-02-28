const expect = require('chai').expect;

describe('Chlu Marketplace', () => {
    it('returns an express server', () => {
        const marketplace = require('../src');
        expect(marketplace.listen).to.be.a('function');
    });
});