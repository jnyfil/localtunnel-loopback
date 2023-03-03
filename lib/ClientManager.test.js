import assert from 'assert';
import net from 'net';

import ClientManager from './ClientManager.js';

describe('ClientManager', () => {
    let manager;
    beforeEach(() => {
        manager = new ClientManager();
    });

    it('should construct with no tunnels', () => {
        assert.equal(manager.stats.tunnels, 0);
    });

    it('should create a new client with random id', async () => {
        const client = await manager.newClient({local_port:null});
        assert(manager.hasClient(client.id));
        manager.removeClient(client.id);
    });

    it('should create a new client with id(local_port)', async () => {
        const id = 12345;
        const client = await manager.newClient({local_port:id});
        assert(manager.hasClient(id));
        manager.removeClient(id);
    });

    it('should create a new client with random id(local_port) if previous exists', async () => {
        const id = 12345;
        const clientA = await manager.newClient({local_port:id, ip:'127.0.0.1'});
        const clientB = await manager.newClient({local_port:id});
        assert(clientA.id, id);
        assert(manager.hasClient(clientB.id));
        assert(clientB.id != clientA.id);
        manager.removeClient(clientB.id);
        manager.removeClient(id);
    });

    it('should remove client once it goes offline', async () => {
        const id = 12345;
        const client = await manager.newClient({local_port:id, ip:'127.0.0.1'});

        const socket = await new Promise((resolve) => {
            const netClient = net.createConnection({ port: client.port }, () => {
                resolve(netClient);
            });
        });
        const closePromise = new Promise(resolve => socket.once('close', resolve));
        socket.end();
        await closePromise;

        // should still have client - grace period has not expired
        assert(manager.hasClient(id));

        // wait past grace period (1s)
        await new Promise(resolve => setTimeout(resolve, 1500));
        assert(!manager.hasClient(id));
    }).timeout(5000);

    it('should remove correct client once it goes offline', async () => {
        const id1 = 12345, id2 = 23456;
        const clientFoo = await manager.newClient({local_port:id1, ip:'127.0.0.1'});
        const clientBar = await manager.newClient({local_port:id2, ip:'127.0.0.1'});

        const socket = await new Promise((resolve) => {
            const netClient = net.createConnection({ port: clientFoo.port }, () => {
                resolve(netClient);
            });
        });

        await new Promise(resolve => setTimeout(resolve, 1500));

        // foo should still be ok
        assert(manager.hasClient(id1));

        // clientBar shound be removed - nothing connected to it
        assert(!manager.hasClient(id2));

        manager.removeClient(id1);
        socket.end();
    }).timeout(5000);

    it('should remove clients if they do not connect within 5 seconds', async () => {
        const id = 12345;
        const clientFoo = await manager.newClient({local_port:id, ip:'127.0.0.1'});
        assert(manager.hasClient(id));

        // wait past grace period (1s)
        await new Promise(resolve => setTimeout(resolve, 1500));
        assert(!manager.hasClient(id));
    }).timeout(5000);
});
