
const expect = require('chai').expect;
const sinon = require('sinon');
const Marketplace = require('../src');
const rimraf = require('rimraf');
const path = require('path');
const tmpDir = path.join(require('os').tmpdir(), 'chlu-marketplace-tests');
const keyFile = path.join(tmpDir, 'chlu-marketplace-key.txt');
const dbFile = path.join(tmpDir, 'db.sqlite');
const { ECPair } = require('bitcoinjs-lib');

describe('Marketplace (Integration)', () => {
    let mkt;

    async function getRandomVendor() {
        const keyPair = ECPair.makeRandom();
        const multihash = await mkt.chluIpfs.instance.crypto.storePublicKey(keyPair.getPublicKeyBuffer());
        return {
            keyPair,
            multihash
        };
    }

    before(async () => {
        mkt = new Marketplace({
            rootKeyPairPath: keyFile,
            db: {
                storage: dbFile,
                password: 'test'
            },
            chluIpfs: {
                logger: {
                    debug: () => {},
                    info: () => {},
                    warn: () => {},
                    error: msg => console.log('[ChluIPFS][ERROR]', msg)
                },
                directory: tmpDir,
                persistence: false,
                ipfs: {
                    config: {
                        Addresses: {
                            Swarm: []
                        }
                    }
                }
            }
        });
        // Start manually since we call it from outside during the tests
        await mkt.chluIpfs.start();
        const c = mkt.chluIpfs.instance.crypto;
        sinon.spy(c, 'storePublicKey');
        sinon.spy(c, 'signMultihash');
        sinon.spy(c, 'verifyMultihash');
        sinon.spy(c, 'signPoPR');
    });

    after(async () => {
        await mkt.stop();
        rimraf.sync(tmpDir);
    });

    afterEach(() => {
        const c = mkt.chluIpfs.instance.crypto;
        c.storePublicKey.resetHistory();
        c.signMultihash.resetHistory();
        c.verifyMultihash.resetHistory();
        c.signPoPR.resetHistory();
    });

    it('can register a new vendor', async () => {
        const v = await getRandomVendor();
        const response = await mkt.registerVendor(v.multihash);
        expect(response.vPubKeyMultihash).to.equal(v.multihash);
        // Calls
        expect(mkt.chluIpfs.instance.crypto.storePublicKey.called).to.be.true;
        expect(mkt.chluIpfs.instance.crypto.signMultihash.called).to.be.true;
        // State
        const vendor = await mkt.db.getVendor(response.vPubKeyMultihash);
        expect(vendor).to.be.an('object');
        expect(vendor.vPubKeyMultihash).to.equal(v.multihash);
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
        // Verify signatures
        const mMultihash = (await mkt.getKeys()).pubKeyMultihash;
        const valid = await mkt.chluIpfs.instance.crypto.verifyMultihash(mMultihash, response.vmPubKeyMultihash, vendor.mSignature);
        expect(valid).to.be.true;
    });

    it('can submit a vendor signature', async () => {
        const v = await getRandomVendor();
        const vendorData = await mkt.registerVendor(v.multihash);
        const signature = await mkt.chluIpfs.instance.crypto.signMultihash(vendorData.vmPubKeyMultihash, v.keyPair);
        await mkt.updateVendorSignature(
            vendorData.vPubKeyMultihash,
            signature,
            v.multihash
        );
        expect(mkt.chluIpfs.instance.crypto.verifyMultihash.calledWith(
            v.multihash,
            vendorData.vmPubKeyMultihash,
            signature
        )).to.be.true;
        const vendor = await mkt.db.getVendor(vendorData.vPubKeyMultihash);
        expect(vendor.vPubKeyMultihash).to.equal(v.multihash);
        expect(vendor.vSignature).to.equal(signature);
    });

    it('can list vendors', async () => {
        const v = await getRandomVendor();
        await mkt.registerVendor(v.multihash);
        const vendors = await mkt.getVendorIDs();
        expect(vendors).to.be.an('Array');
        expect(vendors.indexOf(v.multihash)).to.be.above(-1);
    });

    it('can retrieve vendor information', async() => {
        const v = await getRandomVendor();
        await mkt.registerVendor(v.multihash);
        const vendor = await mkt.getVendor(v.multihash);
        // Intentionally check that the keypair is not returned
        expect(vendor.vPubKeyMultihash).to.equal(v.multihash);
        expect(vendor.vmPubKeyMultihash).to.be.a('string');
        expect(vendor.vSignature).to.be.null;
        expect(vendor.mSignature).to.be.a('string');
    });

    it('can create valid PoPRs', async () => {
        // Vendor full setup
        const v = await getRandomVendor();
        const vendorData = await mkt.registerVendor(v.multihash);
        const signature = await mkt.chluIpfs.instance.crypto.signMultihash(vendorData.vmPubKeyMultihash, v.keyPair);
        await mkt.updateVendorSignature(
            vendorData.vPubKeyMultihash,
            signature,
            v.multihash
        );
        const vendor = await mkt.db.getVendor(vendorData.vPubKeyMultihash);
        // Create PoPR
        const popr = await mkt.createPoPR(v.multihash);
        // Check that the right calls were made
        expect(mkt.chluIpfs.instance.crypto.signPoPR.called).to.be.true;
        // Check the popr content
        expect(popr.item_id).to.be.a('string');
        expect(popr.invoice_id).to.be.a('string');
        expect(popr.customer_id).to.be.a('string');
        expect(popr.created_at).to.be.a('number');
        expect(popr.expires_at).to.be.a('number');
        expect(popr.currency_symbol).to.be.a('string');
        expect(popr.amount).to.be.a('number');
        expect(popr.marketplace_url).to.be.a('string');
        expect(popr.marketplace_vendor_url).to.be.a('string');
        expect(popr.key_location).to.equal('/ipfs/' + vendor.vmPubKeyMultihash);
        expect(popr.chlu_version).to.equal(0);
        expect(Array.isArray(popr.attributes)).to.be.true;
        expect(popr.signature).to.be.a('string');
        // Check popr validity
        mkt.chluIpfs.instance.validator.fetchMarketplaceKey = sinon.stub().callsFake(async url => {
            // Stub key retrieval from marketplace
            expect(url).to.equal(popr.marketplace_url);
            return mkt.pubKeyMultihash;
        });
        const valid = await mkt.chluIpfs.instance.validator.validatePoPRSignaturesAndKeys(popr);
        expect(valid).to.be.true;
    });
});