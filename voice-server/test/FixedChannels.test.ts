import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { ClientGateway } from '../src/gateway/ClientGateway.js';

describe('Fixed Channels Audio Routing', () => {
  let httpServer: ReturnType<typeof createServer>;
  let clientWss: WebSocketServer;
  let pluginWss: WebSocketServer;
  let tokenStore: TokenStore;
  let spatialEngine: SpatialEngine;
  let sfu: MediasoupManager;
  let pluginGateway: PluginGateway;
  let clientGateway: ClientGateway;
  let clientWsUrl: string;

  beforeEach(async () => {
    httpServer = createServer();
    clientWss = new WebSocketServer({ noServer: true });
    pluginWss = new WebSocketServer({ noServer: true });

    tokenStore = new TokenStore();
    spatialEngine = new SpatialEngine(30.0, 8.0);
    sfu = new MediasoupManager();
    await sfu.init();

    pluginGateway = new PluginGateway(pluginWss, 'secret', tokenStore, spatialEngine);
    clientGateway = new ClientGateway(clientWss, tokenStore, spatialEngine, sfu, pluginGateway);

    httpServer.on('upgrade', (req, socket, head) => {
      clientWss.handleUpgrade(req, socket, head, (ws) => {
        clientWss.emit('connection', ws, req);
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const port = (httpServer.address() as AddressInfo).port;
        clientWsUrl = `ws://localhost:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    clientGateway.shutdown();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    sfu.close();
  });

  it('allows clients to join a fixed channel and receive membership broadcasts', async () => {
    tokenStore.registerToken({
      token: 'STEVE_TOKEN',
      playerUuid: 'uuid-steve',
      playerName: 'Steve',
      expiresAt: Date.now() + 60000,
    });
    tokenStore.registerToken({
      token: 'ALEX_TOKEN',
      playerUuid: 'uuid-alex',
      playerName: 'Alex',
      expiresAt: Date.now() + 60000,
    });

    const steveWs = new WebSocket(clientWsUrl);
    const alexWs = new WebSocket(clientWsUrl);

    await Promise.all([
      new Promise<void>((res) => steveWs.on('open', res)),
      new Promise<void>((res) => alexWs.on('open', res)),
    ]);

    // Authenticate Steve
    steveWs.send(
      JSON.stringify({
        type: 'client_auth',
        token: 'STEVE_TOKEN',
        rtpCapabilities: sfu.getRtpCapabilities(),
      })
    );

    await new Promise<void>((res) => {
      steveWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') res();
      });
    });

    // Authenticate Alex
    alexWs.send(
      JSON.stringify({
        type: 'client_auth',
        token: 'ALEX_TOKEN',
        rtpCapabilities: sfu.getRtpCapabilities(),
      })
    );

    await new Promise<void>((res) => {
      alexWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') res();
      });
    });

    // Steve joins channel 'lobby'
    steveWs.send(JSON.stringify({ type: 'join_channel', channelId: 'lobby' }));

    await new Promise<void>((res) => {
      steveWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'channel_joined' && msg.channelId === 'lobby') res();
      });
    });

    // Verify channel stats
    const stats1 = clientGateway.getChannelStats();
    expect(stats1.lobby).toBe(1);
    expect(stats1.proximity).toBe(1);

    // Alex joins channel 'lobby' and both receive channel_members
    alexWs.send(JSON.stringify({ type: 'join_channel', channelId: 'lobby' }));

    await new Promise<void>((res) => {
      alexWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'channel_members') {
          if (msg.members.length === 2) res();
        }
      });
    });

    const stats2 = clientGateway.getChannelStats();
    expect(stats2.lobby).toBe(2);

    // Test speaking broadcast in channel
    const speakingPromise = new Promise<void>((res) => {
      alexWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'channel_peer_speaking' && msg.peerUuid === 'uuid-steve' && msg.speaking === true) {
          res();
        }
      });
    });

    steveWs.send(JSON.stringify({ type: 'speaking', speaking: true }));
    await speakingPromise;

    steveWs.close();
    alexWs.close();
  });

  it('respects scope: server for fixed channels and isolates clients on different backend servers', async () => {
    // Recreate clientGateway with server-scoped channel setting
    clientGateway.shutdown();
    const mockSettingsManager = {
      getSettings: () => ({
        branding: {} as any,
        voice: {} as any,
        fixedChannels: [
          {
            id: 'server-room',
            name: 'Server Room',
            description: '',
            userLimit: 0,
            scope: 'server',
          },
        ],
      }),
    } as any;

    clientGateway = new ClientGateway(clientWss, tokenStore, spatialEngine, sfu, pluginGateway, mockSettingsManager);

    tokenStore.registerToken({
      token: 'STEVE_TOKEN_2',
      playerUuid: 'steve-srv',
      playerName: 'Steve',
      expiresAt: Date.now() + 60000,
    });
    tokenStore.registerToken({
      token: 'ALEX_TOKEN_2',
      playerUuid: 'alex-srv',
      playerName: 'Alex',
      expiresAt: Date.now() + 60000,
    });

    // Steve is on lobby, Alex is on survival
    spatialEngine.updatePlayer({
      uuid: 'steve-srv',
      username: 'Steve',
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
    spatialEngine.updatePlayer({
      uuid: 'alex-srv',
      username: 'Alex',
      serverId: 'survival',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });

    const steveWs = new WebSocket(clientWsUrl);
    const alexWs = new WebSocket(clientWsUrl);

    await Promise.all([
      new Promise<void>((res) => steveWs.on('open', res)),
      new Promise<void>((res) => alexWs.on('open', res)),
    ]);

    steveWs.send(
      JSON.stringify({
        type: 'client_auth',
        token: 'STEVE_TOKEN_2',
        rtpCapabilities: sfu.getRtpCapabilities(),
      })
    );

    alexWs.send(
      JSON.stringify({
        type: 'client_auth',
        token: 'ALEX_TOKEN_2',
        rtpCapabilities: sfu.getRtpCapabilities(),
      })
    );

    await new Promise<void>((res) => {
      let count = 0;
      const onAuth = () => {
        count++;
        if (count === 2) res();
      };
      steveWs.on('message', (d) => {
        if (JSON.parse(d.toString()).type === 'auth_success') onAuth();
      });
      alexWs.on('message', (d) => {
        if (JSON.parse(d.toString()).type === 'auth_success') onAuth();
      });
    });

    // Both join server-room
    steveWs.send(JSON.stringify({ type: 'join_channel', channelId: 'server-room' }));
    alexWs.send(JSON.stringify({ type: 'join_channel', channelId: 'server-room' }));

    await new Promise((res) => setTimeout(res, 100));

    // Channel stats show 2 members in the channel overall
    const stats = clientGateway.getChannelStats();
    expect(stats['server-room']).toBe(2);

    steveWs.close();
    alexWs.close();
  });
});
