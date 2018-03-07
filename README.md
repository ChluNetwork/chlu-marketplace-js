# Chlu Marketplace JS

Marketplace implementation in Node.JS for the [Chlu](https://chlu.io) protocol

## Usage

You can use this library in three ways:

- start the HTTP server (easiest way)
- include the HTTP API as an `Express` sub-app in your existing application
- import the library directly in your existing application

__Note:__ the Chlu Marketplace will start and run a `js-ipfs` node when used

### Starting the HTTP Server

- clone this repository
- `npm run start`
- your Marketplace is now running on port 3000
  - all data is saved in `~/.chlu`
  - you can set the `PORT` environment variable to run it on any other port 

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
```

### Using the library directly

```javascript
const Marketplace = require('chlu-marketplace-js')

// You can pass options to customize behavior but
// it works with zero configuration
cont mkt = new Marketplace({ ...options })

// This is not mandatory, the marketplace will be
// started automatically when you use it if it has
// not been started before
await mkt.start()

// Use it
await mkt.registerVendor(...)
await mkt.createPoPR(...)
```