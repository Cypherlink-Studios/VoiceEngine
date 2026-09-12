import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';

describe('PluginGateway', () => {
  let server: Server;
  let wss: WebSocketServer;
  let gateway: PluginGateway;
  let tokenStore: TokenStore;
  let spatialEngine: SpatialEngine;
  let port: number;

  beforeEach(async () => {
    server = createServer();
    wss = new WebSocketServer({ server });
    tokenStore = new TokenStore();
    spatialEngine = new SpatialEngine();
    gateway = new PluginGateway(wss, 'secret-123', tokenStore, spatialEngine);

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
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects unauthorized connection without valid secret', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'plugin_handshake', secret: 'wrong-key' }));
      });
      ws.on('close', (code) => {
        expect(code).toBe(4001);
        resolve();
      });
    });
  });

  it('authenticates with valid secret and ingests token and telemetry batches', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'plugin_handshake', secret: 'secret-123' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'handshake_ack') {
          // Send register_token
          ws.send(
            JSON.stringify({
              type: 'register_token',
              token: 'TEST99',
              playerUuid: 'uuid-1',
              playerName: 'PlayerOne',
              expiresAt: Date.now() + 60000,
            })
          );

          // Send telemetry_batch
          ws.send(
            JSON.stringify({
              type: 'telemetry_batch',
              timestamp: Date.now(),
              players: [
                {
                  uuid: 'uuid-1',
                  username: 'PlayerOne',
                  world: 'world',
                  x: 10,
                  y: 64,
                  z: 20,
                  yaw: 0,
                  pitch: 0,
                  isSneaking: false,
                  isSubmerged: false,
                },
              ],
            })
          );

          // Wait a tick for processing
          setTimeout(() => {
            expect(gateway.isPluginConnected()).toBe(true);

            // Verify token was stored
            const redeemed = tokenStore.validateAndRedeem('TEST99');
            expect(redeemed).not.toBeNull();
            expect(redeemed?.playerName).toBe('PlayerOne');

            // Verify telemetry was updated
            const player = spatialEngine.getPlayer('uuid-1');
            expect(player).toBeDefined();
            expect(player?.x).toBe(10);
            expect(player?.serverId).toBe('default');

            ws.close();
            resolve();
          }, 50);
        }
      });
    });
  });

  it('manages multiple Paper servers and Velocity proxy concurrently and targets speech status', async () => {
    // 1. Connect Velocity
    const velocityWs = new WebSocket(`ws://localhost:${port}`);
    // 2. Connect Paper Lobby
    const lobbyWs = new WebSocket(`ws://localhost:${port}`);
    // 3. Connect Paper Survival
    const survivalWs = new WebSocket(`ws://localhost:${port}`);

    const receivedLobbyMessages: any[] = [];
    const receivedSurvivalMessages: any[] = [];

    await new Promise<void>((resolve) => {
      let openCount = 0;
      const checkAllReady = () => {
        openCount++;
        if (openCount === 3) {
          velocityWs.send(
            JSON.stringify({ type: 'plugin_handshake', secret: 'secret-123', role: 'velocity' })
          );
          lobbyWs.send(
            JSON.stringify({ type: 'plugin_handshake', secret: 'secret-123', role: 'paper', serverId: 'lobby' })
          );
          survivalWs.send(
            JSON.stringify({ type: 'plugin_handshake', secret: 'secret-123', role: 'paper', serverId: 'survival' })
          );
        }
      };

      velocityWs.on('open', checkAllReady);
      lobbyWs.on('open', checkAllReady);
      survivalWs.on('open', checkAllReady);

      lobbyWs.on('message', (d) => {
        const msg = JSON.parse(d.toString());
        if (msg.type === 'speech_status') receivedLobbyMessages.push(msg);
      });

      survivalWs.on('message', (d) => {
        const msg = JSON.parse(d.toString());
        if (msg.type === 'speech_status') receivedSurvivalMessages.push(msg);
      });

      setTimeout(() => {
        expect(gateway.isVelocityConnected()).toBe(true);
        const servers = gateway.getConnectedServers();
        expect(servers).toContain('lobby');
        expect(servers).toContain('survival');

        // Send telemetry from lobby for player-1
        lobbyWs.send(
          JSON.stringify({
            type: 'telemetry_batch',
            serverId: 'lobby',
            timestamp: Date.now(),
            players: [
              {
                uuid: 'player-lobby-1',
                username: 'LobbyPlayer',
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

        setTimeout(() => {
          const p = spatialEngine.getPlayer('player-lobby-1');
          expect(p?.serverId).toBe('lobby');

          // Notify speech status: should go directly to lobbyWs, NOT survivalWs
          gateway.notifySpeechStatus('player-lobby-1', true);

          setTimeout(() => {
            expect(receivedLobbyMessages).toHaveLength(1);
            expect(receivedLobbyMessages[0].uuid).toBe('player-lobby-1');
            expect(receivedLobbyMessages[0].speaking).toBe(true);
            expect(receivedSurvivalMessages).toHaveLength(0);

            velocityWs.close();
            lobbyWs.close();
            survivalWs.close();
            resolve();
          }, 50);
        }, 50);
      }, 100);
    });
  });
});
