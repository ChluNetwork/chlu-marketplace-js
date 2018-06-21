
const expect = require('chai').expect;
const sinon = require('sinon');
const Marketplace = require('../src');
const rimraf = require('rimraf');
const path = require('path');
const keyFile = path.join(require('os').tmpdir(), 'chlu-marketplace-key.txt');
const { toMultihash } = require('./utils/ipfs');

describe('Marketplace (Unit)', () => {
    let mkt, fakemultihash, fakevendordidid, fakesignature = 'fakesignature';

    before(async () => {
        fakemultihash = await toMultihash('fakemultihash');
        fakevendordidid = await 'did:vendor';
    });

    beforeEach(() => {
        rimraf.sync(keyFile);
        mkt = new Marketplace({
            rootKeyPairPath: keyFile,
            db: {
                password: 'test',
                storage: ':memory:'
            }
        });
        sinon.spy(mkt.db, 'start');
        sinon.spy(mkt.db, 'stop');
        mkt.chluIpfs = {
            start: sinon.stub().resolves(),
            stop: sinon.stub().resolves(),
            pin: sinon.stub().resolves(),
            instance: {
                ipfsUtils: {
                    id: sinon.stub().resolves('fakeIPFSid')
                },
                did: {
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
            }
        };
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
        expect(mkt.chluIpfs.instance.did.signMultihash.called).to.be.true;
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

    it('can submit a vendor signature', async () => {
        const vendorData = await mkt.registerVendor(fakevendordidid);
        await mkt.updateVendorSignature(
            vendorData.vDidId,
            fakesignature,
            fakevendordidid
        );
        expect(mkt.chluIpfs.instance.did.verifyMultihash.calledWith(
            fakevendordidid,
            vendorData.vmPubKeyMultihash,
            fakesignature
        )).to.be.true;
        const vendor = await mkt.db.getVendor(vendorData.vDidId);
        expect(vendor.vDidId).to.equal(fakevendordidid);
        expect(vendor.vSignature).to.equal(fakesignature);
    });

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
            mSignature: fakesignature
        });
    });

    it('can create PoPRs', async () => {
        const v = await mkt.registerVendor(fakevendordidid);
        const popr = await mkt.createPoPR(fakevendordidid);
        // Calls
        expect(mkt.chluIpfs.instance.crypto.signPoPR.called).to.be.true;
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