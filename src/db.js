const Sequelize = require('sequelize');
const path = require('path');
const { ensureDir } = require('./utils');

const defaultDBPath = path.join(process.env.HOME, '.chlu', 'marketplace', 'db.sqlite');
class DB {

    constructor(options = {}) {
        this.storage = options.storage || defaultDBPath;
        this.dialect = options.dialect || 'sqlite';
        this.username = options.username || 'username';
        this.password = options.username || 'password';
        this.host = options.host || 'localhost';
        this.port = options.port;
        this.dbName = options.dbName || 'chlu';
    }
    
    async start() {
        if(!this.db) {
            if (!this.storage !== ':memory:') {
                await ensureDir(path.dirname(this.storage));
            }
            this.db = new Sequelize(this.dbName, this.username, this.password, {
                dialect: this.dialect,
                storage: this.storage,
                host: this.host,
                port: this.port,
                logging: this.logging || false,
                operatorsAliases: false
            });
            this.Vendor = this.db.define('vendor', {
                vmKeyPairWIF: {
                    type: Sequelize.STRING,
                    unique: true
                },
                vmPubKeyMultihash: {
                    type: Sequelize.STRING,
                    unique: true
                },
                vPubKeyMultihash: {
                    type: Sequelize.STRING,
                    unique: true
                },
                mSignature: {
                    type: Sequelize.STRING,
                    unique: true
                },
                vSignature: {
                    type: Sequelize.STRING,
                    unique: true
                },
            });
            await this.db.sync();
        }
    }

    async stop() {
        if (this.db) await this.db.close();
    }

    async getVendorIDs() {
        const data = await this.Vendor.findAll({
            attributes: ['vPubKeyMultihash']
        });
        return data.map(d => d.vPubKeyMultihash);
    }

    async getVendor(id) {
        const vendor = await this.Vendor.findOne({
            where: {
                vPubKeyMultihash: id
            }
        });
        if (vendor) {
            const v = vendor.toJSON();
            return {
                mSignature: v.mSignature,
                vPubKeyMultihash: v.vPubKeyMultihash,
                vSignature: v.vSignature,
                vmPubKeyMultihash: v.vmPubKeyMultihash,
                vmKeyPairWIF: v.vmKeyPairWIF
            };
        }
        return null;
    }

    async getVMKeyPairWIF(id) {
        const vendor = await this.Vendor.findOne({
            where: {
                vPubKeyMultihash: id
            }
        });
        if (vendor) {
            return vendor.get('vmKeyPairWIF');
        }
        return null;
    }

    async createVendor(id, data) {
        const vendor = await this.Vendor
            .create(Object.assign({}, data, { vPubKeyMultihash: id }));
        return vendor.toJSON();
    }

    async updateVendor(id, data) {
        const vendor = await this.Vendor.findOne({
            where: {
                vPubKeyMultihash: id
            }
        });
        if (vendor) {
            await vendor.update(data);
            return true;
        }
        return false;
    }
}

module.exports = DB;