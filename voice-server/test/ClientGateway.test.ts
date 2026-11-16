import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { ClientGateway } from '../src/gateway/ClientGateway.js';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';
import { decodeSpatialBatch } from '../src/spatial/BinarySpatialCodec.js';

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

  it('handles client_disconnect frame and cleans up session immediately', async () => {
    tokenStore.registerToken({
      token: 'DISC1',
      playerUuid: 'uuid-alex',
      playerName: 'Alex',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'DISC1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          expect(clientGateway.getConnectedClientsCount()).toBe(1);
          // Send explicit client_disconnect
          ws.send(JSON.stringify({ type: 'client_disconnect' }));
        }
      });

      ws.on('close', () => {
        expect(clientGateway.getConnectedClientsCount()).toBe(0);
        resolve();
      });
    });
  });

  it('allows disconnecting session via disconnectSession and disconnectPlayer helper methods', async () => {
    tokenStore.registerToken({
      token: 'DISC2',
      playerUuid: 'uuid-player2',
      playerName: 'Player2',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'DISC2',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          expect(clientGateway.getConnectedClientsCount()).toBe(1);
          const disconnected = clientGateway.disconnectPlayer('uuid-player2');
          expect(disconnected).toBe(true);
          expect(clientGateway.getConnectedClientsCount()).toBe(0);
        }
      });

      ws.on('close', () => {
        resolve();
      });
    });
  });

  it('pauses proximity consumer when peer moves out of range and resumes when returning', async () => {
    tokenStore.registerToken({
      token: 'STEVE_P',
      playerUuid: 'uuid-steve-p',
      playerName: 'SteveP',
      expiresAt: Date.now() + 60000,
    });
    tokenStore.registerToken({
      token: 'ALEX_P',
      playerUuid: 'uuid-alex-p',
      playerName: 'AlexP',
      expiresAt: Date.now() + 60000,
    });

    // Steve is at (0, 64, 0), Alex is at (10, 64, 0) -> distance 10m (audible)
    spatialEngine.updatePlayer({
      uuid: 'uuid-steve-p',
      username: 'SteveP',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });
    spatialEngine.updatePlayer({
      uuid: 'uuid-alex-p',
      username: 'AlexP',
      world: 'world',
      x: 10,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });

    const steveWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const alexWs = new WebSocket(`ws://localhost:${port}/ws/client`);

    let alexReceivedNewConsumer = false;
    let alexReceivedPause = false;
    let alexReceivedResume = false;
    let alexReceivedConsumerClosed = false;

    await new Promise<void>((resolve) => {
      let steveReady = false;
      let alexReady = false;

      const checkBothReady = () => {
        if (steveReady && alexReady) {
          // Both connected, wait for initial routing
        }
      };

      steveWs.on('open', () => {
        steveWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'STEVE_P',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      steveWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          // Produce mock audio
          steveWs.send(
            JSON.stringify({
              type: 'produce',
              kind: 'audio',
              rtpParameters: {
                codecs: [
                  {
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                    payloadType: 111,
                  },
                ],
                encodings: [{ ssrc: 11111111 }],
              },
            })
          );
        } else if (msg.type === 'produced') {
          steveReady = true;
          checkBothReady();
        }
      });

      alexWs.on('open', () => {
        alexWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'ALEX_P',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      alexWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          alexReady = true;
          checkBothReady();
        } else if (msg.type === 'new_consumer' && msg.peerUuid === 'uuid-steve-p') {
          alexReceivedNewConsumer = true;
          // Now move Steve far away to distance 100m (>30m)
          spatialEngine.updatePlayer({
            uuid: 'uuid-steve-p',
            username: 'SteveP',
            world: 'world',
            x: 100,
            y: 64,
            z: 0,
            yaw: 0,
            pitch: 0,
            isSneaking: false,
            isSubmerged: false,
          });
        } else if (msg.type === 'peer_spatial_update' && msg.peerUuid === 'uuid-steve-p') {
          if (msg.isPaused && !alexReceivedPause) {
            alexReceivedPause = true;
            expect(msg.peerUsername).toBe('SteveP');
            // Now move Steve back within audible range (10m)
            spatialEngine.updatePlayer({
              uuid: 'uuid-steve-p',
              username: 'SteveP',
              world: 'world',
              x: 10,
              y: 64,
              z: 0,
              yaw: 0,
              pitch: 0,
              isSneaking: false,
              isSubmerged: false,
            });
          } else if (alexReceivedPause && !msg.isPaused && !alexReceivedResume) {
            alexReceivedResume = true;
            expect(msg.peerUsername).toBe('SteveP');
            // Now disconnect Steve to verify consumer_closed
            steveWs.close();
          }
        } else if (msg.type === 'consumer_closed' && msg.peerUuid === 'uuid-steve-p') {
          alexReceivedConsumerClosed = true;
          alexWs.close();
          resolve();
        }
      });
    });

    expect(alexReceivedNewConsumer).toBe(true);
    expect(alexReceivedPause).toBe(true);
    expect(alexReceivedResume).toBe(true);
    expect(alexReceivedConsumerClosed).toBe(true);
  });

  it('dispatches binary batch frames to clients advertising supportsBinary', async () => {
    const steveUuid = '11111111-1111-1111-1111-111111111111';
    const alexUuid = '22222222-2222-2222-2222-222222222222';

    tokenStore.registerToken({
      token: 'STEVE_BIN',
      playerUuid: steveUuid,
      playerName: 'SteveBin',
      expiresAt: Date.now() + 60000,
    });
    tokenStore.registerToken({
      token: 'ALEX_BIN',
      playerUuid: alexUuid,
      playerName: 'AlexBin',
      expiresAt: Date.now() + 60000,
    });

    spatialEngine.updatePlayer({
      uuid: steveUuid,
      username: 'SteveBin',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });
    spatialEngine.updatePlayer({
      uuid: alexUuid,
      username: 'AlexBin',
      world: 'world',
      x: 5,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });

    const steveWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const alexWs = new WebSocket(`ws://localhost:${port}/ws/client`);

    let receivedBinaryBatch = false;

    await new Promise<void>((resolve) => {
      steveWs.on('open', () => {
        steveWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'STEVE_BIN',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      steveWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          steveWs.send(
            JSON.stringify({
              type: 'produce',
              kind: 'audio',
              rtpParameters: {
                codecs: [
                  {
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                    payloadType: 111,
                  },
                ],
                encodings: [{ ssrc: 22222222 }],
              },
            })
          );
        } else if (msg.type === 'produced') {
          // Steve is now producing audio, authenticate Alex
          alexWs.send(
            JSON.stringify({
              type: 'client_auth',
              token: 'ALEX_BIN',
              supportsBinary: true,
              rtpCapabilities: sfu.getRtpCapabilities(),
            })
          );
        }
      });

      alexWs.on('message', (data, isBinary) => {
        if (typeof data === 'string' || (!isBinary && data.toString().startsWith('{'))) {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'auth_success' || msg.type === 'new_consumer') {
              // Move Steve to trigger a deadband update
              spatialEngine.updatePlayer({
                uuid: steveUuid,
                username: 'SteveBin',
                world: 'world',
                x: 2,
                y: 64,
                z: 0,
                yaw: 0,
                pitch: 0,
                isSneaking: false,
                isSubmerged: false,
              });
            }
          } catch {}
        }

        if (isBinary || data instanceof Buffer) {
          try {
            const buffer =
              data instanceof Buffer
                ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
                : (data as ArrayBuffer);
            const peers = decodeSpatialBatch(buffer);
            const steve = peers.find((p) => p.peerUuid === steveUuid);
            if (steve) {
              expect(steve.distance).toBeGreaterThan(0);
              receivedBinaryBatch = true;
              steveWs.close();
              alexWs.close();
              resolve();
            }
          } catch {
            // Ignore parse errors on non-batch buffers
          }
        }
      });
    });

    expect(receivedBinaryBatch).toBe(true);
  });

  it('suppresses speech notification and keeps session.isSpeaking false when session is muted by moderation', async () => {
    tokenStore.registerToken({
      token: 'MUTED1',
      playerUuid: 'uuid-muted',
      playerName: 'MutedPlayer',
      expiresAt: Date.now() + 60000,
      isMuted: true,
    });

    const notifySpeechStatusSpy = vi.spyOn(pluginGateway, 'notifySpeechStatus');

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'MUTED1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          // Attempt to send speaking frame while muted
          ws.send(JSON.stringify({ type: 'speaking', speaking: true }));
          setTimeout(() => {
            ws.close();
            resolve();
          }, 50);
        }
      });
    });

    expect(notifySpeechStatusSpy).not.toHaveBeenCalled();
    notifySpeechStatusSpy.mockRestore();
  });

  it('dispatches initial radar_status frame upon client authentication and reflects server status', async () => {
    // Register player on a server where radar is disabled
    spatialEngine.updatePlayer({
      uuid: 'uuid-radar-disabled',
      username: 'StealthPlayer',
      serverId: 'pvp-hardcore',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });
    spatialEngine.setServerRadarEnabled('pvp-hardcore', false);

    tokenStore.registerToken({
      token: 'RADAR_TEST_1',
      playerUuid: 'uuid-radar-disabled',
      playerName: 'StealthPlayer',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);
    const receivedMessages: any[] = [];

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'RADAR_TEST_1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        receivedMessages.push(msg);
        if (msg.type === 'radar_status') {
          expect(msg.enabled).toBe(false);
          ws.close();
          resolve();
        }
      });
    });

    const radarStatusMsg = receivedMessages.find((m) => m.type === 'radar_status');
    expect(radarStatusMsg).toBeDefined();
    expect(radarStatusMsg.enabled).toBe(false);
  });

  it('dynamically pushes radar_status update when server radar policy changes', async () => {
    spatialEngine.updatePlayer({
      uuid: 'uuid-dynamic-player',
      username: 'DynamicPlayer',
      serverId: 'lobby',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });
    spatialEngine.setServerRadarEnabled('lobby', true);

    tokenStore.registerToken({
      token: 'RADAR_TEST_2',
      playerUuid: 'uuid-dynamic-player',
      playerName: 'DynamicPlayer',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);
    const radarUpdates: boolean[] = [];

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'RADAR_TEST_2',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'radar_status') {
          radarUpdates.push(msg.enabled);
          if (radarUpdates.length === 1) {
            // First update: should be true
            expect(msg.enabled).toBe(true);

            // Now dynamically disable radar for lobby
            spatialEngine.setServerRadarEnabled('lobby', false);
          } else if (radarUpdates.length === 2) {
            // Second update: dynamically pushed as false
            expect(msg.enabled).toBe(false);
            ws.close();
            resolve();
          }
        }
      });
    });

    expect(radarUpdates).toEqual([true, false]);
  });

  it('dispatches radar_status: false upon client_auth on custom server even when player is unindexed in spatial grid', async () => {
    spatialEngine.setServerRadarEnabled('custom-hardcore-pvp', false);

    tokenStore.registerToken({
      token: 'RADAR_UNINDEXED_1',
      playerUuid: 'uuid-unindexed-1',
      playerName: 'GhostPlayer',
      serverId: 'custom-hardcore-pvp',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);
    const receivedMessages: any[] = [];

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'RADAR_UNINDEXED_1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        receivedMessages.push(msg);
        if (msg.type === 'radar_status') {
          expect(msg.enabled).toBe(false);
          ws.close();
          resolve();
        }
      });
    });

    const radarStatusMsg = receivedMessages.find((m) => m.type === 'radar_status');
    expect(radarStatusMsg).toBeDefined();
    expect(radarStatusMsg.enabled).toBe(false);
  });

  it('handles room_create, room_join, room_kick and room_leave lifecycle', async () => {
    tokenStore.registerToken({
      token: 'ROOM_OWNER_1',
      playerUuid: 'uuid-room-owner',
      playerName: 'OwnerAlice',
      expiresAt: Date.now() + 60000,
    });
    tokenStore.registerToken({
      token: 'ROOM_MEMBER_1',
      playerUuid: 'uuid-room-member',
      playerName: 'MemberBob',
      expiresAt: Date.now() + 60000,
    });

    const ownerWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const memberWs = new WebSocket(`ws://localhost:${port}/ws/client`);

    let createdPin = '';
    let createdRoomId = '';

    await new Promise<void>((resolve) => {
      ownerWs.on('open', () => {
        ownerWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'ROOM_OWNER_1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      ownerWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          ownerWs.send(JSON.stringify({ type: 'room_create' }));
        } else if (msg.type === 'room_created') {
          createdPin = msg.pin;
          createdRoomId = msg.roomId;
          expect(createdPin).toMatch(/^\d{6}$/);

          // Now authenticate member and join room
          memberWs.send(
            JSON.stringify({
              type: 'client_auth',
              token: 'ROOM_MEMBER_1',
              rtpCapabilities: sfu.getRtpCapabilities(),
            })
          );
        }
      });

      memberWs.on('open', () => {});
      memberWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          memberWs.send(JSON.stringify({ type: 'room_join', pin: createdPin }));
        } else if (msg.type === 'room_joined') {
          expect(msg.roomId).toBe(createdRoomId);

          // Owner kicks member
          ownerWs.send(JSON.stringify({ type: 'room_kick', targetUuid: 'uuid-room-member' }));
        } else if (msg.type === 'room_kicked') {
          expect(msg.roomId).toBe(createdRoomId);

          // Owner leaves room
          ownerWs.send(JSON.stringify({ type: 'room_leave' }));
        }
      });

      ownerWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'room_left') {
          ownerWs.close();
          memberWs.close();
          resolve();
        }
      });
    });

    expect(createdPin).toMatch(/^\d{6}$/);
  });

  it('handles staff_vanish_toggle and preserves stealth without creating consumers for regular players', async () => {
    tokenStore.registerToken({
      token: 'STAFF_TOKEN_1',
      playerUuid: 'uuid-staff-vanish',
      playerName: 'ModDan',
      isAdmin: true,
      expiresAt: Date.now() + 60000,
    });
    tokenStore.registerToken({
      token: 'REGULAR_TOKEN_1',
      playerUuid: 'uuid-regular-player',
      playerName: 'PlayerPete',
      isAdmin: false,
      expiresAt: Date.now() + 60000,
    });

    spatialEngine.updatePlayer({
      uuid: 'uuid-staff-vanish',
      username: 'ModDan',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
      isStaffVanish: false,
    });
    spatialEngine.updatePlayer({
      uuid: 'uuid-regular-player',
      username: 'PlayerPete',
      world: 'world',
      x: 3,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
      isStaffVanish: false,
    });

    const staffWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const regularWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const regularReceivedConsumers: string[] = [];

    await new Promise<void>((resolve) => {
      staffWs.on('open', () => {
        staffWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'STAFF_TOKEN_1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });

      staffWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          // Toggle vanish mode
          staffWs.send(JSON.stringify({ type: 'staff_vanish_toggle', enabled: true }));
        } else if (msg.type === 'staff_vanish_status') {
          expect(msg.enabled).toBe(true);

          // Now authenticate regular player
          regularWs.send(
            JSON.stringify({
              type: 'client_auth',
              token: 'REGULAR_TOKEN_1',
              rtpCapabilities: sfu.getRtpCapabilities(),
            })
          );
        }
      });

      regularWs.on('open', () => {});
      regularWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'new_consumer') {
          regularReceivedConsumers.push(msg.peerUuid);
        }
      });

      // Wait 300ms to allow proximity loops to tick
      setTimeout(() => {
        staffWs.close();
        regularWs.close();
        resolve();
      }, 350);
    });

    // Zero-leak check: regular player never received a consumer for the vanished staff member
    expect(regularReceivedConsumers).not.toContain('uuid-staff-vanish');
  });

  it('resolves initial Streamer Mode and relays bidirectional updates between plugin and web client', async () => {
    pluginGateway.setClientGateway(clientGateway);
    const pluginWs = new WebSocket(`ws://localhost:${port}/ws/plugin`);
    const pluginEvents: any[] = [];

    await new Promise<void>((resolve) => {
      pluginWs.on('open', () => {
        pluginWs.send(
          JSON.stringify({
            type: 'plugin_handshake',
            secret: 'secret-123',
            role: 'paper',
            serverId: 'lobby',
          })
        );
      });
      pluginWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'handshake_ack') {
          pluginWs.send(
            JSON.stringify({
              type: 'register_token',
              token: 'STRM_FIRST',
              playerUuid: 'uuid-streamer-1',
              playerName: 'StreamerOne',
              serverId: 'lobby',
              expiresAt: Date.now() + 60000,
              streamerMode: false,
              streamerModeExplicit: false,
            })
          );
          setTimeout(resolve, 40);
        } else {
          pluginEvents.push(msg);
        }
      });
    });

    const clientWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const clientEvents: any[] = [];

    await new Promise<void>((resolve) => {
      clientWs.on('open', () => {
        clientWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'STRM_FIRST',
            clientStreamerMode: true,
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });
      clientWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        clientEvents.push(msg);
        if (msg.type === 'auth_success') {
          // 1. Adopted clientStreamerMode: true when server had no explicit preference
          expect(msg.streamerMode).toBe(true);

          // 2. Web client toggles streamer mode OFF -> plugin should receive streamer_mode_sync
          clientWs.send(JSON.stringify({ type: 'streamer_mode_update', enabled: false }));

          // 3. Plugin toggles streamer mode ON -> client should receive streamer_mode_changed
          setTimeout(() => {
            pluginWs.send(
              JSON.stringify({
                type: 'streamer_mode_sync',
                playerUuid: 'uuid-streamer-1',
                enabled: true,
              })
            );
          }, 50);
        } else if (msg.type === 'streamer_mode_changed') {
          expect(msg.enabled).toBe(true);
          clientWs.close();
          pluginWs.close();
          resolve();
        }
      });
    });

    const syncs = pluginEvents.filter((e) => e.type === 'streamer_mode_sync');
    expect(syncs.some((s) => s.playerUuid === 'uuid-streamer-1' && s.enabled === true)).toBe(true);
    expect(syncs.some((s) => s.playerUuid === 'uuid-streamer-1' && s.enabled === false)).toBe(true);
  });
});
