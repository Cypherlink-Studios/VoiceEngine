import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import { config, ensureMediaDirs } from './config.js';
import { TokenStore } from './auth/TokenStore.js';
import { SpatialEngine } from './spatial/SpatialEngine.js';
import { MediasoupManager } from './sfu/MediasoupManager.js';
import { PluginGateway } from './gateway/PluginGateway.js';
import { ClientGateway } from './gateway/ClientGateway.js';
import { SettingsManager } from './config/SettingsManager.js';
import { AdminAuthManager } from './auth/AdminAuthManager.js';
import { createApiRouter } from './routes/api.js';
import { createMediaRouter } from './routes/media.js';
import { MediaCacheService } from './media/MediaCacheService.js';
import { AudioEmitterManager } from './media/AudioEmitterManager.js';
import { BinaryResolver } from './media/BinaryResolver.js';
import {
  getMetricsContentType,
  getMetricsSnapshot,
  updateDynamicMetrics,
} from './metrics/PrometheusMetrics.js';
import { DiscordNotifier } from './alerting/DiscordNotifier.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.text({ type: ['text/plain', 'application/json'] }));

const httpServer = createServer(app);

// Two distinct WebSocket servers mapped by path
const pluginWss = new WebSocketServer({ noServer: true });
const clientWss = new WebSocketServer({ noServer: true });

let isShuttingDown = false;

