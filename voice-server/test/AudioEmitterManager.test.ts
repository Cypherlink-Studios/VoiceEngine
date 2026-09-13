import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { AddressInfo } from 'net';
import { createServer } from 'http';

import { AudioEmitterManager } from '../src/media/AudioEmitterManager.js';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { ClientGateway } from '../src/gateway/ClientGateway.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';

describe('AudioEmitterManager & WebSocket Protocol (Time Sync & IPC)', () => {
  let emitterManager: AudioEmitterManager;
  let pluginWss: WebSocketServer;
  let clientWss: WebSocketServer;
  let server: ReturnType<typeof createServer>;
  let pluginGateway: PluginGateway;
  let clientGateway: ClientGateway;
  let tokenStore: TokenStore;
  let spatialEngine: SpatialEngine;
  let sfu: MediasoupManager;
  let port: number;

  beforeEach(async () => {
    emitterManager = new AudioEmitterManager();
    tokenStore = new TokenStore(true);
    spatialEngine = new SpatialEngine(30.0, 8.0);
    sfu = new MediasoupManager();
    await sfu.init();

    pluginWss = new WebSocketServer({ noServer: true });
    clientWss = new WebSocketServer({ noServer: true });

    server = createServer();
    server.on('upgrade', (req, socket, head) => {
      const pathname = req.url ? new URL(req.url, `http://${req.headers.host}`).pathname : '';
      if (pathname === '/ws/plugin') {
        pluginWss.handleUpgrade(req, socket, head, (ws) => pluginWss.emit('connection', ws, req));
      } else if (pathname === '/ws/client') {
        clientWss.handleUpgrade(req, socket, head, (ws) => clientWss.emit('connection', ws, req));
      } else {
        socket.destroy();
      }
    });

    pluginGateway = new PluginGateway(pluginWss, 'test-secret', tokenStore, spatialEngine, emitterManager);
    clientGateway = new ClientGateway(clientWss, tokenStore, spatialEngine, sfu, pluginGateway, undefined, emitterManager);
    pluginGateway.setClientGateway(clientGateway);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    clientGateway.shutdown();
    await sfu.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('manages emitter lifecycle: create, pause, resume, volume, stop', async () => {
    let lastEvent = '';
    emitterManager.onEvent((event) => {
      lastEvent = event;
    });

    // Create 3D spatial emitter
    const emitter = emitterManager.createEmitter({
      id: 'tavern_bgm',
      source: 'tavern.mp3',
      position: { x: 10, y: 64, z: 20 },
      radius: 35,
      loop: true,
      volume: 0.8,
    });

    expect(emitter.id).toBe('tavern_bgm');
    expect(emitter.state).toBe('PLAYING');
    expect(emitter.spatial).toBe(true);
    expect(emitter.volume).toBe(0.8);
    expect(lastEvent).toBe('start');
    expect(emitterManager.getActiveEmitters().length).toBe(1);

    // Pause emitter
    const paused = emitterManager.pauseEmitter('tavern_bgm');
    expect(paused?.state).toBe('PAUSED');
    expect(lastEvent).toBe('pause');

    // Resume emitter
    const resumed = emitterManager.resumeEmitter('tavern_bgm');
    expect(resumed?.state).toBe('PLAYING');
    expect(lastEvent).toBe('resume');

    // Adjust volume
    const vol = emitterManager.setVolume('tavern_bgm', 0.5);
    expect(vol?.volume).toBe(0.5);
    expect(lastEvent).toBe('volume');

    // Stop emitter
    const stopped = emitterManager.stopEmitter('tavern_bgm');
    expect(stopped).toBe(true);
    expect(lastEvent).toBe('stop');
    expect(emitterManager.getActiveEmitters().length).toBe(0);
  });

  it('handles WebSocket time_sync requests from web client', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/client`);

    await new Promise<void>((resolve) => ws.on('open', resolve));

    const clientT0 = Date.now();
    ws.send(JSON.stringify({ type: 'time_sync', clientTime: clientT0 }));

    const response: any = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'time_sync_response') {
          resolve(msg);
        }
      });
    });

    expect(response.type).toBe('time_sync_response');
    expect(response.clientTime).toBe(clientT0);
    expect(typeof response.serverTime).toBe('number');
    expect(response.serverTime).toBeGreaterThanOrEqual(clientT0);

    ws.close();
  });

  it('handles plugin IPC audio commands and broadcasts audio events to clients', async () => {
    // 1. Connect a web client and authenticate
    const clientWs = new WebSocket(`ws://localhost:${port}/ws/client`);
    await new Promise<void>((resolve) => clientWs.on('open', resolve));

    clientWs.send(
      JSON.stringify({
        type: 'client_auth',
        token: 'STEVE1', // dev token
        deviceId: 'device-123',
      })
    );

    await new Promise<void>((resolve) => {
      clientWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_success') {
          resolve();
        }
      });
    });

    // 2. Connect a Paper plugin socket
    const pluginWs = new WebSocket(`ws://localhost:${port}/ws/plugin`);
    await new Promise<void>((resolve) => pluginWs.on('open', resolve));

    pluginWs.send(
      JSON.stringify({
        type: 'plugin_handshake',
        secret: 'test-secret',
        role: 'paper',
        serverId: 'survival',
      })
    );

    await new Promise<void>((resolve) => {
      pluginWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'handshake_ack' && msg.success) {
          resolve();
        }
      });
    });


    // 3. Set up client to listen for audio_event
    const clientReceivedAudioEventPromise: Promise<any> = new Promise((resolve) => {
      clientWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'audio_event') {
          resolve(msg);
        }
      });
    });

    // 4. Send audio_command play from plugin
    pluginWs.send(
      JSON.stringify({
        type: 'audio_command',
        action: 'play',
        id: 'spawn_song',
        source: 'theme.mp3',
        spatial: false, // broadcast
        volume: 0.9,
      })
    );

    const event = await clientReceivedAudioEventPromise;
    expect(event.type).toBe('audio_event');
    expect(event.event).toBe('start');
    expect(event.emitter.id).toBe('spawn_song');
    expect(event.emitter.volume).toBe(0.9);

    clientWs.close();
    pluginWs.close();
  });
});
