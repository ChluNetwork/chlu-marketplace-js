const HttpError = require('./error');

function validateDidId(didId) {
    try {
        const valid = typeof didId === 'string' && didId.indexOf('did:chlu:') === 0
        if (!valid) throw Error()
    } catch (error) {
        throw HttpError(400, 'DID ID is invalid: ' + didId);
    }
    return true
}

module.exports = { validateDidId }