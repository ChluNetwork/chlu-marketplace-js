const expect = require('chai').expect;
const request = require('supertest');
const sinon = require('sinon');

describe('HTTP API', () => {
    let api, mkt;

    beforeEach(() => {
        const server = require('../src/server');
        mkt = server.locals.mkt = {
            registerVendor: sinon.stub().resolves({
                vDidId: 'fakevendordidid',
                vmPubKeyMultihash: 'fakevmmultihash',
                mSignature: 'fakesignature'
            }),
            updateVendorSignature: sinon.stub().resolves(),
            generatePoPR: sinon.stub().resolves(),
            getVendorIDs: sinon.stub().resolves([
                'ven1', 'ven2'
            ]),
            getVendor: sinon.stub().resolves({
                vDidId: 'fakevendordidid',
                marketplaceSignature: 'fakesignature',
                vendorSignature: null
            }),
            getDIDID: sinon.stub().resolves('fakemarketplacedid'),
            createPoPR: sinon.stub().resolves({
                signature: 'fakesignature'
            }),
            getIPFSID: sinon.stub.resolves('fakeIPFSid')
        };
        api = request(server);
    });

    it('GET /', async () => {
        await api.get('/').expect(200);
    });

    it('GET /vendors', async () => {
        await api.get('/vendors').expect(['ven1', 'ven2']);
    });

    it('GET /vendors/ven1', async () => {
        await api.get('/vendors/ven1').expect({
            vDidId: 'fakevendordidid',
            marketplaceSignature: 'fakesignature',
            vendorSignature: null
        });
        expect(mkt.getVendor.calledWith('ven1')).to.be.true;
    });

    it('GET /.well-known', async () => {
        await api.get('/.well-known').expect({
            didId: 'fakemarketplacedid'
        });
    });

    it('POST /vendors', async () => {
        await api.post('/vendors')
            .send({
                didId: 'fakevendordidid'
            })
            .expect({
                vDidId: 'fakevendordidid',
                vmPubKeyMultihash: 'fakevmmultihash',
                mSignature: 'fakesignature'
            });
        expect(mkt.registerVendor.calledWith('fakevendordidid')).to.be.true;
    });

    it('POST /vendors/ven1/signature', async () => {
        await api.post('/vendors/ven1/signature')
            .send({
                signature: 'fakevendorsignature'
            })
            .expect(200);
        expect(mkt.updateVendorSignature.calledWith('ven1', 'fakevendorsignature'))
            .to.be.true;
    });

    it('POST /vendors/ven1/popr', async () => {
        await api.post('/vendors/ven1/popr')
            .send({
                amount: 521
            })
            .expect(200);
    });
});
