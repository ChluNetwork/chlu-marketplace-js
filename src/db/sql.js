const Sequelize = require('sequelize');

module.exports = class DB {

    constructor(options) {
        if (options.path) {
            this.path = options.path;
        }
    }
    
    async start() {
        if(!this.db) {
            this.db = new Sequelize('chlumarketplace', {
                storage: this.path || ':memory:'
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
        if (vendor) return vendor.toJSON();
        return null;
    }

    async createVendor(id, data) {
        return await this.Vendor
            .create(Object.assign({}, data, { vPubKeyMultihash: id }))
            .toJSON();
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
};