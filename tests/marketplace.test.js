
const expect = require('chai').expect;
const sinon = require('sinon');
const Marketplace = require('../src');
const rimraf = require('rimraf');
const path = require('path');
const keyFile = path.join(require('os').tmpdir(), 'chlu-marketplace-key.txt');
const { toMultihash } = require('./utils/ipfs');
const { createDAGNode, getDAGNodeMultihash } = require('chlu-ipfs-support/src/utils/ipfs')

describe('Marketplace (Unit)', () => {
    let mkt, fakemultihash, fakevendordidid, fakesignature;

    before(async () => {
        fakemultihash = await toMultihash('fakemultihash');
        fakevendordidid = await 'did:chlu:vendor';
        fakesignature = { signatureValue: 'fakesignature', creator: fakevendordidid }
    });

    beforeEach(async () => {
        rimraf.sync(keyFile);
        mkt = new Marketplace({
            rootKeyPairPath: keyFile,
            db: {
                password: 'test',
                storage: ':memory:'
            },
            logger: {
                debug: () => {},
                info: () => {},
                warning: () => console.log(...arguments),
                error: () => console.log(...arguments),
            },
        });
        mkt.chluIpfs = {
            start: sinon.stub().resolves(),
            stop: sinon.stub().resolves(),
            pin: sinon.stub().resolves(),
            protobuf: {
                PoPR: {
                    encode: sinon.stub().resolves(Buffer.from('fake encoded popr'))
                }
            },
            ipfsUtils: {
                id: sinon.stub().resolves('fakeIPFSid'),
                put: sinon.stub().resolves(await toMultihash('fakemultihash'))
            },
            didIpfsHelper: {
                signMultihash: sinon.stub().resolves(fakesignature),
                verifyMultihash: sinon.stub().resolves(true),
            },
            crypto: {
                generateKeyPair: sinon.stub().resolves({ keyPair: 'keyPair', pubKeyMultihash: fakemultihash}),
                exportKeyPair: sinon.stub().callsFake(async k => 'exported' + k),
                importKeyPair: sinon.stub().callsFake(async k => k.slice('exported'.length)),
                storePublicKey: sinon.stub().resolves(fakemultihash),
                signMultihash: sinon.stub().resolves(fakesignature),
                verifyMultihash: sinon.stub().resolves(true),
                signPoPR: sinon.stub().callsFake(async popr => {
                    return Object.assign(popr, {
                        signature: fakesignature
                    });
                })
            }
        };
        sinon.spy(mkt.db, 'start');
        sinon.spy(mkt.db, 'stop');
    });

    it('starts correctly', done => {
        mkt.events.on('started', () => {
            try {
                expect(mkt.chluIpfs.start.called).to.be.true;
                expect(mkt.db.start.called).to.be.true;
                done();
            } catch (err) {
                done(err);
            }
        });
        mkt.start().catch(done);
    });

    it('stops correctly', done => {
        // Fake started status
        mkt.started = true;
        mkt.events.on('stopped', () => {
            try {
                expect(mkt.chluIpfs.stop.called).to.be.true;
                expect(mkt.db.stop.called).to.be.true;
                done();
            } catch (err) {
                done(err);
            }
        });
        mkt.stop().catch(done);
    });

    it('can register a new vendor', async () => {
        const response = await mkt.registerVendor(fakevendordidid);
        expect(response.vDidId).to.equal(fakevendordidid);
        // Calls
        expect(mkt.chluIpfs.didIpfsHelper.signMultihash.called).to.be.true;
        expect(mkt.chluIpfs.pin.calledWith(fakemultihash)).to.be.true;
        // State
        const vendor = await mkt.db.getVendor(response.vDidId);
        expect(vendor).to.be.an('object');
        expect(vendor.vDidId).to.equal(fakevendordidid);
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
    });

    it('can submit a vendor signature without passing the did document', async () => {
        const vendorData = await mkt.registerVendor(fakevendordidid);
        await mkt.updateVendorSignature(fakesignature);
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.calledWith(
            fakevendordidid,
            vendorData.vmPubKeyMultihash,
            fakesignature
        )).to.be.true;
        const vendor = await mkt.db.getVendor(vendorData.vDidId);
        expect(vendor.vDidId).to.equal(fakevendordidid);
        expect(vendor.vSignature).to.equal(fakesignature.signatureValue);
    });

    it('can submit a vendor signature with the vendor did document', async () => {
        const vendorData = await mkt.registerVendor(fakevendordidid);
        const fakevendordid = { id: fakevendordidid }
        await mkt.updateVendorSignature(fakesignature, fakevendordid);
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.calledWith(
            fakevendordid,
            vendorData.vmPubKeyMultihash,
            fakesignature
        )).to.be.true;
        const vendor = await mkt.db.getVendor(vendorData.vDidId);
        expect(vendor.vDidId).to.equal(fakevendordidid);
        expect(vendor.vSignature).to.equal(fakesignature.signatureValue);
    });

    it('can update the profile data without passing the did document', async () => {
        await mkt.registerVendor(fakevendordidid)
        const profile = {
            name: 'Developer'
        }
        await mkt.updateVendorProfile(profile, fakesignature)
        const multihash = getDAGNodeMultihash(await createDAGNode(Buffer.from(JSON.stringify(profile))))
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.calledWith(
            fakevendordidid,
            multihash,
            fakesignature
        )).to.be.true;
        const vendorData = await mkt.getVendor(fakevendordidid)
        expect(vendorData.profile).to.deep.equal(profile)
    })

    it('can update the profile data with the vendor did document', async () => {
        await mkt.registerVendor(fakevendordidid)
        const fakevendordid = { id: fakevendordidid }
        const profile = {
            name: 'Developer'
        }
        await mkt.updateVendorProfile(profile, fakesignature, fakevendordid)
        const multihash = getDAGNodeMultihash(await createDAGNode(Buffer.from(JSON.stringify(profile))))
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.calledWith(
            fakevendordid,
            multihash,
            fakesignature
        )).to.be.true;
        const vendorData = await mkt.getVendor(fakevendordidid)
        expect(vendorData.profile).to.deep.equal(profile)
    })

    it('can list vendors', async () => {
        await mkt.registerVendor(fakevendordidid);
        const vendors = await mkt.getVendorIDs();
        expect(vendors).to.deep.equal([fakevendordidid]);
    });

    it('can retrieve vendor information', async() => {
        await mkt.registerVendor(fakevendordidid);
        const vendor = await mkt.getVendor(fakevendordidid);
        // Intentionally check that the keypair is not returned
        expect(vendor).to.deep.equal({
            vmPubKeyMultihash: fakemultihash,
            vDidId: fakevendordidid,
            vSignature: null,
            mSignature: fakesignature.signatureValue,
            profile: {}
        });
    });

    it('can create PoPRs', async () => {
        const v = await mkt.registerVendor(fakevendordidid);
        const { popr, multihash } = await mkt.createPoPR(fakevendordidid);
        // Calls
        expect(mkt.chluIpfs.crypto.signPoPR.called).to.be.true;
        expect(mkt.chluIpfs.protobuf.PoPR.encode.calledWith(popr)).to.be.true
        const binary = await mkt.chluIpfs.protobuf.PoPR.encode.returnValues[0] // unwrap promise
        expect(mkt.chluIpfs.ipfsUtils.put.args[0][0]).to.deep.equal(binary)
        // Multihash
        expect(multihash).to.equal(await toMultihash('fakemultihash'))
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
        expect(popr.signature).to.equal(fakesignature);
    });
});