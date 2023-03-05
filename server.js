import Koa from 'koa';
import Debug from 'debug';
import http from 'http';
import https from 'https';
import Router from 'koa-router';
import ClientManager from './lib/ClientManager.js';

const debug = Debug('localtunnel:server');

export default function (opt) {
    opt = opt || {};

    const landingPage = opt.landing || 'https://localtunnel.github.io/www/';

    const manager = new ClientManager(opt);

    const app = new Koa();
    const router = new Router();

    app.use(router.routes());
    app.use(router.allowedMethods());

    // root endpoint
    app.use(async (ctx, next) => {
        const { path, ip } = ctx.request;
        debug(`Incoming request: ${path}, IP: ${ip}`);

        // skip anything not on the root path
        if (path !== '/') {
            debug('Path is not root. Skipping...');
            ctx.respond = false;
            // await next();
            return;
        }

        const isNewClientRequest = ctx.query['new'] !== undefined;

        if (isNewClientRequest) {
            debug('Creating new client...');

            const info = await manager.newClient({ ...opt, ip });

            const url = `http://localhost:${info.id}`;
            info.url = url;
            ctx.body = info;
            debug(`New client created: ${JSON.stringify(info)}`);
            return;
        }

        // For security, no data is responded in production environment
        if (process.env.NODE_ENV === 'development') {
            // no new client request, send to landing page
            debug('Redirecting to landing page...');
            ctx.redirect(landingPage);
        } else {
            ctx.respond = false;
        }
    });

    return (opt.use_https
        ? https.createServer(opt.https_cert_files)
        : http.createServer())
        .addListener('request', app.callback());
};
