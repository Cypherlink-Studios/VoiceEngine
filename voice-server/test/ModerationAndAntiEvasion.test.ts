import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { ClientGateway } from '../src/gateway/ClientGateway.js';

describe('Moderation and Anti-Ban Evasion', () => {
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
    pluginWss = new WebSocketServer({ noServer: true });
    clientWss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      const pathname = req.url || '';
      if (pathname.includes('/ws/plugin')) {
        pluginWss.handleUpgrade(req, socket, head, (ws) => pluginWss.emit('connection', ws, req));
      } else {
        clientWss.handleUpgrade(req, socket, head, (ws) => clientWss.emit('connection', ws, req));
      }
    });

    tokenStore = new TokenStore(false); // No hardcoded dev tokens
    spatialEngine = new SpatialEngine();
    sfu = new MediasoupManager();
    await sfu.init();

    pluginGateway = new PluginGateway(pluginWss, 'secret-key', tokenStore, spatialEngine);
    clientGateway = new ClientGateway(clientWss, tokenStore, spatialEngine, sfu, pluginGateway);
    pluginGateway.setClientGateway(clientGateway);

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
    clientWss.close();
    pluginWss.close();
    await sfu.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects connection with code 4003 on token IP mismatch (Task 4.1)', async () => {
    tokenStore.registerToken({
      token: 'BOUND_IP_TOKEN',
      playerUuid: 'player-bound',
      playerName: 'BoundPlayer',
      clientIp: '198.51.100.25', // Non-loopback bound IP
      expiresAt: Date.now() + 60000,
    });

    // Connecting from loopback (127.0.0.1) should fail against a remote bound IP when tested
    // To explicitly test mismatch, we test tokenStore.isIpAllowed directly:
    const record = tokenStore.validateAndRedeem('BOUND_IP_TOKEN')!;
    expect(record).toBeDefined();
    expect(tokenStore.isIpAllowed(record, '203.0.113.50')).toBe(false);
    expect(tokenStore.isIpAllowed(record, '198.51.100.25')).toBe(true);

    // Also verify WebSocket rejection
    tokenStore.registerToken({
      token: 'MISMATCH_TOKEN',
      playerUuid: 'player-mismatch',
      playerName: 'MismatchPlayer',
      clientIp: '203.0.113.99',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`, {
      headers: {
        'x-forwarded-for': '198.51.100.1', // Different IP!
      },
    });

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'client_auth', token: 'MISMATCH_TOKEN' }));
      });
      ws.on('close', (code, reason) => {
        expect(code).toBe(4003);
        expect(reason.toString()).toContain('IP_MISMATCH');
        resolve();
      });
    });
  });

  it('rejects connection from banned device ID with code 4003 (Task 4.3)', async () => {
    // Ban a specific device ID
    await clientGateway.handleModerationAction({
      targetUuid: 'banned-uuid',
      action: 'ban',
      active: true,
      reason: 'Hardware ban',
      deviceId: 'hw-device-xyz-123',
    });

    tokenStore.registerToken({
      token: 'CLEAN_TOKEN',
      playerUuid: 'alt-account-uuid',
      playerName: 'AltAccount',
      expiresAt: Date.now() + 60000,
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'CLEAN_TOKEN',
            deviceId: 'hw-device-xyz-123',
          })
        );
      });
      ws.on('close', (code, reason) => {
        expect(code).toBe(4003);
        expect(reason.toString()).toContain('Device banned');
        resolve();
      });
    });
  });

  it('immediately kicks client session on player_quit from plugin gateway (Task 4.2)', async () => {
    tokenStore.registerToken({
      token: 'QUIT_TOKEN',
      playerUuid: 'player-quitter',
      playerName: 'Quitter',
      expiresAt: Date.now() + 60000,
    });

    const clientWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    await new Promise<void>((resolve) => {
      clientWs.on('open', () => {
        clientWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'QUIT_TOKEN',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });
      clientWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          resolve();
        }
      });
    });

    expect(clientGateway.getConnectedClientsCount()).toBe(1);

    // Simulate player quit from Minecraft plugin via plugin gateway
    const pluginWs = new WebSocket(`ws://localhost:${port}/ws/plugin`);
    await new Promise<void>((resolve) => {
      pluginWs.on('open', () => {
        pluginWs.send(JSON.stringify({ type: 'plugin_handshake', secret: 'secret-key' }));
      });
      pluginWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'handshake_ack') {
          pluginWs.send(JSON.stringify({ type: 'player_quit', playerUuid: 'player-quitter' }));
        }
      });
      clientWs.on('close', () => {
        resolve();
      });
    });

    expect(clientGateway.getConnectedClientsCount()).toBe(0);
    pluginWs.close();
  });

  it('enforces mute, deafen, and kick moderation actions in real time (Task 5.2)', async () => {
    tokenStore.registerToken({
      token: 'MOD_TOKEN_1',
      playerUuid: 'target-player',
      playerName: 'TargetPlayer',
      expiresAt: Date.now() + 60000,
    });

    const clientWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    const receivedNotices: any[] = [];

    await new Promise<void>((resolve) => {
      clientWs.on('open', () => {
        clientWs.send(
          JSON.stringify({
            type: 'client_auth',
            token: 'MOD_TOKEN_1',
            rtpCapabilities: sfu.getRtpCapabilities(),
          })
        );
      });
      clientWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          resolve();
        } else if (msg.type === 'moderation_notice') {
          receivedNotices.push(msg);
        }
      });
    });

    // 1. Mute
    await clientGateway.handleModerationAction({
      targetUuid: 'target-player',
      action: 'mute',
      active: true,
      reason: 'Mic spam',
    });
    expect(clientGateway.isPlayerMuted('target-player')).toBe(true);

    // 2. Deafen
    await clientGateway.handleModerationAction({
      targetUuid: 'target-player',
      action: 'deafen',
      active: true,
      reason: 'Event deafen',
    });
    expect(clientGateway.isPlayerDeafened('target-player')).toBe(true);

    // Wait for client to receive moderation_notice frames
    await new Promise((r) => setTimeout(r, 50));
    expect(receivedNotices.some((n) => n.action === 'mute' && n.active === true)).toBe(true);
    expect(receivedNotices.some((n) => n.action === 'deafen' && n.active === true)).toBe(true);

    // 3. Kick
    const kickPromise = new Promise<void>((resolve) => {
      clientWs.on('close', (code, reason) => {
        expect(code).toBe(4003);
        expect(reason.toString()).toContain('Kicked');
        resolve();
      });
    });

    await clientGateway.handleModerationAction({
      targetUuid: 'target-player',
      action: 'kick',
      active: true,
      reason: 'Rule violation',
    });

    await kickPromise;
    expect(clientGateway.getConnectedClientsCount()).toBe(0);
  });
});
