import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { WebSocketServer } from 'ws';
import { AddressInfo } from 'net';
import { ClientGateway } from '../src/gateway/ClientGateway.js';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';
import { SettingsManager } from '../src/config/SettingsManager.js';
import { StressTestRunner } from '../../scripts/bench_stress_test.js';

describe('Synthetic Stress Test Benchmark Suite', () => {
  let server: Server;
  let clientWss: WebSocketServer;
  let pluginWss: WebSocketServer;
  let tokenStore: TokenStore;
  let spatialEngine: SpatialEngine;
  let sfu: MediasoupManager;
  let pluginGateway: PluginGateway;
  let clientGateway: ClientGateway;
  let settingsManager: SettingsManager;
  let port: number;

  beforeEach(async () => {
    sfu = new MediasoupManager();
    await sfu.init(2);

    tokenStore = new TokenStore();
    spatialEngine = new SpatialEngine(30.0, 8.0, 0.08, 2.0);
    settingsManager = new SettingsManager();

    server = createServer();
    clientWss = new WebSocketServer({ noServer: true });
    pluginWss = new WebSocketServer({ noServer: true });

    pluginGateway = new PluginGateway(
      pluginWss,
      'test-secret',
      tokenStore,
      spatialEngine
    );

    clientGateway = new ClientGateway(
      clientWss,
      tokenStore,
      spatialEngine,
      sfu,
      pluginGateway,
      settingsManager
    );
    pluginGateway.setClientGateway(clientGateway);

    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      if (url.pathname === '/ws/plugin') {
        pluginWss.handleUpgrade(req, socket, head, (ws) => {
          pluginWss.emit('connection', ws, req);
        });
      } else if (url.pathname === '/ws/client') {
        clientWss.handleUpgrade(req, socket, head, (ws) => {
          clientWss.emit('connection', ws, req);
        });
      } else {
        socket.destroy();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        port = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    clientGateway.shutdown();
    pluginGateway.shutdown();
    sfu.close();
    clientWss.close();
    pluginWss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('runs synthetic bot stress scenarios and collects throughput metrics', async () => {
    const runner = new StressTestRunner({
      serverUrl: `http://localhost:${port}`,
      pluginSecret: 'test-secret',
      scenario: 'both',
      clusterBots: 15,
      openworldBots: 20,
      durationSec: 1,
    });

    // Should complete cleanly without unhandled rejections or crashes
    await expect(runner.start()).resolves.toBeUndefined();
  }, 15000);
});
