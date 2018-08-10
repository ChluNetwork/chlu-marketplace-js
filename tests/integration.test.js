
const expect = require('chai').expect;
const sinon = require('sinon');
const Marketplace = require('../src');
const rimraf = require('rimraf');
const path = require('path');
const tmpDir = path.join(require('os').tmpdir(), 'chlu-marketplace-tests');
const ChluDID = require('chlu-did/src')
const ChluSQLIndex = require('chlu-ipfs-support/src/modules/orbitdb/indexes/sql')
const { createDAGNode, getDAGNodeMultihash } = require('chlu-ipfs-support/src/utils/ipfs')

describe('Marketplace (Integration)', () => {
    let mkt, DID;

    async function getRandomVendor() {
        const did = await DID.generateDID()
        await mkt.chluIpfs.didIpfsHelper.publish(did, false)
        return did
    }

    before(async () => {
        DID = new ChluDID()
        mkt = new Marketplace({
            chluIpfs: {
                network: 'test', // so that it doesn't talk to other nodes
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
                },
                OrbitDBIndex: ChluSQLIndex // Use the SQL Index
            },
            logger: {
                debug: () => {},
                info: () => {},
                warning: () => console.log(...arguments),
                error: () => console.log(...arguments),
            },
        });
        // Start manually since we call it from outside during the tests
        await mkt.chluIpfs.start();
        const c = mkt.chluIpfs.crypto;
        const d = mkt.chluIpfs.didIpfsHelper
        sinon.spy(d, 'signMultihash');
        sinon.spy(d, 'verifyMultihash');
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
        const c = mkt.chluIpfs.crypto;
        c.storePublicKey.resetHistory();
        c.signMultihash.resetHistory();
        c.verifyMultihash.resetHistory();
        c.signPoPR.resetHistory();
    });

    it('can register a new vendor', async () => {
        const v = await getRandomVendor();
        const response = await mkt.registerVendor(v.publicDidDocument.id);
        expect(response.vDidId).to.equal(v.publicDidDocument.id);
        // Calls
        expect(mkt.chluIpfs.crypto.storePublicKey.called).to.be.true;
        expect(mkt.chluIpfs.didIpfsHelper.signMultihash.called).to.be.true;
        // State
        const vendor = await mkt.db.getVendor(response.vDidId);
        expect(vendor).to.be.an('object');
        expect(vendor.vDidId).to.equal(v.publicDidDocument.id);
        expect(vendor.vmPrivateKey)
            .to.be.a('string');
        expect(vendor.vmPubKeyMultihash)
            .to.be.a('string');
        expect(vendor.mSignature)
            .to.be.a('string');
        expect(vendor.vSignature)
            .to.be.null;
        // Response
        expect(response.vDidId)
            .to.equal(vendor.vDidId);
        expect(response.mSignature)
            .to.equal(vendor.mSignature);
        expect(response).to.be.an('object');
        // Verify signatures
        const mDidId = await mkt.getDIDID()
        const signature = {
            type: 'did:chlu',
            signatureValue: vendor.mSignature,
            creator: mkt.chluIpfs.didIpfsHelper.didId
        }
        const valid = await mkt.chluIpfs.didIpfsHelper.verifyMultihash(mDidId, response.vmPubKeyMultihash, signature);
        expect(valid).to.be.true;
    });

    it('can submit a vendor signature', async () => {
        const v = await getRandomVendor();
        const vendorData = await mkt.registerVendor(v.publicDidDocument.id);
        const signature = await mkt.chluIpfs.didIpfsHelper.signMultihash(vendorData.vmPubKeyMultihash, v);
        await mkt.updateVendorSignature(signature);
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.calledWith(
            v.publicDidDocument.id,
            vendorData.vmPubKeyMultihash,
            signature
        )).to.be.true;
        const vendor = await mkt.db.getVendor(vendorData.vDidId);
        expect(vendor.vDidId).to.equal(v.publicDidDocument.id);
        expect(vendor.vSignature).to.equal(signature.signatureValue);
    });

    it('can update the profile data', async () => {
        const v = await getRandomVendor();
        await mkt.registerVendor(v.publicDidDocument.id)
        const profile = {
            name: 'Developer'
        }
        const multihash = getDAGNodeMultihash(await createDAGNode(Buffer.from(JSON.stringify(profile))))
        const signature = await mkt.chluIpfs.didIpfsHelper.signMultihash(multihash, v);
        await mkt.updateVendorProfile(profile, signature)
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.calledWith(
            v.publicDidDocument.id,
            multihash,
            signature
        )).to.be.true;
        const vendorData = await mkt.getVendor(v.publicDidDocument.id)
        expect(vendorData.profile).to.deep.equal(profile)
    })

    it('can list vendors', async () => {
        const v = await getRandomVendor();
        await mkt.registerVendor(v.publicDidDocument.id);
        const vendors = await mkt.getVendorIDs();
        expect(vendors).to.be.an('Array');
        expect(vendors.indexOf(v.publicDidDocument.id)).to.be.above(-1);
    });

    it('can retrieve vendor information', async() => {
        const v = await getRandomVendor();
        await mkt.registerVendor(v.publicDidDocument.id);
        const vendor = await mkt.getVendor(v.publicDidDocument.id);
        // Intentionally check that the keypair is not returned
        expect(vendor.vDidId).to.equal(v.publicDidDocument.id);
        expect(vendor.vmPubKeyMultihash).to.be.a('string');
        expect(vendor.vSignature).to.be.null;
        expect(vendor.mSignature).to.be.a('string');
    });

    it('can create valid PoPRs', async () => {
        // Vendor full setup
        const v = await getRandomVendor();
        const vendorData = await mkt.registerVendor(v.publicDidDocument.id);
        const signature = await mkt.chluIpfs.didIpfsHelper.signMultihash(vendorData.vmPubKeyMultihash, v);
        await mkt.updateVendorSignature(signature);
        const vendor = await mkt.db.getVendor(vendorData.vDidId);
        // Create PoPR
        const { popr, multihash } = await mkt.createPoPR(v.publicDidDocument.id);
        // Check that the right calls were made
        expect(mkt.chluIpfs.crypto.signPoPR.called).to.be.true;
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
        expect(popr.signature.signatureValue).to.be.a('string');
        // Check popr validity
        mkt.chluIpfs.validator.fetchMarketplaceDIDID = sinon.stub().callsFake(async url => {
            // Stub key retrieval from marketplace
            expect(url).to.equal(popr.marketplace_url);
            return await mkt.getDIDID();
        });
        const resolvedPoPR = await mkt.chluIpfs.reviewRecords.resolvePoPR(popr)
        const valid = await mkt.chluIpfs.validator.validatePoPRSignaturesAndKeys(resolvedPoPR);
        expect(valid).to.be.true;
        // Check storage on IPFS
        const buffer = await mkt.chluIpfs.ipfsUtils.get(multihash)
        const decoded = await mkt.chluIpfs.protobuf.PoPR.decode(buffer)
        expect(decoded.created_at).to.equal(popr.created_at)
    });
});