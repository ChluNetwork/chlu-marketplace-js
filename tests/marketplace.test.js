
const expect = require('chai').expect;
const sinon = require('sinon');
const Marketplace = require('../src/marketplace');

describe('Marketplace', () => {
    let mkt;

    beforeEach(() => {
        mkt = new Marketplace();
        mkt.chluIpfs = {
            start: sinon.stub().resolves(),
            instance: {
                vendor: {
                    storePublicKey: sinon.stub().resolves('fakemultihash'),
                    signMultihash: sinon.stub().resolves('fakesignature')
                }
            }
        };
    });

    it('starts correctly', done => {
        mkt.events.on('started', () => {
            expect(mkt.chluIpfs.start.called).to.be.true;
            done();
        });
        expect(mkt.start()).to.be.a('promise');
    });

    it('can register a new vendor', async () => {
        const response = await mkt.registerVendor();
        // Calls
        expect(mkt.chluIpfs.instance.vendor.storePublicKey.called).to.be.true;
        expect(mkt.chluIpfs.instance.vendor.signMultihash.called).to.be.true;
        // State
        expect(mkt.vendors[response.id]).to.be.an('object');
        expect(mkt.vendors[response.id].vendorPubKey.multihash).to.be.null;
        expect(mkt.vendors[response.id].vendorMarketplacePubKey.multihash)
            .to.be.a('string');
        expect(mkt.vendors[response.id].vendorMarketplacePubKey.marketplaceSignature)
            .to.be.a('string');
        expect(mkt.vendors[response.id].vendorMarketplacePubKey.vendorSignature)
            .to.be.null;
        // Response
        expect(response.multihash)
            .to.equal(mkt.vendors[response.id].vendorMarketplacePubKey.multihash);
        expect(response.marketplaceSignature)
            .to.equal(mkt.vendors[response.id].vendorMarketplacePubKey.marketplaceSignature);
        expect(response).to.be.an('object');
        expect(response.id).to.equal(1);
    });
});