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
            setVendorProfile: sinon.stub().resolves(),
            patchVendorProfile: sinon.stub().resolves(),
            generatePoPR: sinon.stub().resolves(),
            getVendorIDs: sinon.stub().resolves([
                'ven1', 'ven2'
            ]),
            searchVendors: sinon.stub().resolves({
                count: 2,
                rows: [
                    {
                        vDidId: 'ven1'
                    },
                    {
                        vDidId: 'ven2'
                    }
                ]
            }),
            getVendor: sinon.stub().resolves({
                vDidId: 'fakevendordidid',
                marketplaceSignature: 'fakesignature',
                vendorSignature: null
            }),
            getDIDID: sinon.stub().resolves('fakemarketplacedid'),
            createPoPR: sinon.stub().resolves({
                signature: 'fakesignature'
            }),
            getInfo: sinon.stub().resolves({ didId: 'fakemarketplacedid' })
        };
        api = request(server);
    });

    it('GET /', async () => {
        await api.get('/').expect({
            didId: 'fakemarketplacedid'
        });
    });

    it('GET /vendors', async () => {
        await api.get('/vendors').expect(['ven1', 'ven2']);
    });

    it('POST /search', async () => {
        const body = { query: { test: 'a' }, limit: 10, offset: 2 }
        await api.post('/search')
            .send(body)
            .expect({
                count: 2,
                rows: [
                    {
                        vDidId: 'ven1'
                    },
                    {
                        vDidId: 'ven2'
                    }
                ]
            });
        expect(mkt.searchVendors.args[0]).to.deep.equal([
            { test: 'a' },
            10,
            2
        ])
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
        const signature = {
            signatureValue: 'fakevendorsignature',
            creator: 'ven1'
        }
        await api.post('/vendors/ven1/signature')
            .send({ signature })
            .expect(200);
        expect(mkt.updateVendorSignature.calledWith(signature))
            .to.be.true;
        const publicDidDocument = {
            id: 'ven1'
        }
        await api.post('/vendors/ven1/signature')
            .send({ signature, publicDidDocument })
            .expect(200);
        expect(mkt.updateVendorSignature.calledWith(signature, publicDidDocument))
            .to.be.true;
    });

    it('POST /vendors/ven1/profile', async () => {
        const signature = {
            signatureValue: 'fakevendorsignature',
            creator: 'ven1'
        }
        const profile = {
            name: 'Developer'
        }
        await api.post('/vendors/ven1/profile')
            .send({ signature, profile })
            .expect(200);
        expect(mkt.setVendorProfile.calledWith(profile, signature))
            .to.be.true;
    });

    it('PATCH /vendors/ven1/profile', async () => {
        const signature = {
            signatureValue: 'fakevendorsignature',
            creator: 'ven1'
        }
        const profile = {
            name: 'Developer'
        }
        await api.patch('/vendors/ven1/profile')
            .send({ signature, profile })
            .expect(200);
        expect(mkt.patchVendorProfile.calledWith(profile, signature))
            .to.be.true;
    })

    it('POST /vendors/ven1/popr', async () => {
        await api.post('/vendors/ven1/popr')
            .send({
                amount: 521
            })
            .expect(200);
    });
});
