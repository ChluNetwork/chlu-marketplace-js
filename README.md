# Chlu Marketplace JS

Marketplace implementation in Node.JS for the [Chlu](https://chlu.io) protocol

## Usage

You can use this library in three ways:

- start the HTTP server (easiest way)
- include the HTTP API as an `Express` sub-app in your existing application
- import the library directly in your existing application

__Note:__ the Chlu Marketplace will start and run a `js-ipfs` node when used

### Documentation

Here are some generated HTML docs for the library. [Documentation](http://ipfs.io/ipfs/QmeU6GxA7KVdnCZLKS73Fwk6XLwvnNCegfTpPv2zUnwavC/)

### Starting the HTTP Server

#### Configuration file

The HTTP server can be started with a configuration file
in JSON, the content will be passed to the Marketplace constructor
and the `port` option will be used for the HTTP server.

The most basic configuration file is like this:

```json
{
  "port": 3000,
  "db": {
    "password": "yourpassword"
  },
  "marketplaceLocation": "http://localhost:3000"
}
```

Check out the documentation above to see which other options you can pass.

You can also pass `chlu-ipfs` specific options in the `chluIpfs` object.

__Note:__ if you are running other Chlu apps, make sure they are set to the same network.

- clone this repository
- `yarn start -c path/to/your/config.json`
- your Marketplace is now running
  - all data is saved in `~/.chlu` by default
  - also check out `yarn start --help` to see additional options

### Using the HTTP API in an Express app

```javascript
const mktServer = require('chlu-marketplace-js/src/server')

const express = require('express')
const app = express()

// 'app' is your existing express application

app.use('/chlu', mktServer)

app.listen(3000, () => {
    // Done! Your marketplace is mounted at /chlu
})

// The required submodules will be started when the first request
// arrives. If you want to start them right away (recommended) run:
app.locals.mkt.start() // returns a Promise, make sure to catch errors!
```

### Using the library directly

```javascript
const Marketplace = require('chlu-marketplace-js')

const options = {
  db: {
    password: 'yourpassword'
  }
  // You can pass other options to customize behavior
  // Check out the documentation above for more information
}

const mkt = new Marketplace(options)

// This is not mandatory, the marketplace will be
// started automatically when you use it if it has
// not been started before
await mkt.start()

// Use it
await mkt.registerVendor(...)
await mkt.createPoPR(...)
```

### Quickly setup a vendor

There is a non interactive command that generates a new DID, then sets it up as
a vendor on a marketplace. Istructions are in the [chlu-wallet README](https://github.com/ChluNetwork/chlu-wallet#set-up-marketplace)