const fs = require('fs');

const app = require('../server');
const Marketplace = require('../');

async function serve(port = 3000, configurationFile = null) {
    let p = port;
    if (configurationFile) {
        const data = await readFile(configurationFile);
        const conf = JSON.parse(data.toString('utf-8'));
        app.locals.mkt = new Marketplace(conf);
        if (conf.port) p = conf.port;
    }
    await app.locals.mkt.start();
    return new Promise(resolve => {
        app.listen(p, () => {
            console.log('Chlu Marketplace listening on port', p);
            resolve();
        });
    });
}

async function readFile(f) {
    return await new Promise((resolve, reject) => {
        fs.readFile(f, (err, data) => {
            if (err) reject(err); else resolve(data);
        });
    });
}

module.exports = serve;