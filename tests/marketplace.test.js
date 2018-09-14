
const expect = require('chai').expect;
const sinon = require('sinon');
const Marketplace = require('../src');
const rimraf = require('rimraf');
const path = require('path');
const keyFile = path.join(require('os').tmpdir(), 'chlu-marketplace-key.txt');
const { toMultihash } = require('./utils/ipfs');
const { setProfileFullname } = require('../src/profile')

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
            type: 'individual',
            username: 'dev',
            firstname: 'Developer',
            lastname: 'Of Chlu',
            email: 'info@chlu.io',
            vendorAddress: 'abc'
        }
        await mkt.setVendorProfile(profile, fakesignature)
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.args[0][0]).to.equal(fakevendordidid)
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.args[0][2]).to.equal(fakesignature)
        const vendorData = await mkt.getVendor(fakevendordidid)
        expect(vendorData.profile).to.deep.equal(setProfileFullname(profile))
    })

    it('can update the profile data with the vendor did document', async () => {
        await mkt.registerVendor(fakevendordidid)
        const fakevendordid = { id: fakevendordidid }
        const profile = {
            type: 'individual',
            username: 'dev',
            firstname: 'Developer',
            lastname: 'Of Chlu',
            email: 'info@chlu.io',
            vendorAddress: 'abc'
        }
        await mkt.setVendorProfile(profile, fakesignature, fakevendordid)
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.args[0][0]).to.equal(fakevendordid)
        expect(mkt.chluIpfs.didIpfsHelper.verifyMultihash.args[0][2]).to.equal(fakesignature)
        const vendorData = await mkt.getVendor(fakevendordidid)
        expect(vendorData.profile).to.deep.equal(setProfileFullname(profile))
    })

    it('can patch the profile data', async () => {
        await mkt.registerVendor(fakevendordidid)
        const fakevendordid = { id: fakevendordidid }
        const profile = {
            type: 'individual',
            username: 'dev',
            firstname: 'Developer',
            lastname: 'Of Chlu',
            email: 'info@chlu.io',
            vendorAddress: 'abc'
        }
        await mkt.setVendorProfile(profile, fakesignature, fakevendordid)
        const patch = {
            firstname: 'Developer Patched'
        }
        await mkt.patchVendorProfile(patch, fakesignature, fakevendordid)
        let patched = Object.assign({}, profile, { firstname: patch.firstname })
        patched = setProfileFullname(patched)
        const vendorData = await mkt.getVendor(fakevendordidid)
        expect(vendorData.profile).to.deep.equal(patched)
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

    it('can search vendors by data in their profile', async () => {
        await mkt.start()
        async function signupVendor(didId, profile, submitSignature = true) {
            const preparedProfile = {
                type: 'individual',
                username: profile.name,
                firstname: profile.name,
                lastname: 'Test',
                location: profile.location,
                email: 'test@chlu.io',
                vendorAddress: 'abc'
            }
            await mkt.db.createVendor(didId, {
                vDidId: didId,
                profile: setProfileFullname(preparedProfile),
                vSignature: submitSignature ? `${didId}-signature` : null,
                vmPrivateKey: `${didId}-privatekey`,
                vmPubKeyMultihash: `${didId}-publickey`,
            });
            return await mkt.getVendor(didId)
        }
        async function searchCount(query) {
            return (await mkt.searchVendors(query)).rows.length
        }
        await signupVendor('did:chlu:one', { name: 'one' })
        await signupVendor('did:chlu:two', { name: 'one two' })
        await signupVendor('did:chlu:three', { name: 'one', location: 'home' })
        await signupVendor('did:chlu:four', { name: 'two', location: 'home' })

        expect(await searchCount({ name: 'one' })).length.to.equal(3)
        expect(await searchCount({ name: 'two' })).length.to.equal(2)
        expect(await searchCount({ name: 'two', location: 'home' })).length.to.equal(1)
        expect(await searchCount({ location: 'home' })).length.to.equal(2)

        const results = await mkt.searchVendors({ name: 'one', location: 'home' })
        expect(results.rows[0]).to.deep.equal(await mkt.getVendor('did:chlu:three'))
    })
});