httpServer.on('upgrade', (request, socket, head) => {
  if (isShuttingDown) {
    socket.destroy();
    return;
  }

  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';

  if (pathname === '/ws/plugin') {
    pluginWss.handleUpgrade(request, socket, head, (ws) => {
      pluginWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/client') {
    clientWss.handleUpgrade(request, socket, head, (ws) => {
      clientWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Singletons
const tokenStore = new TokenStore(config.enableDevTokens);
const settingsManager = new SettingsManager();
const adminAuthManager = new AdminAuthManager();
const spatialEngine = new SpatialEngine(
  settingsManager.getSettings().voice.maxVoiceDistance,
  settingsManager.getSettings().voice.sneakVoiceDistance
);
const sfu = new MediasoupManager();
const mediaCacheService = new MediaCacheService();
const audioEmitterManager = new AudioEmitterManager();
let pluginGateway: PluginGateway;
let clientGateway: ClientGateway;

// Ensure media directories exist
ensureMediaDirs();

// Verify external media dependencies (yt-dlp, ffmpeg) across Windows & Linux
BinaryResolver.checkDependencies().then((deps) => {
  if (deps.allAvailable) {
    const ffVer = deps.ffmpeg.version ? deps.ffmpeg.version.split(' ')[2] || deps.ffmpeg.version : 'available';
    console.log(`[MediaCache] External tools ready: yt-dlp (${deps.ytDlp.version || 'available'}), ffmpeg (${ffVer})`);
  } else {
    if (!deps.ytDlp.found) {
      console.warn(`[MediaCache] Notice: yt-dlp not found. ${deps.ytDlp.error}`);
    }
    if (!deps.ffmpeg.found) {
      console.warn(`[MediaCache] Notice: ffmpeg not found. ${deps.ffmpeg.error}`);
    }
  }
}).catch((err) => {
  console.warn('[MediaCache] Could not verify media tools:', err);
});

// Prometheus Metrics Scraper Endpoint
app.get('/metrics', async (_req, res) => {
  try {
    updateDynamicMetrics(spatialEngine, sfu, clientGateway);
    res.set('Content-Type', getMetricsContentType());
    res.end(await getMetricsSnapshot());
  } catch (err) {
    res.status(500).send('Error collecting Prometheus metrics');
  }
});

// API Routes
app.use(
  '/api',
  createApiRouter(
    settingsManager,
    tokenStore,
    adminAuthManager,
    spatialEngine,
    () => clientGateway,
    () => pluginGateway,
    () => sfu
  )
);
app.use('/api/media', createMediaRouter(mediaCacheService));



// Pre-seed mock players so local testing works out of the box (disabled in production)
if (config.enableDevTokens) {
  spatialEngine.updateBatch([
    {
      uuid: '00000000-0000-0000-0000-000000000001',
      username: 'Steve',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 180,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    },
    {
      uuid: '00000000-0000-0000-0000-000000000002',
      username: 'Alex',
      world: 'world',
      x: 8,
      y: 64,
      z: 8,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    },
    {
      uuid: '00000000-0000-0000-0000-000000000003',
      username: 'Submariner',
      world: 'world',
      x: -6,
      y: 58,
      z: 6,
      yaw: 90,
      pitch: 0,
      isSneaking: false,
      isSubmerged: true,
    },
  ]);
  console.log('[VoiceServer] Development mode: Hardcoded dev join tokens and mock players enabled.');
} else {
  console.log('[VoiceServer] Production mode: Hardcoded dev join tokens and mock players disabled.');
}

// Status & Health Endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'voice-server',
    pluginConnected: pluginGateway ? pluginGateway.isPluginConnected() : false,
    connectedClients: clientGateway ? clientGateway.getConnectedClientsCount() : 0,
    trackedPlayers: spatialEngine.getAllPlayers().length,
    activeTokens: tokenStore.size(),
  });
});

// Optional Static hosting for web-client dist
const webClientDist = path.resolve(__dirname, '../../web-client/dist');
app.use(express.static(webClientDist));
app.get('*', (_req, res, next) => {
  res.sendFile(path.join(webClientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const discordNotifier = new DiscordNotifier();

export async function startServer(): Promise<void> {
  await sfu.init();
  if (process.env.DISCORD_WEBHOOK_URL) {
    discordNotifier.startEventLoopLagMonitor(3000, 30);
  }
  pluginGateway = new PluginGateway(
    pluginWss,
    config.secretKey,
    tokenStore,
    spatialEngine,
    audioEmitterManager,
    mediaCacheService
  );
  clientGateway = new ClientGateway(
    clientWss,
    tokenStore,
    spatialEngine,
    sfu,
    pluginGateway,
    settingsManager,
    audioEmitterManager
  );
  pluginGateway.setClientGateway(clientGateway);

  return new Promise((resolve) => {
    httpServer.listen(config.port, config.host, () => {
      console.log(`[VoiceServer] Running at http://${config.host}:${config.port}`);
      console.log(`[VoiceServer] Plugin endpoint: ws://${config.host}:${config.port}/ws/plugin`);
      console.log(`[VoiceServer] Client endpoint: ws://${config.host}:${config.port}/ws/client`);
      resolve();
    });
  });
}

export async function stopServer(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[VoiceServer] Stopping server components...');

  discordNotifier.stop();

  if (clientGateway) {
    clientGateway.shutdown();
  }
  if (pluginGateway) {
    pluginGateway.shutdown();
  }

  try {
    pluginWss.close();
  } catch {}
  try {
    clientWss.close();
  } catch {}

  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  sfu.close();
  console.log('[VoiceServer] Server stopped successfully.');
}

export async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[VoiceServer] Received ${signal}. Initiating graceful shutdown...`);

  // Hard timeout in case any socket, worker or handle hangs
  const forceExitTimer = setTimeout(() => {
    console.warn('[VoiceServer] Graceful shutdown timeout exceeded (3s), forcing exit.');
    process.exit(1);
  }, 3000);
  forceExitTimer.unref();

  try {
    await stopServer();
    process.exit(0);
  } catch (err) {
    console.error('[VoiceServer] Error during graceful shutdown:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  startServer().catch((err) => {
    console.error('[VoiceServer] Fatal bootstrap error:', err);
    process.exit(1);
  });
}

export {
  app,
  httpServer,
  tokenStore,
  spatialEngine,
  sfu,
  settingsManager,
  adminAuthManager,
  mediaCacheService,
  audioEmitterManager,
  clientGateway,
  pluginGateway,
  discordNotifier,
};

