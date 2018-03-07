const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Marketplace = require('./marketplace');

const app = express();
app.locals.mkt = new Marketplace();
app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => res.send('Chlu Marketplace'));

app.get('/vendors', async (req, res) => {
    await respond(res, app.locals.mkt.getVendorIDs());
});
app.post('/vendors', async (req, res) => {
    const pubKeyMultihash = req.body.vendorPubKeyMultihash;
    await respond(res, app.locals.mkt.registerVendor(pubKeyMultihash)); 
});
app.post('/vendors/:id/signature', async (req, res) => {
    const signature = req.body.signature;
    await respond(res, app.locals.mkt.updateVendorSignature(req.params.id, signature)); 
});
app.get('/vendors/:id', async (req, res) => {
    respond(res, app.locals.mkt.getVendor(req.params.id));
});

app.post('/vendors/:id/popr', async (req, res) => {
    await respond(res, app.locals.mkt.createPoPR(req.params.id, req.body || {}));
});

app.get('/.well-known', async (req, res) => {
    const keys = await app.locals.mkt.getKeys();
    await respond(res, {
        multihash: keys.pubKeyMultihash
    });
});

async function respond(res, promise) {
    try {
        const data = await promise;
        res.json(data);
        return data;
    } catch (err) {
        res.status(500).send(err.message || err);
    }
}

module.exports = app;