#!/usr/bin/env node
const { ECPair } = require('bitcoinjs-lib');
const ChluIPFS = require('chlu-ipfs-support');
const axios = require('axios');
const os = require('os');
const path = require('path');

const log = msg => console.log(msg);

async function vendorSetup(url = 'http://localhost:3000', wif = null) {
    let keyPair, chluIpfs;
    try {
        log('Preparing Keys');
        keyPair = loadKeys(wif);
        log('Preparing Chlu IPFS');
        chluIpfs = getChluIPFS();
        await chluIpfs.start();
    } catch (error) {
        log('Could not prepare required data: ' + error.message || error);
        return;
    }
    try {
        log('Registering vendor to ' + url);
        const multihash = await storePublicKey(chluIpfs, keyPair);
        const { vmPubKeyMultihash } = await register(url, multihash);
        await submitSignature(url, chluIpfs, vmPubKeyMultihash, multihash, keyPair);
    } catch (error) {
        log('Vendor registration failed: ' + error.message || error);
    }
    log('Stopping gracefully');
    await chluIpfs.stop();
}

function getChluIPFS() {
    const chluIpfs = new ChluIPFS({
        type: ChluIPFS.types.vendor,
        directory: path.join(os.tmpdir(), 'chlu-vendor-script')
    });
    return chluIpfs;
}

function loadKeys(wif) {
    let keyPair;
    if (wif) {
        log('Opening keypair from WIF');
        keyPair = ECPair.fromWIF(wif);
    } else {
        log('Generating keypair');
        keyPair = ECPair.makeRandom();
        log('Generated key pair. WIF = ' + keyPair.toWIF());
    }
    return keyPair;
}

async function storePublicKey(chluIpfs, keyPair) {
    return await chluIpfs.instance.vendor.storePublicKey(keyPair.getPublicKeyBuffer());
}

async function register(url, pubKeyMultihash) {
    const response = await axios.post(url + '/vendors', {
        vendorPubKeyMultihash: pubKeyMultihash
    });
    if (response.status !== 200) throw new Error('Registering failed: server returned ' + response.status);
    return response.data;
}

async function submitSignature(url, chluIpfs, vmPubKeyMultihash, pubKeyMultihash, keyPair) {
    const signature = await chluIpfs.instance.vendor.signMultihash(vmPubKeyMultihash, keyPair);
    const response = await axios.post(url + '/vendors/' + pubKeyMultihash + '/signature', { signature });
    if (response.status !== 200) {
        throw new Error('Submitting signature failed: server returned ' + response.status);
    }
}

module.exports = vendorSetup;