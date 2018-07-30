#!/usr/bin/env node
const ChluIPFS = require('chlu-ipfs-support');
const os = require('os');
const path = require('path');

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
        await chluIpfs.instance.vendor.registerToMarketplace(url)
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
    //log('Deleting data');
    //rimraf.sync(directory)
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

module.exports = vendorSetup;