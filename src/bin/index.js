#!/usr/bin/env node

const cli = require('commander');

const serve = require('./serve');
const vendorSetup = require('./vendorSetup');
const package = require('../../package.json');
const ChluSQLIndex = require('chlu-ipfs-support/src/modules/orbitdb/indexes/sql')

let server = null

function handleErrors(fn) {
    return function (...args) {
        fn(...args).catch(err => {
            console.log(err);
            process.exit(1);
        });
    };
}

cli
    .name('chlu-marketplace')
    .description('Reference implementation of the Chlu Marketplace. http://chlu.io')
    .version(package.version);

cli
    .command('start')
    .description('start the Marketplace server')
    .option('-p, --port <n>', 'port to listen on')
    .option('-n, --network <s>', 'Chlu network to use')
    .option('--marketplace-location <s>', 'URL used to access this app from the internet, defaults to localhost:port')
    .option('--directory <s>', 'where to store Chlu and Marketplace data, defaults to ~/.chlu-marketplace')
    .option('--postgres', 'use postgres database instead of SQLite for the Marketplace')
    .option('--database-host <s>')
    .option('--database-name <s>', 'name of database to use or path to SQLite file for the Marketplace')
    .option('--database-user <s>')
    .option('--database-password <s>')
    .option('--chlu-postgres', 'use postgres database instead of SQLite for Chlu')
    .option('--chlu-no-write', 'disable writing to ChluDB. Only use this if you have a collector writing to the same DB')
    .option('--chlu-database-host <s>')
    .option('--chlu-database-name <s>', 'name of database to use or path to SQLite file for Chlu')
    .option('--chlu-database-user <s>')
    .option('--chlu-database-password <s>')
    .action(handleErrors(async cmd => {
        const port = parseInt(cmd.port || 3000)
        const config = {
            port,
            marketplaceLocation: cmd.marketplaceLocation,
            chluIpfs: {
                network: cmd.network,
                OrbitDBIndex: ChluSQLIndex,
                OrbitDBIndexOptions: {
                    dialect: cmd.chluPostgres ? 'postgres' : 'sqlite',
                    enableWrites: !cmd.chluNoWrite,
                    enableValidations: !cmd.chluNoWrite,
                    host: cmd.chluDatabaseHost,
                    storage: cmd.chluPostgres ? null : cmd.chluDatabaseName,
                    database: cmd.chluPostgres ? cmd.chluDatabaseName : null,
                    username: cmd.chluDatabaseUser,
                    password: cmd.chluDatabasePassword,
                }
            },
            db: {
                dialect: cmd.postgres ? 'postgres' : 'sqlite',
                host: cmd.databaseHost,
                port: cmd.databasePort,
                storage: cmd.postgres ? null : cmd.databaseName,
                database: cmd.postgres ? cmd.databaseName : null,
                username: cmd.databaseUser,
                password: cmd.databasePassword,
            }
        }
        server = await serve(port, config);
    }));

cli
    .command('setup-vendor')
    .description('set up a vendor and return the keys')
    .option('-u, --url <s>', 'URL to access the marketplace', 'http://localhost:3000')
    .option('-n, --network <s>', 'Chlu network to use')
    .action(handleErrors(async cmd => {
        await vendorSetup(cmd.url, cmd.network);
    }));

cli.parse(process.argv);

if (!process.argv.slice(2).length) {
    cli.help();
}

process.on('SIGINT', async function() {
    try {
        await stop()
        process.exit(0);
    } catch(exception) {
        console.log(exception);
        process.exit(1);
    }
});

async function stop() {
    console.log('Stopping gracefully');
    if (server && server.mkt) {
        await server.mkt.stop()
    }
    console.log('Goodbye!');
}