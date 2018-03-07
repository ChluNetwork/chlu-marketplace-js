#!/usr/bin/env node
const { ECPair } = require('bitcoinjs-lib');
const ChluIPFS = require('chlu-ipfs-support');
const axios = require('axios');
const os = require('os');
const path = require('path');

const url = process.env.URL || 'http://localhost:3000';
const wif = process.env.WIF || null;

const log = msg => console.log(msg);

async function main() {
    log('Starting Chlu IPFS');
    const chluIpfs = new ChluIPFS({
        type: ChluIPFS.types.vendor,
        directory: path.join(os.tmpdir(), 'chlu-vendor-script')
    });
    const toWait = chluIpfs.start();
    let keyPair;
    if (wif) {
        log('Opening keypair from WIF');
        keyPair = ECPair.fromWIF(wif);
    } else {
        log('Generating keypair');
        keyPair = ECPair.makeRandom();
        log('Generated key pair. WIF = ' + keyPair.toWIF());
    }
    log('Waiting for ChluIPFS to be ready');
    await toWait;
    log('Storing Public Key to IPFS');
    const multihash = await chluIpfs.instance.vendor.storePublicKey(keyPair.getPublicKeyBuffer());
    log('Public Key stored at ' + multihash);
    log('Registering vendor to ' + url); 
    const response = await axios.post(url + '/vendors', {
        vendorPubKeyMultihash: multihash
    });
    log(response.status);
    log(response.data);
    log('Signing Pvm key');
    const signature = await chluIpfs.instance.vendor.signMultihash(response.data.vmPubKeyMultihash, keyPair);
    log('Submitting signature');
    const secondResponse = await axios.post(url + '/vendors/' + multihash + '/signature', { signature });
    log(secondResponse.status);
    log(secondResponse.data);
    if (secondResponse.status !== 200) {
        throw new Error('Submitting signature failed');
    }
    log('Stopping gracefully');
    await chluIpfs.stop();
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        console.trace();
        process.exit(1);
    });