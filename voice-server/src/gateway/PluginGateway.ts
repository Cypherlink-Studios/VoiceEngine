import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { TokenStore } from '../auth/TokenStore.js';
import { SpatialEngine } from '../spatial/SpatialEngine.js';
import type { ClientGateway } from './ClientGateway.js';
import { AudioEmitterManager } from '../media/AudioEmitterManager.js';
import { MediaCacheService } from '../media/MediaCacheService.js';

interface SocketMeta {
  role: 'paper' | 'velocity';
  serverId: string;
}

export class PluginGateway {
  private wss: WebSocketServer;
  private secretKey: string;
  private tokenStore: TokenStore;
  private spatialEngine: SpatialEngine;
  private clientGateway?: ClientGateway;
  private audioEmitterManager?: AudioEmitterManager;
  private mediaCacheService?: MediaCacheService;
  private velocitySocket?: WebSocket;
  private paperSockets = new Map<string, WebSocket>();
  private socketMeta = new Map<WebSocket, SocketMeta>();

  constructor(
    wss: WebSocketServer,
    secretKey: string,
    tokenStore: TokenStore,
    spatialEngine: SpatialEngine,
    audioEmitterManager?: AudioEmitterManager,
    mediaCacheService?: MediaCacheService
  ) {
    this.wss = wss;
    this.secretKey = secretKey;
    this.tokenStore = tokenStore;
    this.spatialEngine = spatialEngine;
    this.audioEmitterManager = audioEmitterManager;
    this.mediaCacheService = mediaCacheService;

    this.init();
  }

  public setClientGateway(clientGateway: ClientGateway): void {
    this.clientGateway = clientGateway;
  }

  public setAudioEmitterManager(manager: AudioEmitterManager): void {
    this.audioEmitterManager = manager;
  }

  public setMediaCacheService(service: MediaCacheService): void {
    this.mediaCacheService = service;
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

      ws.on('message', async (data: Buffer | string) => {
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
              clientIp: message.clientIp,
              isMuted: Boolean(message.isMuted),
            });
          } else if (message.type === 'player_quit') {
            if (message.playerUuid && this.clientGateway) {
              this.clientGateway.disconnectPlayer(message.playerUuid);
            }
          } else if (message.type === 'moderation_action') {
            if (this.clientGateway) {
              this.clientGateway.handleModerationAction(message);
            }
          } else if (message.type === 'active_punishments_sync') {
            if (this.clientGateway && Array.isArray(message.punishments)) {
              this.clientGateway.syncActivePunishments(message.punishments);
            }
          } else if (message.type === 'telemetry_batch' && Array.isArray(message.players)) {
            const batchServerId = message.serverId || meta?.serverId || 'default';
            const enrichedPlayers = message.players.map((p: any) => ({
              ...p,
              serverId: p.serverId || batchServerId,
            }));
            const enrichedSpeakers = Array.isArray(message.speakers)
              ? message.speakers.map((s: any) => ({
                  ...s,
                  serverId: s.serverId || batchServerId,
                }))
              : undefined;
            this.spatialEngine.updateBatch(enrichedPlayers, enrichedSpeakers);
          } else if (message.type === 'audio_command') {
            await this.handleAudioCommand(ws, message);
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

  private async handleAudioCommand(ws: WebSocket, message: any): Promise<void> {
    if (!this.audioEmitterManager) {
      this.sendAudioResponse(ws, message.action, false, 'AudioEmitterManager not initialized');
      return;
    }

    try {
      switch (message.action) {
        case 'play':
        case 'broadcast':
        case 'sfx': {
          let mediaUrl: string | undefined = undefined;
          const source = (message.source || '').trim();

          // If source is a remote URL and mediaCacheService is present, attempt background download/cache
          const isRemote = /^(https?:\/\/)/i.test(source);
          if (isRemote && this.mediaCacheService) {
            try {
              const cached = await this.mediaCacheService.getOrDownload(source);
              mediaUrl = `/api/media/cache/${cached.fileName}`;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(`[PluginGateway] Cache extraction failed for ${source}: ${msg}. Falling back to proxy route.`);
              mediaUrl = `/api/media/proxy?url=${encodeURIComponent(source)}`;
            }
          }

          const emitter = this.audioEmitterManager.createEmitter({
            id: message.id,
            source,
            mediaUrl,
            spatial: message.action === 'broadcast' ? false : (message.spatial ?? Boolean(message.position)),
            world: message.world,
            position: message.position,
            radius: message.radius,
            duration: message.duration,
            loop: message.action === 'sfx' ? false : (message.loop ?? false),
            volume: message.volume,
            speakerBlockId: message.speakerBlockId,
          });

          this.sendAudioResponse(ws, message.action, true, `Playing ${emitter.id}`, { emitter });
          break;
        }

        case 'pause': {
          const paused = this.audioEmitterManager.pauseEmitter(message.id);
          this.sendAudioResponse(
            ws,
            'pause',
            Boolean(paused),
            paused ? `Paused ${message.id}` : `Emitter ${message.id} not found or not playing`
          );
          break;
        }

        case 'resume': {
          const resumed = this.audioEmitterManager.resumeEmitter(message.id);
          this.sendAudioResponse(
            ws,
            'resume',
            Boolean(resumed),
            resumed ? `Resumed ${message.id}` : `Emitter ${message.id} not found or not paused`
          );
          break;
        }

        case 'stop': {
          if (message.id === 'all') {
            const stoppedCount = this.audioEmitterManager.stopAll();
            this.sendAudioResponse(ws, 'stop', true, `Stopped ${stoppedCount} emitters`);
          } else {
            const stopped = this.audioEmitterManager.stopEmitter(message.id);
            this.sendAudioResponse(
              ws,
              'stop',
              stopped,
              stopped ? `Stopped ${message.id}` : `Emitter ${message.id} not found`
            );
          }
          break;
        }

        case 'volume': {
          const updated = this.audioEmitterManager.setVolume(message.id, message.volume);
          this.sendAudioResponse(
            ws,
            'volume',
            Boolean(updated),
            updated ? `Volume for ${message.id} set to ${updated.volume}` : `Emitter ${message.id} not found`
          );
          break;
        }

        case 'cache_purge': {
          if (!this.mediaCacheService) {
            this.sendAudioResponse(ws, 'cache_purge', false, 'MediaCacheService not initialized');
            return;
          }
          const purgeAll = message.duration === 'all' || Boolean(message.purgeAll);
          const result = this.mediaCacheService.purgeCache({ purgeAll });
          this.sendAudioResponse(
            ws,
            'cache_purge',
            true,
            `Purged ${result.deletedFiles} files (${result.reclaimedBytes} bytes reclaimed)`,
            { result }
          );
          break;
        }

        case 'cache_status': {
          if (!this.mediaCacheService) {
            this.sendAudioResponse(ws, 'cache_status', false, 'MediaCacheService not initialized');
            return;
          }
          const status = this.mediaCacheService.getCacheStatus();
          this.sendAudioResponse(ws, 'cache_status', true, 'Cache status', { status });
          break;
        }

        default:
          this.sendAudioResponse(ws, message.action, false, `Unknown action: ${message.action}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PluginGateway] Error handling audio command:', msg);
      this.sendAudioResponse(ws, message.action, false, msg);
    }
  }

  private sendAudioResponse(
    ws: WebSocket,
    action: string,
    success: boolean,
    message: string,
    extra: Record<string, any> = {}
  ): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'audio_command_response',
          action,
          success,
          message,
          ...extra,
        })
      );
    }
  }
}

