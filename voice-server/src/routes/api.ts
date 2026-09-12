import { Router, Request, Response } from 'express';
import { SettingsManager } from '../config/SettingsManager.js';
import { TokenStore } from '../auth/TokenStore.js';
import { AdminAuthManager } from '../auth/AdminAuthManager.js';
import { SpatialEngine } from '../spatial/SpatialEngine.js';
import { ClientGateway } from '../gateway/ClientGateway.js';
import { PluginGateway } from '../gateway/PluginGateway.js';

export function createApiRouter(
  settingsManager: SettingsManager,
  tokenStore: TokenStore,
  adminAuthManager: AdminAuthManager,
  spatialEngine: SpatialEngine,
  getClientGateway: () => ClientGateway | undefined,
  getPluginGateway: () => PluginGateway | undefined
): Router {
  const router = Router();

  // Public Configuration Endpoint
  router.get('/config/public', (_req: Request, res: Response) => {
    res.json(settingsManager.getPublicConfig());
  });

  // Admin Authentication Endpoint (redeems in-game /voice admin token)
  router.post('/admin/auth', (req: Request, res: Response) => {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, message: 'Administrative token is required.' });
      return;
    }

    const session = adminAuthManager.authenticate(token.trim(), tokenStore);
    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Invalid, expired, or non-admin token. Run /voice admin in-game.',
      });
      return;
    }

    res.json({
      success: true,
      sessionToken: session.sessionToken,
      username: session.username,
      playerUuid: session.playerUuid,
      expiresAt: session.expiresAt,
    });
  });

  // Protected Admin Routes
  const requireAdmin = adminAuthManager.middleware();

  router.get('/admin/settings', requireAdmin, (_req: Request, res: Response) => {
    res.json({
      success: true,
      settings: settingsManager.getSettings(),
    });
  });

  router.put('/admin/settings', requireAdmin, async (req: Request, res: Response) => {
    try {
      const updated = await settingsManager.updateSettings(req.body);
      
      // Update spatial engine distances immediately if voice settings changed
      spatialEngine.updateDistances(
        updated.voice.maxVoiceDistance,
        updated.voice.sneakVoiceDistance
      );

      res.json({
        success: true,
        settings: updated,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update settings';
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/admin/metrics', requireAdmin, (_req: Request, res: Response) => {
    const clientGateway = getClientGateway();
    const pluginGateway = getPluginGateway();

    res.json({
      success: true,
      connectedClients: clientGateway ? clientGateway.getConnectedClientsCount() : 0,
      channels: clientGateway ? clientGateway.getChannelStats() : { proximity: 0 },
      sessions: clientGateway ? clientGateway.getSessionsSummary() : [],
      pluginConnected: pluginGateway ? pluginGateway.isPluginConnected() : false,
      trackedPlayers: spatialEngine.getAllPlayers().length,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  return router;
}
