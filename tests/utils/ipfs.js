const rendezvous = require('libp2p-websocket-star-rendezvous');
const cloneDeep = require('lodash.clonedeep');
const constants = require('chlu-ipfs-support/src/constants');

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

module.exports = { startRendezvousServer, getIPFSConfig };