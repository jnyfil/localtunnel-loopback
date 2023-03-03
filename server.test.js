import request from 'supertest';
import assert from 'assert';

import createServer from './server.js';

describe('Server', () => {
    it('server starts and stops', async () => {
        const server = createServer();
        await new Promise(resolve => server.listen(resolve));
        await new Promise(resolve => server.close(resolve));
    });

    it('should redirect root requests to landing page', async () => {
        const server = createServer();
        const res = await request(server).get('/');
        assert.equal('https://localtunnel.github.io/www/', res.headers.location);
    });

    it('should support custom base domains', async () => {
        const server = createServer({
            domain: 'domain.example.com',
        });

        const res = await request(server).get('/');
        assert.equal('https://localtunnel.github.io/www/', res.headers.location);
    });
});