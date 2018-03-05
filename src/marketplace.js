const EventEmitter = require('events');
const ChluIPFS = require('chlu-ipfs-support');
const DB = require('./db');
const path = require('path');
const { ECPair } = require('bitcoinjs-lib');
const { readFile, saveFile } = require('./utils');

const defaultRootKeyPairPath = path.join(process.env.HOME, '.chlu', 'marketplace', 'keypairwif.txt');

/**
 * Chlu Marketplace provides the required methods for
 * integrating an existing e-commerce marketplace with
 * the chlu protocol. 
 * 
 * Remember to call .start() after setting it up
 * 
 * @param {Object} options optional configuration
 * @param {string} options.rootKeyPairPath path to the file which will store the key pair
 * for this marketplace. Make sure the file is adeguately protected. By default it will
 * be stored in `~/.chlu/marketplace/`. Pass `false` to disable persistence
 * @param {object} options.db database connection information, will be passed to the DB
 * class. It is also possible to override the DB by replacing the `db` property of the
 * instance of this class after creating it, but before calling `start`
 * @param {string} options.db.adapter Sequelize adapter. Defaults to SQLite, to use others
 * you will have to install the module following Sequelize's documentation
 * @param {string} options.db.dbName defaults to `chlu` 
 * @param {string} options.db.host defaults to `localhost` 
 * @param {integer} options.db.port
 * @param {string} options.db.username
 * @param {string} options.db.password
 * @param {string} options.db.storage where to put the SQLite DB. Defaults to
 * `~/.chlu/marketplace/db.sqlite`. Pass `false` to disable storage and keep
 * it in memory.
 * 
 */
class Marketplace {

    constructor(options = {}) {
        this.events = new EventEmitter();
        this.started = false;
        this.starting = false;
        if (options.rootKeyPairPath === false) {
            this.rootKeyPairPath = false;
        } else {
            this.rootKeyPairPath = options.rootKeyPairPath || defaultRootKeyPairPath;
        }
        this.rootKeyPair = null;
        this.pubKeyMultihash = null;
        this.chluIpfs = new ChluIPFS({ type: ChluIPFS.types.marketplace });
        this.db = new DB(options.db);
    }

    /**
     * Starts ChluIPFS submodule and DB connection.
     * Will be automatically called if you use other methods
     * 
     * @memberof Marketplace
     * @returns {Promise}
     */
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

    /**
     * @typedef {Object} KeyPair
     * @property {ECPair} keyPair the actual key pair
     * @property {string} pubKeyMultihash the multihash that can be used to get the PubKey from IPFS
     * @property {string} source where this comes from. Can be `random`, `memory`, or `fs:(path)`
     */

    /**
     * Gets your keypair and related information. If the keypair
     * was not already loaded, it is loaded from the file system.
     * If this fails or is not available, then a new key pair is
     * generated.
     * 
     * @memberof Marketplace
     * @returns {Promise<KeyPair>}
     */
    async getKeys() {
        await this.start();
        let source = 'memory';
        if (!this.rootKeyPair) {
            let fileBuffer = null;
            if (this.rootKeyPairPath !== false) {
                fileBuffer = await readFile(this.rootKeyPairPath);
            }
            if (fileBuffer) {
                const wif = fileBuffer.toString('utf-8');
                this.rootKeyPair = ECPair.fromWIF(wif);
                source = 'fs:' + this.rootKeyPairPath;
            } else {
                this.rootKeyPair = ECPair.makeRandom();
                if (this.rootKeyPairPath !== false) {
                    await saveFile(this.rootKeyPairPath, this.rootKeyPair.toWIF());
                }
                source = 'random';
            }
            const buffer = this.rootKeyPair.getPublicKeyBuffer();
            this.pubKeyMultihash = await this.chluIpfs.instance.vendor.storePublicKey(buffer);
            // TODO: request pin?
        }
        return {
            keyPair: this.rootKeyPair,
            pubKeyMultihash: this.pubKeyMultihash,
            source
        }; 
    }

    /**
     * Get the list of vendors that is registered in this
     * marketplace. The ID used to identify each vendor
     * is the multihash of their public key, which can be
     * used to get the pub key from IPFS.
     * 
     * @returns {Array.<string>}
     * @memberof Marketplace
     */
    async getVendorIDs() {
        await this.start();
        return await this.db.getVendorIDs();
    }

    /**
     * @typedef {Object} Vendor
     * @property {string} vPubKeyMultihash the multihash of the vendor key (aka Vendor ID)
     * @property {string} vmPubKeyMultihash the multihash of the vendor-marketplace key
     * @property {string} mSignature hex encoded signature of the marketplace for the vendor-marketplace key
     * @property {string} vSignature hex encoded signature of the vendor for the vendor-marketplace key
     */

