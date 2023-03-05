import http from 'http';
import Debug from 'debug';
import EventEmitter from 'events';

// A client encapsulates req/res handling using an agent
//
// If an agent is destroyed, the request handling will error
// The caller is responsible for handling a failed request
class Client extends EventEmitter {
    constructor(options) {
        super();
        
        const agent = this.agent = options.agent;
        const id = this.id = options.id;

        this.debug = Debug(`lt:Client[${this.id}]`);

        // client is given a grace period in which they can connect before they are _removed_
        this.graceTimeout = setTimeout(() => {
            this.close();
        }, 1000).unref();

        agent.on('online', () => {
            this.debug('client online %s', id);
            clearTimeout(this.graceTimeout);
        });

        agent.on('offline', () => {
            this.debug('client offline %s', id);

            // if there was a previous timeout set, we don't want to double trigger
            clearTimeout(this.graceTimeout);

            // client is given a grace period in which they can re-connect before they are _removed_
            this.graceTimeout = setTimeout(() => {
                this.close();
            }, 1000).unref();
        });

        // TODO(roman): an agent error removes the client, the user needs to re-connect?
        // how does a user realize they need to re-connect vs some random client being assigned same port?
        agent.once('error', (err) => {
            this.close();
        });

        this.server = this.createServer();
    }

    stats() {
        return this.agent.stats();
    }

    createServer() {
        return http.createServer();
    }

    listen(port = null) {
        const server = this.server;
        server.on('request', (req, res) => {
            // without a hostname, we won't know who the request is for
            const hostname = req.headers.host;
            if (!hostname) {
                res.statusCode = 400;
                res.end('Host header is required');
                return;
            }

            this.handleRequest(req, res);
        });

        server.on('upgrade', (req, socket, head) => {
            const hostname = req.headers.host;
            if (!hostname) {
                socket.destroy();
                return;
            }

            this.handleUpgrade(req, socket);
        });

        return new Promise((resolve) => {
            server.listen(port, () => {
                const { port } = server.address();
                this.debug('local listening on port: %d', port);
                console.info(`access to client '${this.id}' at http://127.0.0.1:${port}`)
                resolve({
                    port: port,
                });
            });
        });
    }

    close() {
        clearTimeout(this.graceTimeout);
        this.agent.destroy();
        this.server.close();
        this.emit('close');
    }

    handleRequest(req, res) {
        this.debug('> %s', req.url);
        const opt = {
            path: req.url,
            agent: this.agent,
            method: req.method,
            headers: req.headers
        };
        const clientReq =  http.request(opt, (clientRes) => {
            this.debug('< %s', req.url);
            // write response code and headers
            res.writeHead(clientRes.statusCode, clientRes.headers);

            clientRes.pipe(res);
        });

        // this can happen when underlying agent produces an error
        // in our case we 504 gateway error this?
        // if we have already sent headers?
        clientReq.once('error', (err) => {
            // TODO(roman): if headers not sent - respond with gateway unavailable
            console.error(err);
        });

        req.pipe(clientReq);
    }

    handleUpgrade(req, socket) {
        this.debug('> [up] %s', req.url);
        socket.once('error', (err) => {
            // These client side errors can happen if the client dies while we are reading
            // We don't need to surface these in our logs.
            if (err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT') {
                return;
            }
            console.error(err);
        });

        this.agent.createConnection({}, (err, conn) => {
            this.debug('< [up] %s', req.url);
            // any errors getting a connection mean we cannot service this request
            if (err) {
                socket.end();
                return;
            }

            // socket met have disconnected while we waiting for a socket
            if (!socket.readable || !socket.writable) {
                conn.destroy();
                socket.end();
                return;
            }

            // websocket requests are special in that we simply re-create the header info
            // then directly pipe the socket data
            // avoids having to rebuild the request and handle upgrades via the http client
            const arr = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
            for (let i = 0; i < (req.rawHeaders.length - 1); i += 2) {
                arr.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
            }

            arr.push('');
            arr.push('');

            conn.pipe(socket);
            socket.pipe(conn);
            conn.write(arr.join('\r\n'));
        });
    }
}

export default Client;