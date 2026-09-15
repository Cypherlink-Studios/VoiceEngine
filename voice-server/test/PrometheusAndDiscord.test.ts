import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { createApiRouter } from '../src/routes/api.js';
import { SettingsManager } from '../src/config/SettingsManager.js';
import { TokenStore } from '../src/auth/TokenStore.js';
import { AdminAuthManager } from '../src/auth/AdminAuthManager.js';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';
import { DiscordNotifier } from '../src/alerting/DiscordNotifier.js';
import { updateDynamicMetrics, getMetricsContentType, getMetricsSnapshot } from '../src/metrics/PrometheusMetrics.js';

describe('Prometheus Observability & Discord Health Alerts', () => {
  let app: express.Express;
  let server: Server;
  let port: number;
  let sfu: MediasoupManager;
  let settingsManager: SettingsManager;
  let tokenStore: TokenStore;
  let adminAuthManager: AdminAuthManager;
  let spatialEngine: SpatialEngine;
  let adminSessionToken: string;

  beforeEach(async () => {
    sfu = new MediasoupManager();
    await sfu.init(2);

    settingsManager = new SettingsManager();
    tokenStore = new TokenStore();
    adminAuthManager = new AdminAuthManager();
    spatialEngine = new SpatialEngine(30.0, 8.0, 0.08, 2.0);

    // Register admin token and authenticate session
    tokenStore.registerToken({
      token: 'ADMIN_PROMETHEUS',
      playerUuid: 'admin-uuid',
      playerName: 'AdminUser',
      isAdmin: true,
      expiresAt: Date.now() + 60000,
    });
    const session = adminAuthManager.authenticate('ADMIN_PROMETHEUS', tokenStore)!;
    adminSessionToken = session.sessionToken;

    app = express();
    app.use(express.json());

    // Root Prometheus endpoint
    app.get('/metrics', async (_req, res) => {
      updateDynamicMetrics(spatialEngine, sfu);
      res.set('Content-Type', getMetricsContentType());
      res.end(await getMetricsSnapshot());
    });

    // Mounted API router
    app.use(
      '/api',
      createApiRouter(
        settingsManager,
        tokenStore,
        adminAuthManager,
        spatialEngine,
        () => undefined,
        () => undefined,
        () => sfu
      )
    );

    await new Promise<void>((resolve) => {
      server = createServer(app);
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        port = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (sfu && !sfu.isClosed()) {
      sfu.close();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('exposes valid Prometheus text format metrics at GET /metrics and GET /api/metrics', async () => {
    // 1. Root /metrics
    const rootRes = await fetch(`http://localhost:${port}/metrics`);
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get('content-type')).toContain('text/plain');

    const rootBody = await rootRes.text();
    expect(rootBody).toContain('voiceengine_');
    expect(rootBody).toContain('voiceengine_sfu_workers_total 2');
    expect(rootBody).toContain('voiceengine_sfu_transports_total');
    expect(rootBody).toContain('voiceengine_spatial_deadband_suppression_ratio');

    // 2. /api/metrics
    const apiRes = await fetch(`http://localhost:${port}/api/metrics`);
    expect(apiRes.status).toBe(200);
    const apiBody = await apiRes.text();
    expect(apiBody).toContain('voiceengine_sfu_workers_total 2');
  });

  it('returns extended multi-worker, spatial hash, and deadband metrics in /api/admin/metrics', async () => {
    // Populate some players and evaluate deadband
    spatialEngine.updatePlayer({
      uuid: 'player-1',
      username: 'P1',
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
      uuid: 'player-2',
      username: 'P2',
      world: 'world',
      x: 5,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    });

    // Evaluate once (dispatches) and once more (suppressed)
    spatialEngine.getAudiblePeersFor('player-1', true, 1000);
    spatialEngine.getAudiblePeersFor('player-1', true, 1100);

    const res = await fetch(`http://localhost:${port}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify multi-worker stats
    expect(json.workers).toHaveLength(2);
    expect(json.workers[0].workerIndex).toBe(0);
    expect(json.workers[1].workerIndex).toBe(1);

    // Verify spatial hash active cells
    expect(json.spatialHashCells).toBeGreaterThan(0);
    expect(json.spatialPartitions).toBe(1);

    // Verify deadband suppression ratio
    expect(json.deadband).toBeDefined();
    expect(json.deadband.totalEvaluated).toBe(2);
    expect(json.deadband.suppressed).toBe(1);
    expect(json.deadband.ratio).toBe(0.5);
  });

  it('dispatches Discord webhook alerts with rate-limiting cooldown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const notifier = new DiscordNotifier('https://discord.com/api/webhooks/test-hook', 5000);

    // 1. First event loop lag alert -> should dispatch
    const sent1 = await notifier.notifyEventLoopLag(42.5, 30);
    expect(sent1).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callArgs = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callArgs.username).toBe('VoiceEngine Health Watchdog');
    expect(callArgs.embeds[0].title).toContain('High Event Loop Delay Alert');
    expect(callArgs.embeds[0].fields[0].value).toContain('42.50 ms');

    // 2. Second alert immediately after -> should be rate-limited by cooldown
    const sent2 = await notifier.notifyEventLoopLag(55.0, 30);
    expect(sent2).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 3. Different alert key (worker CPU) -> should dispatch because key is different
    const sent3 = await notifier.notifyWorkerHighCpu(0, 12345, 92.4, 85);
    expect(sent3).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const cpuArgs = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(cpuArgs.embeds[0].title).toContain('Mediasoup SFU Worker High CPU');
    expect(cpuArgs.embeds[0].fields[2].value).toContain('92.4%');

    vi.unstubAllGlobals();
  });
});
