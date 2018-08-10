const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const mktApp = require('../server');
const Marketplace = require('../');

async function serve(port = 3000, configurationFile = null) {
    let p = port, verbose = true;
    const app = express();
    app.use(mktApp);
    if (configurationFile) {
        let conf = {}
        if (typeof configurationFile === 'string') {
            const data = await readFile(configurationFile);
            conf = JSON.parse(data.toString('utf-8'));
        } else if (configurationFile) {
            conf = configurationFile
        }
        if (conf.port) p = conf.port; else conf.port = p
        if (conf.verbose === false) verbose = false
        mktApp.locals.mkt = new Marketplace(conf);
    }
    if (verbose) app.use(morgan('combined'));
    app.use(cors());
    await mktApp.locals.mkt.start();
    await new Promise(resolve => {
        app.listen(p, () => {
            console.log('Chlu Marketplace listening on port', p);
            resolve();
        });
    });
    return { app, mktApp, mkt: mktApp.locals.mkt}
}

async function readFile(f) {
    return await new Promise((resolve, reject) => {
        fs.readFile(f, (err, data) => {
            if (err) reject(err); else resolve(data);
        });
    });
}

module.exports = serve;