    /**
     * Get public data about a specific vendor
     * 
     * @param {string} id the multihash of this vendor's pub key, aka their ID
     * @returns {Promise<Vendor>}
     * @memberof Marketplace
     */
    async getVendor(id) {
        await this.start();
        const v = await this.db.getVendor(id);
        if (v) {
            // the full keypair is omitted intentionally
            // so it does not get out by mistake
            return {
                mSignature: v.mSignature,
                vPubKeyMultihash: v.vPubKeyMultihash,
                vSignature: v.vSignature,
                vmPubKeyMultihash: v.vmPubKeyMultihash
            };
        } else {
            throw new Error('Vendor with key ' + id + ' is not registered');
        }
    }

    /**
     * Get the vendor-marketplace key pair for a vendor
     * 
     * @param {string} vendorId the vendor's public key multihash
     * @returns {Promise<ECPair>}
     * @memberof Marketplace
     */
    async getVMKeyPair(vendorId) {
        await this.start();
        const wif = await this.db.getVMKeyPairWIF(vendorId);
        return ECPair.fromWIF(wif);
    }

    async registerVendor(vendorPubKeyMultihash) {
        const id = vendorPubKeyMultihash;
        await this.start();
        const vmKeyPair = ECPair.makeRandom();
        const pubKeyBuffer = vmKeyPair.getPublicKeyBuffer();
        const vmPubKeyMultihash = await this.chluIpfs.instance.vendor.storePublicKey(pubKeyBuffer);
        // TODO: pin
        const keys = await this.getKeys();
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

    /**
     * @typedef {Object} PoPR
     * @param {string} item_id
     * @property {string} invoice_id
     * @property {string} customer_id
     * @property {integer} created_at
     * @property {integer} expires_at
     * @property {string} currency_symbol
     * @property {integer} amount
     * @property {string} marketplace_url
     * @property {string} marketplace_vendor_url
     * @property {string} key_location
     * @property {string} hash calculated automatically
     * @property {string} signature applied automatically
     */

    /**
     * Create/Update the vendor signature for a vendor-marketplace key
     * 
     * @param {string} vendorId the vendor's public key multihash
     * @returns {Promise}
     * @throws {Error} if the signature is not valid or the vendor does not exist
     * @memberof Marketplace
     */
    async updateVendorSignature(vendorPubKeyMultihash, signature) {
        const id = vendorPubKeyMultihash;
        await this.start();
        const vendor = await this.db.getVendor(id);
        if (vendor) {
            // TODO: signature needs expiration date?
            const PvmMultihash = vendor.vmPubKeyMultihash;
            const valid = this.chluIpfs.instance.vendor.verifyMultihash(vendorPubKeyMultihash, PvmMultihash, signature);
            if (valid) {
                vendor.vSignature = signature;
                await this.db.updateVendor(id, vendor);
            } else {
                throw new Error('Signature is not valid');
            }
        } else {
            throw new Error('Vendor with key ' + id + ' is not registered');
        }
    }

    /**
     * Create a Proof of Payment Request for a vendor.
     * 
     * @param {string} vendorId the vendor's public key multihash
     * @param {object} [options={}]
     * @param {string} options.item_id
     * @param {string} options.invoice_id
     * @param {string} options.customer_id
     * @param {integer} options.created_at
     * @param {integer} options.expires_at
     * @param {string} options.currency_symbol
     * @param {integer} options.amount
     * @param {string} options.marketplace_url
     * @param {string} options.marketplace_vendor_url
     * @param {string} options.key_location
     * @returns {Promise<PoPR>}
     * @memberof Marketplace
     */
    async createPoPR(vendorId, options = {}) {
        /*
        TODO:
        - Use the vendor secret key that maps to the vendor specified in the request above
        to sign the PoPR created above
        - Set the PoPR in the form and that means the form is prefilled with the amount.
        That means in the long run we get to the customer payment screen only from the checkout page
        */
        await this.start();
        const vendor = await this.getVendor(vendorId);
        const popr = {
            item_id: options.item_id || 'N/A',
            invoice_id: options.invoice_id || 'N/A',
            customer_id: options.customer_id || 'N/A',
            created_at: options.created_at || Date.now(),
            expires_at: options.expires_at || 0,
            currency_symbol: options.currency_symbol || 'N/A',
            amount: options.amount || 0,
            marketplace_url: '/.well-known',
            marketplace_vendor_url: '/ipfs/' + vendor.vPubKeyMultihash,
            key_location: '/ipfs/' + vendor.vmPubKeyMultihash,
            chlu_version: 0,
            attributes: [],
            signature: ''
        };
        const keyPair = await this.getVMKeyPair(vendorId);
        const signedPoPR = await this.chluIpfs.instance.vendor.signPoPR(popr, keyPair);
        return signedPoPR;
    }
}

module.exports = Marketplace;