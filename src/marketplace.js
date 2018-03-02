const EventEmitter = require('events');
const ChluIPFS = require('chlu-ipfs-support');
const DB = require('./db');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const { ECPair } = require('bitcoinjs-lib');

const defaultRootKeyPairPath = path.join(process.env.HOME, '.chlu', 'marketplace', 'keypairwif.txt');

async function ensureDir(dir) {
    return await new Promise((resolve, reject) => {
        mkdirp(dir, err => err ? reject(err) : resolve());
    });
}

async function readFile(f) {
    await ensureDir(path.dirname(f));
    return await new Promise(resolve => {
        fs.readFile(f, (err, data) => {
            if (err) resolve(null); else resolve(data);
        });
    });
}

async function saveFile(f, data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return await new Promise((resolve, reject) => {
        fs.writeFile(f, buffer, err => err ? reject(err) : resolve());
    });
}

class Marketplace {

    constructor(options = {}) {
        this.events = new EventEmitter();
        this.started = false;
        this.starting = false;
        this.rootKeyPairPath = options.rootKeyPairPath || defaultRootKeyPairPath;
        this.rootKeyPair = null;
        this.pubKeyMultihash = null;
        this.chluIpfs = new ChluIPFS({ type: ChluIPFS.types.marketplace });
        this.db = new DB(options.db);
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
        let source = 'memory';
        if (!this.rootKeyPair) {
            const fileBuffer = await readFile(this.rootKeyPairPath);
            if (fileBuffer) {
                const wif = fileBuffer.toString('utf-8');
                this.rootKeyPair = ECPair.fromWIF(wif);
                source = 'fs:' + this.rootKeyPairPath;
            } else {
                this.rootKeyPair = ECPair.makeRandom();
                await saveFile(this.rootKeyPairPath, this.rootKeyPair.toWIF());
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

    async getVendorIDs() {
        await this.start();
        return await this.db.getVendorIDs();
    }

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