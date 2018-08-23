const express = require('express');
const Marketplace = require('./marketplace');
const { get } = require('lodash')

const app = express();
app.locals.mkt = new Marketplace();
app.use(express.json());

app.get('/', (req, res) => respond(res, app.locals.mkt.getInfo()));

app.get('/vendors', async (req, res) => {
    await respond(res, app.locals.mkt.getVendorIDs());
});
app.post('/vendors', async (req, res) => {
    const didId = req.body.didId;
    await respond(res, app.locals.mkt.registerVendor(didId)); 
});
app.post('/vendors/:id/profile', async (req, res) => {
    const profile = get(req, 'body.profile')
    const signature = get(req, 'body.signature')
    if (get(signature, 'creator') !== req.params.id) {
        res.status(400).send('DID ID in the URI does not match signature creator')
    } else {
        await respond(res, app.locals.mkt.updateVendorProfile(profile, signature))
    }
})
app.post('/vendors/:id/signature', async (req, res) => {
    const signature = req.body.signature;
    const publicDidDocument = req.body.publicDidDocument
    if (signature.creator !== req.params.id) {
        res.status(400).send('DID ID in the URI does not match signature creator')
    } else {
        await respond(res, app.locals.mkt.updateVendorSignature(signature, publicDidDocument)); 
    }
});
app.get('/vendors/:id', async (req, res) => {
    await respond(res, app.locals.mkt.getVendor(req.params.id));
});

app.post('/vendors/:id/popr', async (req, res) => {
    await respond(res, app.locals.mkt.createPoPR(req.params.id, req.body || {}));
});

app.get('/.well-known', (req, res) => respond(res, app.locals.mkt.getInfo()));

async function respond(res, promise) {
    try {
        const data = await promise;
        res.json(data);
        return data;
    } catch (err) {
        console.log('An error has been caught while responding to an HTTP request');
        console.trace(err);
        res.status((err && err.code) || 500).send((err && err.message) || err);
    }
}

module.exports = app;