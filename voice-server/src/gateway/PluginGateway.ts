import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { TokenStore } from '../auth/TokenStore.js';
import { SpatialEngine } from '../spatial/SpatialEngine.js';

export class PluginGateway {
  private wss: WebSocketServer;
  private secretKey: string;
  private tokenStore: TokenStore;
  private spatialEngine: SpatialEngine;
  private activePluginSocket?: WebSocket;

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

      // Check Authorization header: Bearer <secret>
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token === this.secretKey) {
          authenticated = true;
          this.activePluginSocket = ws;
          console.log('[PluginGateway] Paper plugin authenticated via header.');
        }
      }

      ws.on('message', (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString());

          // Allow handshake frame if header wasn't present
          if (!authenticated) {
            if (message.type === 'plugin_handshake' && message.secret === this.secretKey) {
              authenticated = true;
              this.activePluginSocket = ws;
              console.log('[PluginGateway] Paper plugin authenticated via handshake frame.');
              ws.send(JSON.stringify({ type: 'handshake_ack', success: true }));
              return;
            } else {
              ws.close(4001, 'Unauthorized: Invalid secret key');
              return;
            }
          }

          if (message.type === 'register_token') {
            this.tokenStore.registerToken({
              token: message.token,
              playerUuid: message.playerUuid,
              playerName: message.playerName,
              expiresAt: message.expiresAt,
              isAdmin: Boolean(message.isAdmin),
            });
          } else if (message.type === 'telemetry_batch' && Array.isArray(message.players)) {
            this.spatialEngine.updateBatch(message.players);
          }
        } catch (err) {
          console.error('[PluginGateway] Failed to handle message:', err);
        }
      });

      ws.on('close', () => {
        if (this.activePluginSocket === ws) {
          this.activePluginSocket = undefined;
          console.log('[PluginGateway] Paper plugin disconnected.');
        }
      });
    });
  }

  public notifySpeechStatus(playerUuid: string, speaking: boolean): void {
    if (this.activePluginSocket && this.activePluginSocket.readyState === WebSocket.OPEN) {
      this.activePluginSocket.send(
        JSON.stringify({
          type: 'speech_status',
          uuid: playerUuid,
          speaking,
        })
      );
    }
  }

  public isPluginConnected(): boolean {
    return !!this.activePluginSocket && this.activePluginSocket.readyState === WebSocket.OPEN;
  }
}
