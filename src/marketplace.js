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
        this.progressiveID = 0;
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

    clear() {
        this.vendors = {};
    }

    async registerVendor() {
        /*
        TODO:
        - Generates a key pair
        - Signs it with marketplace secret key
        - Sends response to vendor, who signs it and sends back to the marketplace
        (maybe the wallet support lib should do this,
        so that all the key generation stuff remains in one place)
        - Marketplace publishes it on IPFS, including pinning it
        - Response includes CID of the signed public key saved above
        {publicKey: XX, signatures: [YY, YY], vendorId: ZZ, marketplacePublicKeyLocation: AA}
        */
        await this.start();
        const keys = await this.getKeys();
        const vendorKeyPair = ECPair.makeRandom();
        const pubKeyBuffer = vendorKeyPair.getPublicKeyBuffer();
        const vendorPubKeyMultihash = await this.chluIpfs.instance.vendor.storePublicKey(pubKeyBuffer);
        // TODO: request pin
        const signature = await this.chluIpfs.instance.vendor.signMultihash(vendorPubKeyMultihash, keys.keyPair);
        this.progressiveID++;
        const id = this.progressiveID;
        this.vendors[id] = {
            id,
            vendorMarketplacePubKey: {
                multihash: vendorPubKeyMultihash,
                marketplaceSignature: signature,
                vendorSignature: null
            },
            vendorPubKey: {
                multihash: null
            }
        };
        const response = {
            id,
            multihash: vendorPubKeyMultihash,
            marketplaceSignature: signature
        };
        return response;
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