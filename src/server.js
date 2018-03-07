const express = require('express');
const bodyParser = require('body-parser');
const Marketplace = require('./marketplace');

const app = express();
app.locals.mkt = new Marketplace();
app.use(bodyParser.json());

app.get('/', (req, res) => res.send('Chlu Marketplace'));

app.get('/vendors', async (req, res) => {
    res.json(await app.locals.mkt.getVendorIDs());
});
app.post('/vendors', async (req, res) => {
    const pubKeyMultihash = req.body.vendorPubKeyMultihash;
    res.json(await app.locals.mkt.registerVendor(pubKeyMultihash)); 
});
app.post('/vendors/:id/signature', async (req, res) => {
    const signature = req.body.signature;
    res.json(await app.locals.mkt.updateVendorSignature(req.params.id, signature)); 
});
app.get('/vendors/:id', async (req, res) => {
    res.json(await app.locals.mkt.getVendor(req.params.id));
});

app.post('/vendors/:id/popr', async (req, res) => {
    res.json(await app.locals.mkt.createPoPR(req.params.id, req.body || {}));
});

app.get('/.well-known', async (req, res) => {
    const keys = await app.locals.mkt.getKeys();
    res.json({
        multihash: keys.pubKeyMultihash
    });
});

module.exports = app;