#!/usr/bin/env node

const app = require('./');

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log('Chlu Marketplace listening on port', port);
});