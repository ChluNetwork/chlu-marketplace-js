

module.exports = class DB {
    
    async start() {
        if (!this.vendors) this.vendors = {};
    }

    async getVendorIDs() {
        return Object.keys(this.vendors); 
    }

    async getVendor(id) {
        return this.vendors[id];
    }

    async createVendor(id, data) {
        this.vendors[id] = data;
        return this.vendors[id];
    }

    async updateVendor(id, data) {
        return this.vendors[id] = Object.assign(this.vendors[id], data);
    }
};