const EventEmitter = require('events');
const ChluIPFS = require('chlu-ipfs-support');
const InMemoryDB = require('./db/inmemory');
const { ECPair } = require('bitcoinjs-lib');

class Marketplace {

    constructor() {
        this.events = new EventEmitter();
        this.started = false;
        this.starting = false;
        this.rootKeyPair = null;
        this.pubKeyMultihash = null;
        this.chluIpfs = new ChluIPFS({ type: ChluIPFS.types.marketplace });
        this.db = new InMemoryDB();
    }

    async start() {
        if (this.starting) {
            await new Promise(resolve => {
                this.events.once('started', resolve);
            });
        } else if (!this.started) {
            this.starting = true;
            await Promise.all([this.db.start(), this.chluIpfs.start()]);
            this.starting = false;
            this.started = true;
            this.events.emit('started');
        }
    }

    async getKeys() {
        await this.start();
        if (!this.rootKeyPair) {
            // TODO: load from fs
            this.rootKeyPair = ECPair.makeRandom();
            const buffer = this.rootKeyPair.getPublicKeyBuffer();
            this.pubKeyMultihash = await this.chluIpfs.instance.vendor.storePublicKey(buffer);
            // TODO: request pin?
        }
        return {
            keyPair: this.rootKeyPair,
            pubKeyMultihash: this.pubKeyMultihash
        }; 
    }

    getVendorIDs() {
        return Object.keys(this.vendors);
    }

    async getVendor(id) {
        const vendor = await this.db.getVendor(id);
        if (vendor) {
            return vendor.vendorMarketplacePubKey;
        } else {
            throw new Error('Vendor with key ' + id + ' is not registered');
        }
    }

    async registerVendor(vendorPubKeyMultihash) {
        const id = vendorPubKeyMultihash;
        await this.start();
        const keys = await this.getKeys();
        const vmKeyPair = ECPair.makeRandom();
        const pubKeyBuffer = vmKeyPair.getPublicKeyBuffer();
        const vmPubKeyMultihash = await this.chluIpfs.instance.vendor.storePublicKey(pubKeyBuffer);
        // TODO: pin
        const signature = await this.chluIpfs.instance.vendor.signMultihash(vendorPubKeyMultihash, keys.keyPair);
        const vendor = await this.db.createVendor(id, {
            vmKeyPairWIF: vmKeyPair.toWIF(),
            vmPubKeyMultihash,
            mSignature: signature,
            vSignature: null,
            vPubKeyMultihash: id
        });
        const response = {
            vPubKeyMultihash: vendor.vPubKeyMultihash,
            vmPubKeyMultihash: vendor.vmPubKeyMultihash,
            mSignature: vendor.mSignature 
        };
        return response;
    }

    async updateVendorSignature(vendorPubKeyMultihash, signature) {
        const id = vendorPubKeyMultihash;
        await this.start();
        const vendor = await this.db.getVendor(id);
        if (vendor) {
            // TODO: signature needs expiration date?
            const PvmMultihash = vendor.vmPubKeyMultihash;
            const valid = this.chluIpfs.instance.vendor.verifyMultihash(vendorPubKeyMultihash, PvmMultihash, signature);
            if (valid) {
                vendor.vPubKeyMultihash = vendorPubKeyMultihash;
                vendor.vSignature = signature;
                await this.db.updateVendor(id, vendor);
            } else {
                throw new Error('Signature is not valid');
            }
        } else {
            throw new Error('Vendor with key ' + id + ' is not registered');
        }
    }

    async generatePoPR() {
        /*
        TODO:
        - Use the vendor secret key that maps to the vendor specified in the request above
        to sign the PoPR created above
        - Set the PoPR in the form and that means the form is prefilled with the amount.
        That means in the long run we get to the customer payment screen only from the checkout page
        */
        await this.start();
        throw new Error('Not implemented yet');
    }
}

module.exports = Marketplace;