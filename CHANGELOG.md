# Chlu Marketplace Changelog

## v0.4.0

- added `PATCH /vendors/id/profile` to patch user profile
- added profile data validation

## v0.3.0

- implemented `/search` endpoint to search for vendors

## v0.2.5

- apply same logic used in previous version to profile submissions

## v0.2.4

- if the client sends the publicDidDocument when sending the vendor signature, use it to speed up signature verification

## v0.2.3

- fixed `--chlu-no-write` CLI option

## v0.2.2

- fixed CORS not working

## v0.2.1

- fixed CLI options

## v0.2.0

- added CLI params for Chlu SQL DB
- support ChluIPFS 0.2
- switch to CLI-based configuration instead of file based
- Vendor Profiles API implemented
- support for PostgreSQL for marketplace database

## v0.1.0

First release