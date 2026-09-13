import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { TokenStore } from './auth/TokenStore.js';
import { SpatialEngine } from './spatial/SpatialEngine.js';
import { MediasoupManager } from './sfu/MediasoupManager.js';
import { PluginGateway } from './gateway/PluginGateway.js';
import { ClientGateway } from './gateway/ClientGateway.js';
import { SettingsManager } from './config/SettingsManager.js';
import { AdminAuthManager } from './auth/AdminAuthManager.js';
import { createApiRouter } from './routes/api.js';

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

httpServer.on('upgrade', (request, socket, head) => {
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
let pluginGateway: PluginGateway;
let clientGateway: ClientGateway;

// API Routes
app.use(
  '/api',
  createApiRouter(
    settingsManager,
    tokenStore,
    adminAuthManager,
    spatialEngine,
    () => clientGateway,
    () => pluginGateway
  )
);

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

export async function startServer(): Promise<void> {
  await sfu.init();
  pluginGateway = new PluginGateway(pluginWss, config.secretKey, tokenStore, spatialEngine);
  clientGateway = new ClientGateway(clientWss, tokenStore, spatialEngine, sfu, pluginGateway, settingsManager);

  return new Promise((resolve) => {
    httpServer.listen(config.port, config.host, () => {
      console.log(`[VoiceServer] Running at http://${config.host}:${config.port}`);
      console.log(`[VoiceServer] Plugin endpoint: ws://${config.host}:${config.port}/ws/plugin`);
      console.log(`[VoiceServer] Client endpoint: ws://${config.host}:${config.port}/ws/client`);
      resolve();
    });
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[VoiceServer] Fatal bootstrap error:', err);
    process.exit(1);
  });
}

export { app, httpServer, tokenStore, spatialEngine, sfu, settingsManager, adminAuthManager };
