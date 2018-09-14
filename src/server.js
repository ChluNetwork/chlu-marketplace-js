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
app.post('/search', async (req, res) => {
    const query = get(req, 'body.query', {})
    const limit = get(req, 'body.limit')
    const offset = get(req, 'body.offset')
    const result = await app.locals.mkt.searchVendors(query, limit, offset)
    await respond(res, result)
})
app.post('/vendors', async (req, res) => {
    const didId = req.body.didId;
    await respond(res, app.locals.mkt.registerVendor(didId)); 
});
app.post('/vendors/:id/profile', async (req, res) => {
    const profile = get(req, 'body.profile')
    const signature = get(req, 'body.signature')
    const publicDidDocument = get(req, 'body.publicDidDocument')
    if (get(signature, 'creator') !== req.params.id) {
        res.status(400).send('DID ID in the URI does not match signature creator')
    } else {
        await respond(res, app.locals.mkt.setVendorProfile(profile, signature, publicDidDocument))
    }
})
app.patch('/vendors/:id/profile', async (req, res) => {
    const profile = get(req, 'body.profile')
    const signature = get(req, 'body.signature')
    const publicDidDocument = get(req, 'body.publicDidDocument')
    if (get(signature, 'creator') !== req.params.id) {
        res.status(400).send('DID ID in the URI does not match signature creator')
    } else {
        await respond(res, app.locals.mkt.patchVendorProfile(profile, signature, publicDidDocument))
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
        console.log(err);
        if (err.data) console.log(err.data)
        res.status((err && err.code) || 500)
        if (err.data) res.json(err.data)
        else res.send(err.message).end()
    }
}

module.exports = app;