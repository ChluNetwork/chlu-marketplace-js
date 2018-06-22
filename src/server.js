const express = require('express');
const Marketplace = require('./marketplace');

const app = express();
app.locals.mkt = new Marketplace();
app.use(express.json());

app.get('/', (req, res) => res.send('Chlu Marketplace'));

app.get('/vendors', async (req, res) => {
    await respond(res, app.locals.mkt.getVendorIDs());
});
app.post('/vendors', async (req, res) => {
    const didId = req.body.didId;
    await respond(res, app.locals.mkt.registerVendor(didId)); 
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
    const didId = await app.locals.mkt.getDIDID();
    const id = await app.locals.mkt.getIPFSID();
    await respond(res, {
        didId,
        ipfsId: id
    });
});

async function respond(res, promise) {
    try {
        const data = await promise;
        res.json(data);
        return data;
    } catch (err) {
        console.log('An error has been caught while responding to an HTTP request');
        console.trace(err);
        res.status(err.code || 500).send(err.message || err);
    }
}

module.exports = app;