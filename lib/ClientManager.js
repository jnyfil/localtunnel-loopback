import Debug from 'debug';
import Client from './Client.js';
import TunnelAgent from './TunnelAgent.js';
import { generateId } from './utils.js';

const debug = Debug('lt:ClientManager');

// Manage sets of clients
//
// A client is a "user session" established to service a remote localtunnel client
class ClientManager {
    constructor(opt) {
        this.opt = opt || {};

        // id -> client instance
        this.clients = new Map();

        // can't ask for ports already is use
        this.allocated_ports = new Set();

        // statistics
        this.stats = {
            tunnels: 0
        };

        // This is totally wrong :facepalm: this needs to be per-client...
        this.graceTimeout = null;
    }

    // create a new tunnel with `id`
    // if the id is already used, a random id is assigned
    // if the tunnel could not be created, throws an error
    async newClient(opt) {
        const { use_https = false, cert_files, max_tcp_sockets: maxSockets } = opt
        const clients = this.clients;
        const stats = this.stats;
        const id = generateId(clients.keys());

        console.info(`connecting client ip: ${opt.ip}`);
        console.info(`created id: '${id}'`);

        const agent = new TunnelAgent({
            id,
            ip:opt.ip,
            maxSockets,
            cert_files,
        });

        const client = new Client({
            id,
            agent,
            cert_files,
        });

        client.once('close', () => {
            this.removeClient(id);
        });


        try {            
            const {port:tunnel_ports} = await agent.listen(this.getAvailablePort(opt.tunnel_ports));
            const {port:local_port} = await client.listen(this.getAvailablePort(opt.local_port));
    
            this.allocated_ports.add(local_port);
            this.allocated_ports.add(tunnel_ports);
    
            // add to clients map immediately
            // avoiding races with other clients requesting same id
            this.clients.set(id,{client,local_port,tunnel_ports});
            ++stats.tunnels;

            return {
                id: local_port,
                port: tunnel_ports,
                max_conn_count: maxSockets,
            };
        }
        catch (err) {
            this.removeClient(id);
            // rethrow error for upstream to handle
            console.err(err);
            throw err;
        }
    }

    removeClient(id) {
        debug('removing client:', id);
        const {client, local_port, tunnel_ports} = this.clients.get(id);
        if (!client) return;
        this.clients.delete(id);
        this.allocated_ports.delete(local_port);
        this.allocated_ports.delete(tunnel_ports);
        client.close();
        --this.stats.tunnels;
        console.info(`removed client: '${id}'`);
    }

    hasClient(id) {
        return this.clients.has(id);
    }

    getClient(id) {
        return this.clients.get(id);
    }


    getAvailablePort(ports) {
        const allocated_ports = this.allocated_ports;
        if (ports) {
            // By default, it is processed as an array.
            if (!Array.isArray(ports)) ports = [ports];
    
            for (const port of ports) {
                if (allocated_ports.has(port)) continue;
    
                return port;
            }
        }
        return null;
    }
}

export default ClientManager;
