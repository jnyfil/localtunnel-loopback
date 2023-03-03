import Debug from 'debug';
import Client from './Client.js';
import TunnelAgent from './TunnelAgent.js';
import http from 'http';

// Manage sets of clients
//
// A client is a "user session" established to service a remote localtunnel client
class ClientManager {
    constructor(opt) {
        this.opt = opt || {};

        // id -> client instance
        this.clients = new Map();
        this.tunnels = new Set();

        // statistics
        this.stats = {
            tunnels: 0
        };

        this.debug = Debug('lt:ClientManager');

        // This is totally wrong :facepalm: this needs to be per-client...
        this.graceTimeout = null;
    }

    // create a new tunnel with `id`
    // if the id is already used, a random id is assigned
    // if the tunnel could not be created, throws an error
    async newClient(opt) {
        let { local_port = null, tunnel_ports = [] } = opt
        const { use_https = false, https_key_path, https_cert_path } = opt
        const clients = this.clients;
        const stats = this.stats;

        // can't ask for id already is use
        if (local_port && clients[local_port]) local_port = null;

        const server = http.createServer();
        // For compatibility with the localtunnel client, the variable name is kept as 'id' without changing it.
        const id = await new Promise((resolve) => {
            return server.listen(local_port, () => {
                const port = server.address().port;
                console.info(`server is running at http://localhost:${port}`);
                resolve(port);
            });
        });

        const maxSockets = this.opt.max_tcp_sockets;
        const agent = new TunnelAgent(opt.ip, {
            use_https,
            clientId: id,
            maxSockets: 10,
            https_key_path,
            https_cert_path
        });

        const client = new Client({
            id: id,
            agent,
            server,
            use_https
        });

        // add to clients map immediately
        // avoiding races with other clients requesting same id
        clients[id] = client;

        client.once('close', () => {
            this.removeClient(id);
        });

        // try/catch used here to remove client id
        try {
            let tunnel_port = null;
            for (const port of tunnel_ports) {
                if (this.tunnels.has(port)) continue;
                tunnel_port = port;
                break;
            }
            const info = await agent.listen(tunnel_port);
            ++stats.tunnels;
            client.tunnel_port = tunnel_port;
            this.tunnels.add(info.port);
            return {
                id: id,
                port: info.port,
                max_conn_count: maxSockets,
            };
        }
        catch (err) {
            this.removeClient(id);
            // rethrow error for upstream to handle
            throw err;
        }
    }

    removeClient(id) {
        console.info('removing client: %s', id);
        const client = this.clients[id];
        if (!client) {
            return;
        }
        --this.stats.tunnels;
        delete this.clients[id];
        this.tunnels.delete(client.tunnel_port);
        client.close();
    }

    hasClient(id) {
        return !!this.clients[id];
    }

    getClient(id) {
        return this.clients[id];
    }
}

export default ClientManager;
