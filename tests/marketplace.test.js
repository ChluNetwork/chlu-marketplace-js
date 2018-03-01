
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
                    signMultihash: sinon.stub().resolves('fakesignature'),
                    verifyMultihash: sinon.stub().resolves(true)
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
        const response = await mkt.registerVendor('fakepvmultihash');
        expect(response.id).to.equal('fakepvmultihash');
        // Calls
        expect(mkt.chluIpfs.instance.vendor.storePublicKey.called).to.be.true;
        expect(mkt.chluIpfs.instance.vendor.signMultihash.called).to.be.true;
        // State
        const vendor = await mkt.db.getVendor(response.id);
        expect(vendor).to.be.an('object');
        expect(vendor.vendorPubKey.multihash).to.equal('fakepvmultihash');
        expect(vendor.vendorMarketplaceKeyPairWIF)
            .to.be.a('string');
        expect(vendor.vendorMarketplacePubKey.multihash)
            .to.be.a('string');
        expect(vendor.vendorMarketplacePubKey.marketplaceSignature)
            .to.be.a('string');
        expect(vendor.vendorMarketplacePubKey.vendorSignature)
            .to.be.null;
        // Response
        expect(response.multihash)
            .to.equal(vendor.vendorMarketplacePubKey.multihash);
        expect(response.marketplaceSignature)
            .to.equal(vendor.vendorMarketplacePubKey.marketplaceSignature);
        expect(response).to.be.an('object');
        expect(response.id).to.equal('fakepvmultihash');
    });

    it('can submit a vendor signature', async () => {
        const vendorData = await mkt.registerVendor('fakepvmultihash');
        await mkt.updateVendorSignature(
            vendorData.id,
            'fakesignature',
            'fakepvmultihash'
        );
        expect(mkt.chluIpfs.instance.vendor.verifyMultihash.calledWith(
            'fakepvmultihash',
            vendorData.multihash,
            'fakesignature'
        )).to.be.true;
        const vendor = await mkt.db.getVendor(vendorData.id);
        expect(vendor.vendorPubKey.multihash).to.equal('fakepvmultihash');
        expect(vendor.vendorMarketplacePubKey.vendorSignature).to.equal('fakesignature');
    });

    it.skip('can list vendors');
    it.skip('can retrieve vendor information');
    it.skip('can retrieve the root keypair');
    it.skip('can generate PoPRs');
});