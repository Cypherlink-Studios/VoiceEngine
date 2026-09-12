import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { TokenStore } from '../auth/TokenStore.js';
import { SpatialEngine } from '../spatial/SpatialEngine.js';

interface SocketMeta {
  role: 'paper' | 'velocity';
  serverId: string;
}

export class PluginGateway {
  private wss: WebSocketServer;
  private secretKey: string;
  private tokenStore: TokenStore;
  private spatialEngine: SpatialEngine;
  private velocitySocket?: WebSocket;
  private paperSockets = new Map<string, WebSocket>();
  private socketMeta = new Map<WebSocket, SocketMeta>();

  constructor(
    wss: WebSocketServer,
    secretKey: string,
    tokenStore: TokenStore,
    spatialEngine: SpatialEngine
  ) {
    this.wss = wss;
    this.secretKey = secretKey;
    this.tokenStore = tokenStore;
    this.spatialEngine = spatialEngine;

    this.init();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      let authenticated = false;

      // Extract optional headers
      const rawRole = (req.headers['x-role'] as string) || '';
      const initialRole: 'paper' | 'velocity' = rawRole.toLowerCase() === 'velocity' ? 'velocity' : 'paper';
      const initialServerId = (req.headers['x-server-id'] as string) || 'default';

      // Check Authorization header: Bearer <secret>
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token === this.secretKey) {
          authenticated = true;
          this.registerSocket(ws, initialRole, initialServerId);
          console.log(`[PluginGateway] ${initialRole} plugin authenticated via header (server: ${initialServerId}).`);
        }
      }

      ws.on('message', (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString());

          // Allow handshake frame if header wasn't present or to declare role/serverId
          if (message.type === 'plugin_handshake') {
            if (authenticated || message.secret === this.secretKey) {
              authenticated = true;
              const role: 'paper' | 'velocity' = message.role === 'velocity' ? 'velocity' : 'paper';
              const serverId = message.serverId || initialServerId;
              this.registerSocket(ws, role, serverId);
              console.log(`[PluginGateway] ${role} plugin registered via handshake frame (server: ${serverId}).`);
              ws.send(JSON.stringify({ type: 'handshake_ack', success: true, role, serverId }));
              return;
            } else {
              ws.close(4001, 'Unauthorized: Invalid secret key');
              return;
            }
          }

          if (!authenticated) {
            ws.close(4001, 'Unauthorized: Handshake required');
            return;
          }

          const meta = this.socketMeta.get(ws);

          if (message.type === 'register_token') {
            this.tokenStore.registerToken({
              token: message.token,
              playerUuid: message.playerUuid,
              playerName: message.playerName,
              expiresAt: message.expiresAt,
              isAdmin: Boolean(message.isAdmin),
            });
          } else if (message.type === 'telemetry_batch' && Array.isArray(message.players)) {
            const batchServerId = message.serverId || meta?.serverId || 'default';
            const enrichedPlayers = message.players.map((p: any) => ({
              ...p,
              serverId: p.serverId || batchServerId,
            }));
            this.spatialEngine.updateBatch(enrichedPlayers);
          }
        } catch (err) {
          console.error('[PluginGateway] Failed to handle message:', err);
        }
      });

      ws.on('close', () => {
        this.unregisterSocket(ws);
      });
    });
  }

  private registerSocket(ws: WebSocket, role: 'paper' | 'velocity', serverId: string): void {
    this.socketMeta.set(ws, { role, serverId });

    if (role === 'velocity') {
      if (this.velocitySocket && this.velocitySocket !== ws) {
        this.velocitySocket.close(1000, 'Replaced by new Velocity instance');
      }
      this.velocitySocket = ws;
    } else {
      const existing = this.paperSockets.get(serverId);
      if (existing && existing !== ws) {
        existing.close(1000, `Replaced by new Paper instance for server ${serverId}`);
      }
      this.paperSockets.set(serverId, ws);
    }
  }

  private unregisterSocket(ws: WebSocket): void {
    const meta = this.socketMeta.get(ws);
    if (meta) {
      if (meta.role === 'velocity' && this.velocitySocket === ws) {
        this.velocitySocket = undefined;
        console.log('[PluginGateway] Velocity proxy disconnected.');
      } else if (meta.role === 'paper') {
        if (this.paperSockets.get(meta.serverId) === ws) {
          this.paperSockets.delete(meta.serverId);
          console.log(`[PluginGateway] Paper plugin for server "${meta.serverId}" disconnected.`);
        }
      }
      this.socketMeta.delete(ws);
    }
  }

  public notifySpeechStatus(playerUuid: string, speaking: boolean): void {
    const payload = JSON.stringify({
      type: 'speech_status',
      uuid: playerUuid,
      speaking,
    });

    const player = this.spatialEngine.getPlayer(playerUuid);
    const targetServerId = player?.serverId;

    // Direct routing to specific server if known
    if (targetServerId && this.paperSockets.has(targetServerId)) {
      const socket = this.paperSockets.get(targetServerId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
        return;
      }
    }

    // Fallback broadcast to all connected Paper servers
    for (const socket of this.paperSockets.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  public isPluginConnected(): boolean {
    const hasPaper = Array.from(this.paperSockets.values()).some((ws) => ws.readyState === WebSocket.OPEN);
    const hasVelocity = !!this.velocitySocket && this.velocitySocket.readyState === WebSocket.OPEN;
    return hasPaper || hasVelocity;
  }

  public isVelocityConnected(): boolean {
    return !!this.velocitySocket && this.velocitySocket.readyState === WebSocket.OPEN;
  }

  public getConnectedServers(): string[] {
    return Array.from(this.paperSockets.keys());
  }
}
