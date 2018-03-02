
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
        expect(response.vPubKeyMultihash).to.equal('fakepvmultihash');
        // Calls
        expect(mkt.chluIpfs.instance.vendor.storePublicKey.called).to.be.true;
        expect(mkt.chluIpfs.instance.vendor.signMultihash.called).to.be.true;
        // State
        const vendor = await mkt.db.getVendor(response.vPubKeyMultihash);
        expect(vendor).to.be.an('object');
        expect(vendor.vPubKeyMultihash).to.equal('fakepvmultihash');
        expect(vendor.vmKeyPairWIF)
            .to.be.a('string');
        expect(vendor.vmPubKeyMultihash)
            .to.be.a('string');
        expect(vendor.mSignature)
            .to.be.a('string');
        expect(vendor.vSignature)
            .to.be.null;
        // Response
        expect(response.vPubKeyMultihash)
            .to.equal(vendor.vPubKeyMultihash);
        expect(response.mSignature)
            .to.equal(vendor.mSignature);
        expect(response).to.be.an('object');
    });

    it('can submit a vendor signature', async () => {
        const vendorData = await mkt.registerVendor('fakepvmultihash');
        await mkt.updateVendorSignature(
            vendorData.vPubKeyMultihash,
            'fakesignature',
            'fakepvmultihash'
        );
        expect(mkt.chluIpfs.instance.vendor.verifyMultihash.calledWith(
            'fakepvmultihash',
            vendorData.vmPubKeyMultihash,
            'fakesignature'
        )).to.be.true;
        const vendor = await mkt.db.getVendor(vendorData.vPubKeyMultihash);
        expect(vendor.vPubKeyMultihash).to.equal('fakepvmultihash');
        expect(vendor.vSignature).to.equal('fakesignature');
    });

    it.skip('can list vendors');
    it.skip('can retrieve vendor information');
    it.skip('can create then reuse existing root keypair');
    it.skip('can generate PoPRs');
});