const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');

async function ensureDir(dir) {
    return await new Promise((resolve, reject) => {
        mkdirp(dir, err => err ? reject(err) : resolve());
    });
}

async function readFile(f) {
    return await new Promise(resolve => {
        fs.readFile(f, (err, data) => {
            if (err) resolve(null); else resolve(data);
        });
    });
}

async function saveFile(f, data) {
    await ensureDir(path.dirname(f));
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return await new Promise((resolve, reject) => {
        fs.writeFile(f, buffer, err => err ? reject(err) : resolve());
    });
}

module.exports = { saveFile, readFile, ensureDir };