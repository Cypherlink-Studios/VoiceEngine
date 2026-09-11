import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { ClientGateway } from '../src/gateway/ClientGateway.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';
import { runMockTelemetry } from '../src/harness/mockTelemetry.js';

describe('IntegrationHarness', () => {
  let server: Server;
  let pluginWss: WebSocketServer;
  let clientWss: WebSocketServer;
  let tokenStore: TokenStore;
  let spatialEngine: SpatialEngine;
  let sfu: MediasoupManager;
  let pluginGateway: PluginGateway;
  let clientGateway: ClientGateway;
  let port: number;

  beforeEach(async () => {
    server = createServer();
    pluginWss = new WebSocketServer({ noServer: true });
    clientWss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      const url = req.url || '';
      if (url.startsWith('/ws/plugin')) {
        pluginWss.handleUpgrade(req, socket, head, (ws) => {
          pluginWss.emit('connection', ws, req);
        });
      } else if (url.startsWith('/ws/client')) {
        clientWss.handleUpgrade(req, socket, head, (ws) => {
          clientWss.emit('connection', ws, req);
        });
      }
    });

    tokenStore = new TokenStore();
    spatialEngine = new SpatialEngine(30.0, 8.0);
    sfu = new MediasoupManager();
    await sfu.init();

    pluginGateway = new PluginGateway(pluginWss, 'secret-harness', tokenStore, spatialEngine);
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
    pluginWss.close();
    clientWss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('runs mock telemetry generator, populates tokens, and streams multi-player positions', async () => {
    const mockWs = runMockTelemetry(`ws://localhost:${port}/ws/plugin`, 'secret-harness');

    // Wait for telemetry frames to arrive
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const players = spatialEngine.getAllPlayers();
        if (players.length >= 4) {
          clearInterval(checkInterval);
          mockWs.close();
          resolve();
        }
      }, 50);
    });

    // Check that players were tracked
    const players = spatialEngine.getAllPlayers();
    expect(players.length).toBeGreaterThanOrEqual(4);

    const steve = spatialEngine.getPlayer('00000000-0000-0000-0000-000000000001');
    expect(steve).toBeDefined();
    expect(steve?.username).toBe('Steve');

    // Check that tokens were registered
    expect(tokenStore.size()).toBeGreaterThanOrEqual(4);
    const redeemed = tokenStore.validateAndRedeem('STEVE1');
    expect(redeemed).not.toBeNull();
    expect(redeemed?.playerName).toBe('Steve');

    // Check audible peers for Steve
    const audibleForSteve = spatialEngine.getAudiblePeersFor(steve!.uuid);
    expect(audibleForSteve.length).toBeGreaterThanOrEqual(2);

    // Verify submarine peer has submerged flag
    const submariner = audibleForSteve.find((p) => p.peerUsername === 'Submariner');
    expect(submariner).toBeDefined();
    expect(submariner?.isSubmerged).toBe(true);
  });
});
