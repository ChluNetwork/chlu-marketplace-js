const EventEmitter = require('events');
const ChluIPFS = require('chlu-ipfs-support');
const { ECPair } = require('bitcoinjs-lib');

class Marketplace {

    constructor() {
        this.vendors = {};
        this.events = new EventEmitter();
        this.started = false;
        this.starting = false;
        this.rootKeyPair = null;
        this.pubKeyMultihash = null;
        this.chluIpfs = new ChluIPFS({ type: ChluIPFS.types.marketplace });
    }

    async start() {
        if (this.starting) {
            await new Promise(resolve => {
                this.events.once('started', resolve);
            });
        } else if (!this.started) {
            this.starting = true;
            await this.chluIpfs.start();
            this.starting = false;
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

    getVendor(id) {
        if (this.vendors[id]) {
            return this.vendors[id].vendorMarketplacePubKey;
        } else {
            throw new Error('Vendor with key ' + id + ' is not registered');
        }
    }

    clear() {
        this.vendors = {};
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
        this.vendors[id] = {
            vendorMarketplaceKeyPairWIF: vmKeyPair.toWIF(),
            vendorMarketplacePubKey: {
                multihash: vmPubKeyMultihash,
                marketplaceSignature: signature,
                vendorSignature: null
            },
            vendorPubKey: {
                multihash: vendorPubKeyMultihash
            }
        };
        const response = {
            id,
            multihash: vmPubKeyMultihash,
            marketplaceSignature: signature
        };
        return response;
    }

    async updateVendorSignature(vendorPubKeyMultihash, signature) {
        const id = vendorPubKeyMultihash;
        if (this.vendors[id]) {
            // TODO: signature needs expiration date?
            await this.start();
            const PvmMultihash = this.vendors[id].vendorMarketplacePubKey.multihash;
            const valid = this.chluIpfs.instance.vendor.verifyMultihash(vendorPubKeyMultihash, PvmMultihash, signature);
            if (valid) {
                this.vendors[id].vendorPubKey.multihash = vendorPubKeyMultihash;
                this.vendors[id].vendorMarketplacePubKey.vendorSignature = signature;
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