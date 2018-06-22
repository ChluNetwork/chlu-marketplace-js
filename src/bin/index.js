#!/usr/bin/env node

const cli = require('commander');

const serve = require('./serve');
const vendorSetup = require('./vendorSetup');
const package = require('../../package.json');

function handleErrors(fn) {
    return function (...args) {
        fn(...args).catch(err => {
            console.trace(err);
            process.exit(1);
        });
    };
}

cli
    .name('chlu-marketplace')
    .description('Reference implementation of the Chlu Marketplace. http://chlu.io')
    .version(package.version);

cli
    .command('serve')
    .description('start the Marketplace server')
    .option('-p, --port <n>', 'port to listen on', parseInt, 3000)
    .option('-c, --configuration-file <s>', 'configuration file to use')
    .action(handleErrors(async cmd => {
        await serve(cmd.port, cmd.configurationFile);
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