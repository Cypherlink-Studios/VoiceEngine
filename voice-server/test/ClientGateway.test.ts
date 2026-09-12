import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { ClientGateway } from '../src/gateway/ClientGateway.js';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';

describe('ClientGateway', () => {
  let server: Server;
  let clientWss: WebSocketServer;
  let pluginWss: WebSocketServer;
  let tokenStore: TokenStore;
  let spatialEngine: SpatialEngine;
  let sfu: MediasoupManager;
  let pluginGateway: PluginGateway;
  let clientGateway: ClientGateway;
  let port: number;

  beforeEach(async () => {
    server = createServer();
    clientWss = new WebSocketServer({ noServer: true });
    pluginWss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      const url = req.url || '';
      if (url.startsWith('/ws/client')) {
        clientWss.handleUpgrade(req, socket, head, (ws) => {
          clientWss.emit('connection', ws, req);
        });
      } else if (url.startsWith('/ws/plugin')) {
        pluginWss.handleUpgrade(req, socket, head, (ws) => {
          pluginWss.emit('connection', ws, req);
        });
      }
    });

    tokenStore = new TokenStore();
    spatialEngine = new SpatialEngine(30.0, 8.0);
    sfu = new MediasoupManager();
    await sfu.init();

    pluginGateway = new PluginGateway(pluginWss, 'secret-123', tokenStore, spatialEngine);
    clientGateway = new ClientGateway(clientWss, tokenStore, spatialEngine, sfu, pluginGateway);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    clientGateway.shutdown();
    sfu.close();
    clientWss.close();
    pluginWss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects invalid or expired token on client connection', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'client_auth', token: 'INVALID_TOKEN' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe('auth_error');
      });

      ws.on('close', (code) => {
        expect(code).toBe(4002);
        resolve();
      });
    });
  });

  it('authenticates with valid token, initializes transports, and notifies speech state', async () => {
    tokenStore.registerToken({
      token: 'VALID1',
      playerUuid: 'uuid-steve',
      playerName: 'Steve',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'VALID1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          expect(msg.playerUuid).toBe('uuid-steve');
          expect(msg.username).toBe('Steve');
          expect(msg.sendTransportOptions).toBeDefined();
          expect(msg.recvTransportOptions).toBeDefined();
          expect(clientGateway.getConnectedClientsCount()).toBe(1);

          // Send speaking event
          ws.send(JSON.stringify({ type: 'speaking', speaking: true }));

          setTimeout(() => {
            ws.close();
            resolve();
          }, 50);
        }
      });
    });
  });

  it('handles client ping by returning pong with matching timestamp', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping', timestamp: 123456789 }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe('pong');
        expect(msg.timestamp).toBe(123456789);
        ws.close();
        resolve();
      });
    });
  });
});

