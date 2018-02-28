const express = require('express');
const bodyParser = require('body-parser');
const Marketplace = require('./marketplace');
const os = require('os');
const path = require('path');

const app = express();
app.locals.mkt = new Marketplace();
app.use(bodyParser.json());

app.use('/.well-known', express.static(path.join(os.tmpdir(), '/chlu-marketplace')));

app.get('/', (req, res) => res.send('Chlu Marketplace'));

app.get('/vendors', (req, res) => {
    res.json(app.locals.mkt.getVendorIDs());
});
app.post('/vendors', async (req, res) => {
    const vendor = req.body;
    res.json(await app.locals.mkt.registerVendor(vendor)); 
});
app.delete('/vendors', (req, res) => {
    app.locals.mkt.clear();
    res.sendStatus(200);
});

app.get('/vendors/:id/popr', async (req, res) => {
    res.json(await app.locals.mkt.generatePoPR(req.params.id));
});

app.get('/pubkey', async (req, res) => {
    const keys = await app.locals.mkt.getKeys();
    res.json({
        multihash: keys.pubKeyMultihash
    });
});

module.exports = app;