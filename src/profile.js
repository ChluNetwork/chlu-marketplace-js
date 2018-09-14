const { isEmpty, get, pickBy } = require('lodash')
const { createDAGNode, getDAGNodeMultihash } = require('chlu-ipfs-support/src/utils/ipfs')

const profileTypes = ['business', 'individual']

function isBusinessProfile(profile) {
    return get(profile, 'type') === 'business'
}

function stringNotEmpty(value, maxLength = 0) {
    if (value === undefined) return 'this field is required'
    if (typeof value !== 'string') return 'invalid type'
    if (maxLength > 0 && value.length > maxLength) {
        return `too long (max length ${maxLength})`
    }
    if (value.length < 1) return 'this value is required'
}

function stringIsEmail(value) {
    if (value === undefined) return 'this field is required'
    const regexp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    if (!regexp.test(value)) return 'Email address is invalid'
}

function validateProfile(profile) {
    let errors = {}
    if (!profile.type) {
        errors.type = 'Profile type is required'
    } else if (profileTypes.indexOf(profile.type) < 0) {
        errors.type = 'Invalid profile type'
    }
    errors.vendorAddress = stringNotEmpty(profile.vendorAddress)
    errors.email = stringIsEmail(profile.email)
    if (isBusinessProfile(profile)) {
        errors.businessname = stringNotEmpty(profile.businessname, 120)
    } else {
        errors.username = stringNotEmpty(profile.username, 25)
        errors.firstname = stringNotEmpty(profile.firstname, 60)
        errors.lastname = stringNotEmpty(profile.lastname, 60)
    }
    errors = pickBy(errors, v => !!v)
    if (!isEmpty(errors)) {
        return errors
    }
    return null
}

function setProfileFullname(profile) {
    let name = profile.firstname || profile.businessname || ''
    if (profile.lastname) name += ` ${profile.lastname}`
    if (profile.username) name += ` (${profile.username})`
    return Object.assign({}, profile, { name })
}

async function validateProfileSignature(chluIpfs, profile, signature, publicDidDocument = null) {
    const id = get(signature, 'creator')
    const multihash = getDAGNodeMultihash(await createDAGNode(Buffer.from(JSON.stringify(profile))))
    let valid = false
    if (get(publicDidDocument, 'id') === id) {
        // Use the DID document provided
        valid = await chluIpfs.didIpfsHelper.verifyMultihash(publicDidDocument, multihash, signature);
    } else {
        // just use the ID and fetch the DID from Chlu
        // wait until the DID gets replicated into the marketplace, don't fail if not found
        valid = await chluIpfs.didIpfsHelper.verifyMultihash(id, multihash, signature, true);
    }
    return valid
}

module.exports = {
    validateProfile,
    validateProfileSignature,
    setProfileFullname,
    isBusinessProfile,
}