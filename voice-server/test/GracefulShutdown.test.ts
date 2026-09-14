import { describe, it, expect, vi } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientGateway } from '../src/gateway/ClientGateway.js';
import { PluginGateway } from '../src/gateway/PluginGateway.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';
import { SettingsManager } from '../src/config/SettingsManager.js';

describe('Graceful Shutdown & Lifecycle Management', () => {
  it('ClientGateway.shutdown() cleanly clears proximity loop and terminates client sessions with 1001', () => {
    const mockWss = new WebSocketServer({ noServer: true });
    const tokenStore = new TokenStore(false);
    const spatialEngine = new SpatialEngine(30, 8);
    const settingsManager = new SettingsManager();
    const mockSfu = {
      createWebRtcTransport: vi.fn(),
      createConsumer: vi.fn(),
      getRtpCapabilities: vi.fn(),
      close: vi.fn(),
    } as unknown as MediasoupManager;

    const gateway = new ClientGateway(
      mockWss,
      tokenStore,
      spatialEngine,
      mockSfu,
      undefined as any,
      settingsManager
    );

    // Verify proximity loop is active
    expect((gateway as any).loopInterval).toBeDefined();

    // Mock an active client session
    let socketClosed = false;
    let closeCode = 0;
    let closeReason = '';
    const mockWs = {
      readyState: WebSocket.OPEN,
      close: vi.fn((code: number, reason: string) => {
        socketClosed = true;
        closeCode = code;
        closeReason = reason;
      }),
      send: vi.fn(),
    } as unknown as WebSocket;

    (gateway as any).sessions.set('test-session', {
      sessionId: 'test-session',
      playerUuid: 'test-uuid',
      username: 'TestPlayer',
      ws: mockWs,
      consumers: new Map(),
    });
    (gateway as any).playerSessions.set('test-uuid', (gateway as any).sessions.get('test-session'));

    // Execute shutdown
    gateway.shutdown();

    // Verify loop was cleared
    expect((gateway as any).loopInterval).toBeUndefined();
    // Verify client socket was instructed to close with code 1001 (Going Away / Shutting down)
    expect(socketClosed).toBe(true);
    expect(closeCode).toBe(1001);
    expect(closeReason).toBe('Server shutting down');
    // Verify maps were cleared
    expect((gateway as any).sessions.size).toBe(0);
    expect((gateway as any).playerSessions.size).toBe(0);
  });

  it('PluginGateway.shutdown() closes paper and velocity sockets with 1001 and clears tracking', () => {
    const mockWss = new WebSocketServer({ noServer: true });
    const tokenStore = new TokenStore(false);
    const spatialEngine = new SpatialEngine(30, 8);

    const pluginGateway = new PluginGateway(mockWss, 'secret', tokenStore, spatialEngine);

    let paperCloseCode = 0;
    const mockPaperWs = {
      readyState: WebSocket.OPEN,
      close: vi.fn((code: number) => {
        paperCloseCode = code;
      }),
      send: vi.fn(),
    } as unknown as WebSocket;

    let velocityCloseCode = 0;
    const mockVelocityWs = {
      readyState: WebSocket.OPEN,
      close: vi.fn((code: number) => {
        velocityCloseCode = code;
      }),
      send: vi.fn(),
    } as unknown as WebSocket;

    (pluginGateway as any).paperSockets.set('server-1', mockPaperWs);
    (pluginGateway as any).velocitySocket = mockVelocityWs;

    pluginGateway.shutdown();

    expect(paperCloseCode).toBe(1001);
    expect(velocityCloseCode).toBe(1001);
    expect((pluginGateway as any).paperSockets.size).toBe(0);
    expect((pluginGateway as any).velocitySocket).toBeUndefined();
  });

  it('MediasoupManager.close() is safe and idempotent', () => {
    const sfu = new MediasoupManager();
    expect(sfu.isClosed()).toBe(true);

    // Multiple closes should not throw
    expect(() => sfu.close()).not.toThrow();
    expect(() => sfu.close()).not.toThrow();
    expect(sfu.isClosed()).toBe(true);
  });
});
