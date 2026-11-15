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
              serverId: message.serverId || meta?.serverId || 'default',
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
            if (message.spectatorMode === 'all' || message.spectatorMode === 'listen-only' || message.spectatorMode === 'isolated') {
              this.spatialEngine.setSpectatorMode(message.spectatorMode);
            }
            const batchServerId = message.serverId || meta?.serverId || 'default';
            if (typeof message.radarEnabled === 'boolean') {
              this.spatialEngine.setServerRadarEnabled(batchServerId, message.radarEnabled);
            }
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
          } else if (message.type === 'staff_vanish_sync') {
            if (this.clientGateway && message.playerUuid) {
              const enabled = Boolean(message.enabled);
              this.clientGateway.setStaffVanish(message.playerUuid, enabled);
              ws.send(
                JSON.stringify({
                  type: 'staff_vanish_sync_ack',
                  playerUuid: message.playerUuid,
                  enabled,
                })
              );
            }
          } else if (message.type === 'room_command') {
            await this.handleRoomCommand(ws, message);
          } else if (message.type === 'query_room_players') {
            this.handleQueryRoomPlayers(ws, message);
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

  private async handleRoomCommand(ws: WebSocket, msg: any): Promise<void> {
    if (!this.clientGateway) {
      ws.send(
        JSON.stringify({
          type: 'room_command_response',
          requestId: msg.requestId,
          success: false,
          action: msg.action,
          error: 'gateway_not_ready',
          message: 'ClientGateway not ready',
        })
      );
      return;
    }

    const roomManager = this.clientGateway.getRoomManager();
    const action = msg.action;

    switch (action) {
      case 'create': {
        const { room, pin } = roomManager.createRoom(
          msg.playerUuid,
          msg.username,
          typeof msg.maxMembers === 'number' ? msg.maxMembers : roomManager.getDefaultMaxMembers()
        );
        const session = (this.clientGateway as any).playerSessions?.get(msg.playerUuid);
        if (session) {
          await this.clientGateway.switchChannel(session, room.id);
        }
        this.clientGateway.broadcastRoomMembers(room.id);
        ws.send(
          JSON.stringify({
            type: 'room_command_response',
            requestId: msg.requestId,
            success: true,
            action: 'create',
            pin,
            roomId: room.id,
          })
        );
        break;
      }

      case 'join': {
        const res = roomManager.joinRoom(msg.pin, msg.playerUuid, msg.username);
        if (!res.success || !res.room) {
          ws.send(
            JSON.stringify({
              type: 'room_command_response',
              requestId: msg.requestId,
              success: false,
              action: 'join',
              error: res.error,
              message: res.message,
              retryAfterSeconds: res.retryAfterSeconds,
            })
          );
          return;
        }
        const session = (this.clientGateway as any).playerSessions?.get(msg.playerUuid);
        if (session) {
          await this.clientGateway.switchChannel(session, res.room.id);
        }
        this.clientGateway.broadcastRoomMembers(res.room.id);
        ws.send(
          JSON.stringify({
            type: 'room_command_response',
            requestId: msg.requestId,
            success: true,
            action: 'join',
            pin: res.room.pin,
            roomId: res.room.id,
          })
        );
        break;
      }

      case 'leave': {
        const prevRoom = roomManager.getRoomByPlayerUuid(msg.playerUuid);
        const prevRoomId = prevRoom?.id;
        roomManager.leaveRoom(msg.playerUuid);
        const session = (this.clientGateway as any).playerSessions?.get(msg.playerUuid);
        if (session) {
          session.isRoomSpy = false;
          await this.clientGateway.switchChannel(session, 'proximity');
        }
        if (prevRoomId) {
          this.clientGateway.broadcastRoomMembers(prevRoomId);
        }
        ws.send(
          JSON.stringify({
            type: 'room_command_response',
            requestId: msg.requestId,
            success: true,
            action: 'leave',
          })
        );
        break;
      }

      case 'kick': {
        let targetUuid = msg.targetUuid;
        if (!targetUuid && msg.targetUsername) {
          const room = roomManager.getRoomByPlayerUuid(msg.ownerUuid);
          if (room) {
            for (const m of room.members.values()) {
              if (m.username.toLowerCase() === msg.targetUsername.toLowerCase()) {
                targetUuid = m.playerUuid;
                break;
              }
            }
          }
        }
        const kickRes = roomManager.kickMember(msg.ownerUuid, targetUuid);
        if (!kickRes.success || !kickRes.room) {
          ws.send(
            JSON.stringify({
              type: 'room_command_response',
              requestId: msg.requestId,
              success: false,
              action: 'kick',
              error: kickRes.error,
              message: kickRes.message,
            })
          );
          return;
        }
        const targetSession = (this.clientGateway as any).playerSessions?.get(targetUuid);
        if (targetSession) {
          await this.clientGateway.switchChannel(targetSession, 'proximity');
          targetSession.ws.send(
            JSON.stringify({
              type: 'room_kicked',
              roomId: kickRes.room.id,
              reason: 'Kicked by room owner',
            })
          );
        }
        this.clientGateway.broadcastRoomMembers(kickRes.room.id);
        ws.send(
          JSON.stringify({
            type: 'room_command_response',
            requestId: msg.requestId,
            success: true,
            action: 'kick',
            kickedPlayer: kickRes.kickedMember?.username,
            roomId: kickRes.room.id,
          })
        );
        break;
      }

      case 'spy': {
        const spyRes = roomManager.spyRoom(msg.staffUuid, msg.staffUsername, msg.targetPlayer);
        if (!spyRes.success || !spyRes.room) {
          ws.send(
            JSON.stringify({
              type: 'room_command_response',
              requestId: msg.requestId,
              success: false,
              action: 'spy',
              error: spyRes.error,
              message: spyRes.message,
            })
          );
          return;
        }
        const staffSession = (this.clientGateway as any).playerSessions?.get(msg.staffUuid);
        if (staffSession) {
          staffSession.isRoomSpy = true;
          await this.clientGateway.switchChannel(staffSession, spyRes.room.id);
        }
        ws.send(
          JSON.stringify({
            type: 'room_command_response',
            requestId: msg.requestId,
            success: true,
            action: 'spy',
            targetPlayer: msg.targetPlayer,
            roomId: spyRes.room.id,
          })
        );
        break;
      }

      default:
        ws.send(
          JSON.stringify({
            type: 'room_command_response',
            requestId: msg.requestId,
            success: false,
            error: 'unknown_action',
          })
        );
    }
  }

  private handleQueryRoomPlayers(ws: WebSocket, msg: any): void {
    if (!this.clientGateway) {
      ws.send(JSON.stringify({ type: 'room_players_response', requestId: msg.requestId, players: [] }));
      return;
    }
    const roomManager = this.clientGateway.getRoomManager();
    const players: string[] = [];
    for (const room of (roomManager as any).roomsById.values()) {
      for (const m of (room.members as Map<string, any>).values()) {
        if (!m.isSpy) {
          players.push(m.username);
        }
      }
    }
    ws.send(
      JSON.stringify({
        type: 'room_players_response',
        requestId: msg.requestId,
        players,
      })
    );
  }

  public shutdown(): void {
    for (const ws of this.paperSockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1001, 'Server shutting down');
        } catch {}
      }
    }
    this.paperSockets.clear();
    if (this.velocitySocket) {
      if (this.velocitySocket.readyState === WebSocket.OPEN) {
        try {
          this.velocitySocket.close(1001, 'Server shutting down');
        } catch {}
      }
      this.velocitySocket = undefined;
    }
    this.socketMeta.clear();
  }
}

