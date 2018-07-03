#!/usr/bin/env node
const ChluIPFS = require('chlu-ipfs-support');
const axios = require('axios');
const os = require('os');
const path = require('path');
const rimraf = require('rimraf')

const log = msg => console.log(msg);

const directory = path.join(os.tmpdir(), 'chlu-vendor-script')

async function vendorSetup(url = 'http://localhost:3000', network) {
    let chluIpfs;
    try {
        log('Preparing Chlu IPFS');
        chluIpfs = getChluIPFS({ network });
        await chluIpfs.start();
        log('Using Chlu Network ' + chluIpfs.instance.network)
        log('Using DID ' + chluIpfs.instance.did.didId)
    } catch (error) {
        log('Could not prepare required data: ' + error.message || error);
        return;
    }
    try {
        log('Registering vendor to ' + url);
        const { vmPubKeyMultihash } = await register(url, chluIpfs.instance.did.didId);
        await submitSignature(url, chluIpfs, vmPubKeyMultihash);
        log('\n========= SUCCESS ==========')
    } catch (error) {
        log('\n========== ERROR ==========')
        log('Vendor registration failed: ' + error.message || error);
        log('========== ERROR ==========\n')
    }
    log('Dumping Full DID Export')
    log('\n')
    const exported = await chluIpfs.instance.did.export()
    const exportedString = JSON.stringify(exported, null, 2)
    log(exportedString)
    log('\n')
    log('Stopping gracefully');
    await chluIpfs.stop();
    log('Deleting data');
    rimraf.sync(directory)
    log('Done')
    process.exit(0) // rimraf leaves a dirty event loop!
}

function getChluIPFS(opt) {
    const chluIpfs = new ChluIPFS(Object.assign({
        type: ChluIPFS.types.vendor,
        directory 
    }, opt));
    return chluIpfs;
}

async function register(url, didId) {
    log('===> Register Request for ' + didId)
    const response = await axios.post(url + '/vendors', {
        didId
    });
    log('<=== Response:\n' + JSON.stringify(response.data, null, 2))
    if (response.status !== 200) throw new Error('Registering failed: server returned ' + response.status);
    return response.data;
}

async function submitSignature(url, chluIpfs, vmPubKeyMultihash) {
    log('===> Signature')
    const signature = await chluIpfs.instance.did.signMultihash(vmPubKeyMultihash);
    log(JSON.stringify(signature))
    const response = await axios.post(url + '/vendors/' + chluIpfs.instance.did.didId + '/signature', { signature });
    if (response.status !== 200) {
        throw new Error('Submitting signature failed: server returned ' + response.status);
    }
    log('<=== OK')
}

module.exports = vendorSetup;