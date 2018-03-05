
const expect = require('chai').expect;
const sinon = require('sinon');
const Marketplace = require('../src');
const rimraf = require('rimraf');
const path = require('path');
const keyFile = path.join(require('os').tmpdir(), 'chlu-marketplace-key.txt');

describe('Marketplace', () => {
    let mkt;

    beforeEach(() => {
        rimraf.sync(keyFile);
        mkt = new Marketplace({
            rootKeyPairPath: keyFile,
            db: {
                storage: ':memory:'
            }
        });
        mkt.chluIpfs = {
            start: sinon.stub().resolves(),
            instance: {
                vendor: {
                    storePublicKey: sinon.stub().resolves('fakemultihash'),
                    signMultihash: sinon.stub().resolves('fakesignature'),
                    verifyMultihash: sinon.stub().resolves(true),
                    signPoPR: sinon.stub().callsFake(async popr => {
                        return Object.assign(popr, {
                            signature: 'fakesignature'
                        });
                    }),
                    verifyPoPR: sinon.stub().resolves(true)
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

    it('can list vendors', async () => {
        await mkt.registerVendor('fakepvmultihash');
        const vendors = await mkt.getVendorIDs();
        expect(vendors).to.deep.equal(['fakepvmultihash']);
    });

    it('can retrieve vendor information', async() => {
        await mkt.registerVendor('fakepvmultihash');
        const vendor = await mkt.getVendor('fakepvmultihash');
        // Intentionally check that the keypair is not returned
        expect(vendor).to.deep.equal({
            vmPubKeyMultihash: 'fakemultihash',
            vPubKeyMultihash: 'fakepvmultihash',
            vSignature: null,
            mSignature: 'fakesignature'
        });
    });

    it('can create then reuse existing root keypair', async () => {
        expect(mkt.rootKeyPair).to.be.null;
        expect(mkt.pubKeyMultihash).to.be.null;
        const keys = await mkt.getKeys();
        expect(keys.source).to.equal('random');
        expect(keys.keyPair).to.be.a('object');
        expect(keys.pubKeyMultihash).to.be.a('string');
        expect(keys.keyPair).to.equal(mkt.rootKeyPair);
        expect(keys.pubKeyMultihash).to.equal(mkt.pubKeyMultihash);
        const wif = keys.keyPair.toWIF();
        // Load from memory the same keys
        const sameKeys = await mkt.getKeys();
        expect(sameKeys.source).to.equal('memory');
        expect(sameKeys.keyPair.toWIF()).to.equal(wif);
        // Delete keys from memory to see if loading from fs works
        mkt.rootKeyPair = undefined;
        mkt.pubKeyMultihash = undefined;
        const fsKeys = await mkt.getKeys();
        expect(fsKeys.source.substring(0, 2)).to.equal('fs');
        expect(fsKeys.keyPair.toWIF()).to.equal(wif);
        // Now delete keyfile and keys
        rimraf.sync(keyFile);
        mkt.rootKeyPair = undefined;
        mkt.pubKeyMultihash = undefined;
        // Should get a random key
        const differentKeys = await mkt.getKeys();
        expect(differentKeys.source).to.equal('random');
        expect(differentKeys.keyPair.toWIF()).to.not.equal(wif);
    });

    it('can create PoPRs', async () => {
        const v = await mkt.registerVendor('fakepvmultihash');
        const popr = await mkt.createPoPR('fakepvmultihash');
        // Calls
        expect(mkt.chluIpfs.instance.vendor.signPoPR.called).to.be.true;
        // Schema
        expect(popr.item_id).to.be.a('string');
        expect(popr.invoice_id).to.be.a('string');
        expect(popr.customer_id).to.be.a('string');
        expect(popr.created_at).to.be.a('number');
        expect(popr.expires_at).to.be.a('number');
        expect(popr.currency_symbol).to.be.a('string');
        expect(popr.amount).to.be.a('number');
        expect(popr.marketplace_url).to.be.a('string');
        expect(popr.marketplace_vendor_url).to.be.a('string');
        expect(popr.key_location).to.equal('/ipfs/' + v.vmPubKeyMultihash);
        expect(popr.chlu_version).to.equal(0);
        expect(Array.isArray(popr.attributes)).to.be.true;
        expect(popr.signature).to.equal('fakesignature');
    });
});