#!/usr/bin/env node

import 'localenv';
import Debug from 'debug';
import path from 'path';
import os from 'os';
import fs from 'fs';
import tls from 'tls';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
import CreateServer from '../server.js';
import { validatePort } from '../lib/utils.js';

const debug = Debug('localtunnel');

const argv = yargs(hideBin(process.argv))
    .version()
    .strict(true)
    .option('address', {
        describe: 'IP address to bind to',
        default: '0.0.0.0',
        type: 'string',
    })
    .option('port', {
        describe:
            "listen on this port for outside requests.\nIf this option is not used, the server automatically listens on port 80 or 443 depending on '--use-https' flag, which is the default behavior.",
        type: 'number',
        coerce: (port) => {
            validatePort(port)
            return port;
        },
    })
    .option('tunnel-port', {
        describe: 'Establish on this port.',
        array: true,
        coerce: (ports) => {
            if (!Array.isArray(ports)) {
                ports = [ports]
            }
            for (const port of ports) {
                validatePort(port)
            }
            return ports;
        },
    })
    .option('local-port', {
        describe: 'Access to the established destination by this port',
        default: 7860,
        type: 'number',
        coerce: (port) => {
            validatePort(port)
            return port;
        },
    })
    .option('use-https', {
        describe: 'use this flag to indicate proxy over https',
        default: false,
        type: 'boolean',
    })
    .option('https-key-path', {
        describe:
            "Path to certificate key file.\nOnly used when 'use-https' flag is specified",
        default: path.join(os.homedir(), '.ssh', 'private.key.pem'),
        type: 'string',

        normalize: (value) => path.normalize(value),
    })
    .option('https-cert-path', {
        describe:
            "Path to certificate PEM file.\nOnly used when 'use-https' flag is specified",
        default: path.join(os.homedir(), '.ssh', 'certificate.crt.pem'),
        type: 'string',
        normalize: (value) => path.normalize(value),
    })
    .option('https-ca-path', {
        describe:
            "Path to certificate authority file.\nOnly used when 'use-https' flag is specified",
        // default: path.join(os.homedir(), '.ssh', 'ca.pem'),
        type: 'string',
        normalize: (value) => path.normalize(value),
    })
    .option('max-sockets', {
        describe:
            'maximum number of tcp sockets each client is allowed to establish at one time (the tunnels)',
        default: 10,
        type: 'number',
    })
    .check((argv, option) => {
        if (argv.useHttps) {
            const { httpsKeyPath: keyPath, httpsCertPath: certPath } = argv;
            if (!fs.existsSync(keyPath)) {
                throw `The SSL private key file '${keyPath}' does not exist.`;
            }
            if (!fs.existsSync(certPath)) {
                throw `The SSL certificate file '${certPath}' does not exist.`;
            }

            // verify the SSL certificate
            tls.createSecureContext({
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath),
            });
        }

        return true;
    })
    .help(true).argv;

if (!argv.port) {
    argv.port = 80;
    if (argv.useHttps) {
        argv.port = 443;
    }
}

const server = CreateServer({
    use_https: argv.useHttps,
    https_key_path: argv.httpsKeyPath,
    https_cert_path: argv.httpsCertPath,
    https_ca_path: argv.httpsCaPath,
    max_tcp_sockets: argv.maxSockets,
    tunnel_ports: argv.tunnelPort,
    local_port: argv.localPort,
});

server.listen(argv.port, argv.address, () => {
    console.info('server listening on port: %d', server.address().port);
});

process.on('SIGINT', () => {
    process.exit();
});

process.on('SIGTERM', () => {
    process.exit();
});

process.on('uncaughtException', (err) => {
    console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(reason);
});

// vim: ft=javascript