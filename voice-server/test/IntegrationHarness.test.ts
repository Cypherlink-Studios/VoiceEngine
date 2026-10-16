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

  it('propagates radar_status end-to-end from plugin telemetry batch to client signaling across server changes', async () => {
    // 1. Plugin connects and handshakes
    const pluginWs = new WebSocket(`ws://localhost:${port}/ws/plugin`);
    await new Promise<void>((resolve) => {
      pluginWs.on('open', () => {
        pluginWs.send(
          JSON.stringify({
            type: 'plugin_handshake',
            secret: 'secret-harness',
            role: 'paper',
            serverId: 'server-alpha',
          })
        );
      });
      pluginWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'handshake_ack') {
          resolve();
        }
      });
    });

    const playerUuid = '00000000-0000-0000-0000-000000000001';
    // 2. Register token and send telemetry with radarEnabled = false on server-alpha
    pluginWs.send(
      JSON.stringify({
        type: 'register_token',
        token: 'TOKEN_RADAR_E2E',
        playerUuid,
        playerName: 'Steve',
        expiresAt: Date.now() + 60000,
      })
    );

    pluginWs.send(
      JSON.stringify({
        type: 'telemetry_batch',
        serverId: 'server-alpha',
        radarEnabled: false,
        players: [
          {
            uuid: playerUuid,
            username: 'Steve',
            world: 'world',
            x: 0,
            y: 64,
            z: 0,
            yaw: 0,
            pitch: 0,
            isSneaking: false,
            isSubmerged: false,
          },
        ],
      })
    );

    // Wait a brief tick for spatial engine to update
    await new Promise((r) => setTimeout(r, 20));

    // 3. Client connects and authenticates
    const clientWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const radarEvents: boolean[] = [];

    await new Promise<void>((resolve) => {
      clientWs.on('open', () => {
        clientWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'TOKEN_RADAR_E2E',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      clientWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'radar_status') {
          radarEvents.push(msg.enabled);

          if (radarEvents.length === 1) {
            // First event on connection should be false
            expect(msg.enabled).toBe(false);

            // Now plugin sends telemetry enabling radar on server-alpha
            pluginWs.send(
              JSON.stringify({
                type: 'telemetry_batch',
                serverId: 'server-alpha',
                radarEnabled: true,
                players: [
                  {
                    uuid: playerUuid,
                    username: 'Steve',
                    world: 'world',
                    x: 1,
                    y: 64,
                    z: 0,
                    yaw: 0,
                    pitch: 0,
                    isSneaking: false,
                    isSubmerged: false,
                  },
                ],
              })
            );
          } else if (radarEvents.length === 2) {
            // Second event: server-alpha updated to true
            expect(msg.enabled).toBe(true);

            // Now move player to server-beta which has radar disabled
            pluginWs.send(
              JSON.stringify({
                type: 'telemetry_batch',
                serverId: 'server-beta',
                radarEnabled: false,
                players: [
                  {
                    uuid: playerUuid,
                    username: 'Steve',
                    world: 'world_nether',
                    x: 10,
                    y: 64,
                    z: 10,
                    yaw: 0,
                    pitch: 0,
                    isSneaking: false,
                    isSubmerged: false,
                  },
                ],
              })
            );
          } else if (radarEvents.length === 3) {
            // Third event: player moved to server-beta (false)
            expect(msg.enabled).toBe(false);
            clientWs.close();
            pluginWs.close();
            resolve();
          }
        }
      });
    });

    expect(radarEvents).toEqual([false, true, false]);
  });
});
