const Sequelize = require('sequelize');
const path = require('path');
const { ensureDir } = require('./utils/fs');
const { mapValues } = require('lodash')

class DB {

    constructor(options = {}) {
        this.storage = options.storage || ':memory:';
        this.dialect = options.dialect || 'sqlite';
        this.username = options.username || 'username';
        this.password = options.password;
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
                vmPrivateKey: {
                    type: Sequelize.STRING,
                    unique: true
                },
                vmPubKeyMultihash: {
                    type: Sequelize.STRING,
                    unique: true
                },
                vDidId: {
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
                profile: {
                    type: Sequelize.JSONB
                }
            });
            await this.db.sync();
        }
    }

    async stop() {
        if (this.db) await this.db.close();
    }

    async getVendorIDs() {
        const data = await this.Vendor.findAll({
            attributes: ['vDidId']
        });
        return data.map(d => d.vDidId);
    }

    async getVendor(id) {
        const vendor = await this.Vendor.findOne({
            where: {
                vDidId: id
            }
        });
        if (vendor) {
            const v = vendor.toJSON();
            return {
                mSignature: v.mSignature,
                vDidId: v.vDidId,
                vSignature: v.vSignature,
                vmPubKeyMultihash: v.vmPubKeyMultihash,
                vmPrivateKey: v.vmPrivateKey,
                profile: v.profile || {}
            };
        }
        return null;
    }

    async getVMPrivateKey(id) {
        const vendor = await this.Vendor.findOne({
            where: {
                vDidId: id
            }
        });
        if (vendor) {
            return vendor.get('vmPrivateKey');
        }
        return null;
    }

    async createVendor(id, data) {
        const vendor = await this.Vendor
            .create(Object.assign({}, data, { vDidId: id }));
        return vendor.toJSON();
    }

    async updateVendor(id, data) {
        const vendor = await this.Vendor.findOne({
            where: {
                vDidId: id
            }
        });
        if (vendor) {
            await vendor.update(data);
            return true;
        }
        return false;
    }

    async searchVendors(query, limit = 0, offset = 0) {
        const mappedQuery = mapValues(query, (v, k) => {
            const key = `profile.${k}`
            if (typeof v === 'string') return { [key]: { [Sequelize.Op.like]: `%${v}%` } }
            if (!isNaN(v)) return { [key]: v }
            return null
        })
        const filteredQuery = Object.values(mappedQuery).filter(v => !!v)
        const results = await this.Vendor.findAndCountAll({
            attributes: [
                'vDidId',
                'vmPubKeyMultihash',
                'mSignature',
                'vSignature',
                'profile',
            ],
            limit: limit || null,
            offset,
            where: {
                [Sequelize.Op.and]: [ ...filteredQuery ]
            }
        })
        return {
            count: results.count,
            rows: results.rows.map(r => r.toJSON())
        }
    }
}

module.exports = DB;