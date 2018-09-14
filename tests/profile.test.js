const expect = require('chai').expect
const { validateProfile, setProfileFullname } = require('../src/profile')

describe('Vendor Profiles', () => {

    it('validates individual profile', () => {
        const validProfile = {
            type: 'individual',
            username: 'fazo96',
            firstname: 'Enrico',
            lastname: 'Fasoli',
            email: 'enrico.fasoli.notreal@gmail.com',
            vendorAddress: 'abc'
        }
        expect(validateProfile(validProfile)).to.be.null
        delete validProfile.email
        expect(validateProfile(validProfile).email).to.be.a('string')
    })

    it('validates business profile', () => {
        const validProfile = {
            type: 'business',
            businessname: 'My Business',
            email: 'enrico.fasoli.notreal@gmail.com',
            vendorAddress: 'abc'
        }
        expect(validateProfile(validProfile)).to.be.null
        delete validProfile.businessname
        expect(validateProfile(validProfile).businessname).to.be.a('string')
    })

    it('computes full name', () => {
        const individualProfile = {
            type: 'individual',
            firstname: 'Enrico',
            username: 'fazo96',
            lastname: 'Fasoli'
        }
        setProfileFullname(individualProfile)
        expect(individualProfile.name).to.equal('Enrico Fasoli (fazo96)')
        const businessProfile = {
            type: 'business',
            businessname: 'My Biz',
        }
        setProfileFullname(businessProfile)
        expect(businessProfile.name).to.equal('My Biz')
    })
})