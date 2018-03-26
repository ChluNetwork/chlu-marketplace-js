const rendezvous = require('libp2p-websocket-star-rendezvous');
const cloneDeep = require('lodash.clonedeep');
const constants = require('chlu-ipfs-support/src/constants');
const multihashing = require('multihashing-async');
const multihashes = require('multihashes');

async function startRendezvousServer() {
    return new Promise((resolve, reject) => {
        rendezvous.start({ port: 13579 }, (err, srv) => err ? reject(err) : resolve(srv));
    });
}

function getIPFSConfig() {
    const configuration = cloneDeep(constants.defaultIPFSOptions);
    configuration.config.Addresses.Swarm = [];
    return configuration;
}

async function toMultihash(data) {
    return new Promise((resolve, reject) => {
        multihashing(Buffer.from(data), 'sha2-256', (err, mh) => {
            if (err) reject(err); else resolve(multihashes.toB58String(mh));
        });
    });
}

module.exports = {
    startRendezvousServer,
    getIPFSConfig,
    toMultihash
};