const EventEmitter = require('events');
const ChluIPFS = require('chlu-ipfs-support');
const DB = require('./db');
const path = require('path');
const moment = require('moment')
const HttpError = require('./utils/error');

/**
 * Chlu Marketplace provides the required methods for
 * integrating an existing e-commerce marketplace with
 * the chlu protocol. 
 * 
 * @param {Object} options optional configuration
 * @param {Object} options.chluIpfs extra options for the ChluIPFS node
 * @param {string} options.marketplaceLocation URL for accessing this marketplace
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
        this.stopping = false;
        this.stopped = true;
        const opt = options.chluIpfs || {};
        this.chluIpfs = new ChluIPFS(Object.assign({
            // Don't use ~/.chlu to not conflict with the service node
            directory: path.join(process.env.HOME, '.chlu/marketplace')
        }, opt));
        if (options.ipfs) this.chluIpfs.ipfs = options.ipfs
        this.logger = this.chluIpfs.logger
        this.db = new DB(options.db);
        // TODO: docs for this option
        this.marketplaceLocation = options.marketplaceLocation || 'http://localhost';
    }

    /**
     * Starts ChluIPFS submodule and DB connection.
     * Will be automatically called if you use other methods
     * that require the Marketplace to be started
     * 
     * @memberof Marketplace
     * @returns {Promise}
     */
    async start() {
        try {
            if (this.stopping) {
                throw new Error('Cannot start Marketplace while it is stopping');
            } else if (this.starting) {
                await new Promise(resolve => {
                    this.events.once('started', resolve);
                });
            } else if (!this.started) {
                this.stopped = false;
                this.starting = true;
                await Promise.all([this.db.start(), this.chluIpfs.start()]);
                this.starting = false;
                this.started = true;
                this.events.emit('started');
            }
        } catch (error) {
            throw new HttpError(500, 'An error has occured while starting: ' + error.message);
        }
    }

    async stop() {
        try {
            if (this.starting) {
                throw new Error('Cannot stop Marketplace while it is starting');
            } else if (this.stopping) {
                await new Promise(resolve => {
                    this.events.once('stopped', resolve);
                });
            } else {
                this.started = false;
                this.stopping = true;
                await Promise.all([this.db.stop(), this.chluIpfs.stop()]);
                this.stopping = false;
                this.stopped = true;
                this.events.emit('stopped');
            }
        } catch (error) {
            throw new HttpError(500, 'An error has occurred while shutting down: ' + error.message);
        }
    }

    async getInfo() {
        await this.start()
        return {
            ipfsId: await this.chluIpfs.ipfsUtils.id(),
            didId: this.chluIpfs.didIpfsHelper.didId,
            network: this.chluIpfs.network
        }
    }

    /**
     * @typedef {Object} KeyPair
     * @property {ECPair} keyPair the actual key pair
     * @property {string} pubKeyMultihash the multihash that can be used to get the PubKey from IPFS
     * @property {string} source where this comes from. Can be `random`, `memory`, or `fs:(path)`
     */

    /**
     * Gets the marketplace's DID and related information.
     * If the DID was not already loaded, it is loaded from
     * the file system. If this fails or is not available, then
     * a new DID is generated.
     * 
     * @memberof Marketplace
     * @returns {Promise<string>}
     */
    async getDIDID() {
        await this.start();
        return this.chluIpfs.didIpfsHelper.didId
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
        try {
            return await this.db.getVendorIDs();
        } catch (err) {
            throw new HttpError(500, 'Could not fetch vendors: ' + err.message);
        }
    }

    /**
     * @typedef {Object} Vendor
     * @property {string} vDidId the ID of the vendor DID (aka Vendor ID)
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
        validateDidId(id);
        await this.start();
        try {
            const v = await this.db.getVendor(id);
            if (v) {
                // the full keypair is omitted intentionally
                // so it does not get out by mistake
                return {
                    mSignature: v.mSignature,
                    vDidId: v.vDidId,
                    vSignature: v.vSignature,
                    vmPubKeyMultihash: v.vmPubKeyMultihash
                };
            } else {
                throw new HttpError(404, 'Vendor not found');
            }
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'Error while fetching Vendor: ' + error.message);
        }
    }

    /**
     * Get the vendor-marketplace key pair for a vendor
     * 
     * @param {string} vendorId the vendor's DID ID
     * @returns {Promise<KeyPair>}
     * @memberof Marketplace
     */
    async getVMKeyPair(vendorId) {
        validateDidId(vendorId);
        await this.start();
        const privKey = await this.db.getVMPrivateKey(vendorId);
        if (privKey === null) throw new Error('Private key for vendor not found');
        const imported = await this.chluIpfs.crypto.importKeyPair(privKey)
        return imported.keyPair
    }

    /**
     * Register a new vendor with the Marketplace
     * 
     * @param {string} vDidId the vendor's DID ID, which will act as ID
     * @returns {Promise<Vendor>} return a vendor, but without the vendor signature. It will need to be
     * submitted using the updateVendorSignature function
     * @throws {Error} if something goes wrong
     * @memberof Marketplace
     */
    async registerVendor(vDidId) {
        this.logger.debug(`starting registerVendor ${vDidId}`)
        const id = vDidId
        validateDidId(id);
        await this.start();
        try {
            this.logger.debug('generating key pair')
            const {
                keyPair: vmKeyPair,
                pubKeyMultihash: vmPubKeyMultihash
            } = await this.chluIpfs.instance.crypto.generateKeyPair()
            this.logger.debug(`pinning key pair ${vmPubKeyMultihash}`)
            await this.chluIpfs.pin(vmPubKeyMultihash)
            // TODO: request pin?
            this.logger.debug(`signing key pair ${vmPubKeyMultihash}`)
            const signature = await this.chluIpfs.didIpfsHelper.signMultihash(vmPubKeyMultihash);
            this.logger.debug(`exporting key pair ${vmPubKeyMultihash}`)
            const exported = await this.chluIpfs.instance.crypto.exportKeyPair(vmKeyPair)
            this.logger.debug(`creating vendor in DB ${vDidId}`)
            const vendor = await this.db.createVendor(id, {
                vmPrivateKey: exported,
                vmPubKeyMultihash,
                mSignature: signature.signatureValue,
                vSignature: null,
                vDidId: id
            });
            const response = {
                vDidId: vendor.vDidId,
                vmPubKeyMultihash: vendor.vmPubKeyMultihash,
                mSignature: vendor.mSignature 
            };
            this.logger.debug(`Vendor ${vDidId} created, sending response ${response}`)
            return response;
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'An error has occurred: ' + error.message);
        }
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
     * @param {string} vDidId the vendor's DID ID
     * @param {Object} signature
     * @param {string} signature.creator the did id used to sign
     * @param {string} signature.signatureValue the hex encoded signature as a string
     * @returns {Promise}
     * @throws {Error} if the signature is not valid or the vendor does not exist
     * @memberof Marketplace
     */
    async updateVendorSignature(signature) {
        const id = signature.creator;
        const signatureValue = signature.signatureValue
        validateDidId(id);
        await this.start();
        try {
            const vendor = await this.getVendor(id);
            // TODO: signature needs expiration date?
            const PvmMultihash = vendor.vmPubKeyMultihash;
            // wait until the DID gets replicated into the marketplace, don't fail if not found
            const valid = await this.chluIpfs.didIpfsHelper.verifyMultihash(id, PvmMultihash, signature, true);
            if (valid) {
                vendor.vSignature = signatureValue;
                await this.db.updateVendor(id, vendor);
            } else {
                throw new HttpError(400, 'Signature is not valid');
            }
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'An error has occurred: ' + error.message);
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
     * @returns {Promise<Object>} returns an object with `popr` and `multihash`
     * @memberof Marketplace
     */
    async createPoPR(vendorId, options = {}) {
        validateDidId(vendorId);
        await this.start();
        try {
            const vendor = await this.getVendor(vendorId);
            const data = {
                item_id: options.item_id || 'N/A',
                invoice_id: options.invoice_id || 'N/A',
                customer_id: options.customer_id || 'N/A',
                created_at: options.created_at || moment().unix(),
                expires_at: options.expires_at || 0,
                currency_symbol: options.currency_symbol || 'N/A',
                amount: options.amount || 0,
                marketplace_url: this.marketplaceLocation.slice(0),
                marketplace_vendor_url: options.marketplace_vendor_url || (this.marketplaceLocation.slice(0) + '/vendors/' + vendor.vDidId),
                key_location: '/ipfs/' + vendor.vmPubKeyMultihash,
                vendor_did: vendor.vDidId,
                vendor_signature: {
                    type: 'did:chlu',
                    creator: vendor.vDidId,
                    signatureValue: vendor.vSignature
                },
                marketplace_signature: {
                    type: 'did:chlu',
                    creator: this.chluIpfs.didIpfsHelper.didId,
                    signatureValue: vendor.mSignature
                },
                vendor_encryption_key_location: '', // TODO: support this
                chlu_version: 0,
                attributes: options.attributes || [],
                signature: ''
            };
            const keyPair = await this.getVMKeyPair(vendorId);
            const popr = await this.chluIpfs.crypto.signPoPR(data, keyPair);
            const encoded = await this.chluIpfs.protobuf.PoPR.encode(popr)
            const multihash = await this.chluIpfs.ipfsUtils.put(encoded); 
            return { popr, multihash };
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'An error has occurred: ' + error ? error.message : 'Unknown error');
        }
    }
}

function validateDidId(didId) {
    try {
        const valid = typeof didId === 'string' && didId.indexOf('did:chlu:') === 0
        if (!valid) throw Error()
    } catch (error) {
        throw HttpError(400, 'DID ID is invalid: ' + didId);
    }
    return true
}

module.exports = Marketplace;