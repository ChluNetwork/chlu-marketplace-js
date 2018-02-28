const request = require('supertest');
const sinon = require('sinon');

describe('HTTP API', () => {
    let api;

    beforeEach(() => {
        const server = require('../src');
        server.locals.mkt = {
            clear: sinon.stub(),
            registerVendor: sinon.stub().resolves(),
            generatePoPR: sinon.stub().resolves(),
            getVendorIDs: sinon.stub().returns([])
        };
        api = request(server);
    });

    it('GET /', async () => {
        await api.get('/').expect(200);
    });
});
