import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { createApiRouter } from '../src/routes/api.js';
import { SettingsManager } from '../src/config/SettingsManager.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { AdminAuthManager } from '../src/auth/AdminAuthManager.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';

describe('API Routes & Admin Auth', () => {
  let tempDir: string;
  let settingsPath: string;
  let settingsManager: SettingsManager;
  let tokenStore: TokenStore;
  let adminAuthManager: AdminAuthManager;
  let spatialEngine: SpatialEngine;
  let app: express.Express;
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 've-api-test-'));
    settingsPath = path.join(tempDir, 'settings.json');
    settingsManager = new SettingsManager(settingsPath);
    tokenStore = new TokenStore();
    adminAuthManager = new AdminAuthManager();
    spatialEngine = new SpatialEngine(30.0, 8.0);

    app = express();
    app.use(express.json());
    app.use(express.text({ type: ['text/plain', 'application/json'] }));

    const mockClientGateway = {
      getConnectedClientsCount: () => 2,
      getChannelStats: () => ({ proximity: 1, lobby: 1 }),
      getSessionsSummary: () => [
        { sessionId: 's1', playerUuid: 'u1', username: 'Steve', activeChannel: 'proximity', isSpeaking: false },
        { sessionId: 's2', playerUuid: 'u2', username: 'Alex', activeChannel: 'lobby', isSpeaking: true },
      ],
      disconnectSession: (sessionId: string) => sessionId === 's1',
      disconnectPlayer: (playerUuid: string) => playerUuid === 'u1',
    } as any;

    const mockPluginGateway = {
      isPluginConnected: () => true,
    } as any;

    app.use(
      '/api',
      createApiRouter(
        settingsManager,
        tokenStore,
        adminAuthManager,
        spatialEngine,
        () => mockClientGateway,
        () => mockPluginGateway
      )
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('GET /api/config/public returns public branding, slots, and channels', async () => {
    const res = await fetch(`${baseUrl}/api/config/public`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.branding).toBeDefined();
    expect(data.branding.serverName).toBe('VoiceEngine Server');
    expect(data.maxSlots).toBe(100);
    expect(Array.isArray(data.fixedChannels)).toBe(true);
  });

  it('POST /api/admin/auth rejects invalid or regular non-admin tokens', async () => {
    // 1. Invalid token
    const res1 = await fetch(`${baseUrl}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'NON_EXISTENT' }),
    });
    expect(res1.status).toBe(401);

    // 2. Regular token (isAdmin = false)
    tokenStore.registerToken({
      token: 'REGULAR1',
      playerUuid: 'uuid-reg',
      playerName: 'Steve',
      expiresAt: Date.now() + 60000,
      isAdmin: false,
    });

    const res2 = await fetch(`${baseUrl}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'REGULAR1' }),
    });
    expect(res2.status).toBe(401);
  });

  it('POST /api/admin/auth redeems admin token and allows protected endpoint access', async () => {
    tokenStore.registerToken({
      token: 'ADMIN99',
      playerUuid: 'uuid-admin',
      playerName: 'AdminAlex',
      expiresAt: Date.now() + 60000,
      isAdmin: true,
    });

    const authRes = await fetch(`${baseUrl}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ADMIN99' }),
    });

    expect(authRes.status).toBe(200);
    const authData = await authRes.json();
    expect(authData.success).toBe(true);
    expect(authData.username).toBe('AdminAlex');
    expect(authData.sessionToken).toBeDefined();

    const sessionToken = authData.sessionToken;

    // Token cannot be redeemed a second time
    const replayRes = await fetch(`${baseUrl}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ADMIN99' }),
    });
    expect(replayRes.status).toBe(401);

    // Access protected GET /api/admin/settings
    const settingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(settingsRes.status).toBe(200);
    const settingsData = await settingsRes.json();
    expect(settingsData.settings.branding.serverName).toBe('VoiceEngine Server');

    // Access protected PUT /api/admin/settings
    const updateRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        branding: { serverName: 'ImperioCraft' },
        voice: { maxVoiceDistance: 45.0, sneakVoiceDistance: 10.0 },
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.settings.branding.serverName).toBe('ImperioCraft');
    expect(updateData.settings.voice.maxVoiceDistance).toBe(45.0);

    // Access protected GET /api/admin/metrics
    const metricsRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(metricsRes.status).toBe(200);
    const metricsData = await metricsRes.json();
    expect(metricsData.connectedClients).toBe(2);
    expect(metricsData.channels.lobby).toBe(1);
    expect(metricsData.pluginConnected).toBe(true);
  });

  it('POST /api/admin/auth permits repeated redemption for built-in dev admin token ADMIN1', async () => {
    // 1. First redemption of ADMIN1
    const res1 = await fetch(`${baseUrl}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ADMIN1' }),
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    expect(data1.username).toBe('ServerAdmin');

    // 2. Second redemption of ADMIN1 (allowed because it is a dev token)
    const res2 = await fetch(`${baseUrl}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ADMIN1' }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    expect(data2.username).toBe('ServerAdmin');

    // 3. Regular dev token STEVE1 without admin rights is rejected
    const resSteve = await fetch(`${baseUrl}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'STEVE1' }),
    });
    expect(resSteve.status).toBe(401);
  });

  it('POST /api/session/disconnect handles JSON and beacon text bodies', async () => {
    // 1. Disconnect by sessionId (JSON)
    const res1 = await fetch(`${baseUrl}/api/session/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1' }),
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    expect(data1.disconnected).toBe(true);

    // 2. Disconnect by playerUuid (text/plain like sendBeacon)
    const res2 = await fetch(`${baseUrl}/api/session/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ playerUuid: 'u1' }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    expect(data2.disconnected).toBe(true);

    // 3. Unknown session returns disconnected false
    const res3 = await fetch(`${baseUrl}/api/session/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'unknown' }),
    });
    expect(res3.status).toBe(200);
    const data3 = await res3.json();
    expect(data3.success).toBe(true);
    expect(data3.disconnected).toBe(false);
  });
});
