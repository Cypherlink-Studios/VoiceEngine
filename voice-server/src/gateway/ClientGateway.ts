import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { TokenStore } from '../auth/TokenStore.js';
import { SpatialEngine } from '../spatial/SpatialEngine.js';
import { MediasoupManager } from '../sfu/MediasoupManager.js';
import { PluginGateway } from './PluginGateway.js';
import { ClientSession, ModerationActionPayload } from '../types.js';
import { SettingsManager } from '../config/SettingsManager.js';
import { AudioEmitterManager } from '../media/AudioEmitterManager.js';
import { config } from '../config.js';
import * as mediasoup from 'mediasoup';

export class ClientGateway {
  private wss: WebSocketServer;
  private tokenStore: TokenStore;
  private spatialEngine: SpatialEngine;
  private sfu: MediasoupManager;
  private pluginGateway: PluginGateway;
  private settingsManager?: SettingsManager;
  private audioEmitterManager?: AudioEmitterManager;

  private sessions = new Map<string, ClientSession>(); // sessionId -> ClientSession
  private playerSessions = new Map<string, ClientSession>(); // playerUuid -> ClientSession
  private loopInterval?: NodeJS.Timeout;
  private connectionHandler?: (ws: WebSocket, req?: IncomingMessage) => void;

  private bannedUuids = new Map<string, { reason?: string; expiresAt?: number }>();
  private bannedIps = new Map<string, { reason?: string; expiresAt?: number }>();
  private bannedDevices = new Map<string, { reason?: string; expiresAt?: number }>();
  private mutedUuids = new Map<string, { reason?: string; expiresAt?: number }>();
  private deafenedUuids = new Map<string, { reason?: string; expiresAt?: number }>();

  constructor(
    wss: WebSocketServer,
    tokenStore: TokenStore,
    spatialEngine: SpatialEngine,
    sfu: MediasoupManager,
    pluginGateway: PluginGateway,
    settingsManager?: SettingsManager,
    audioEmitterManager?: AudioEmitterManager
  ) {
    this.wss = wss;
    this.tokenStore = tokenStore;
    this.spatialEngine = spatialEngine;
    this.sfu = sfu;
    this.pluginGateway = pluginGateway;
    this.settingsManager = settingsManager;
    this.audioEmitterManager = audioEmitterManager;

    if (this.audioEmitterManager) {
      this.audioEmitterManager.onEvent((event, emitter) => {
        this.broadcastAudioEvent(event, emitter);
      });
    }

    this.init();
    this.startProximityLoop();
  }


  private init(): void {
    this.connectionHandler = (ws: WebSocket, req?: IncomingMessage) => {
      let session: ClientSession | null = null;
      let clientRtpCapabilities: mediasoup.types.RtpCapabilities | null = null;

      const rawIp = (req?.headers?.['x-forwarded-for'] as string) || req?.socket?.remoteAddress || '';
      const clientIp = rawIp.split(',')[0].trim();

      ws.on('message', async (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString());

          switch (msg.type) {
            case 'client_auth': {
              const deviceId = typeof msg.deviceId === 'string' ? msg.deviceId.trim() : undefined;
              if (deviceId && this.isDeviceBanned(deviceId)) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Device is banned from VoiceEngine' }));
                ws.close(4003, 'Device banned');
                return;
              }

              const tokenKey = (msg.token || '').toUpperCase().trim();
              const tokenRecord = this.tokenStore.validateAndRedeem(tokenKey);
              if (!tokenRecord) {
                if (config.enableDevTokens) {
                  console.warn(
                    `[ClientGateway] Rejected token: "${tokenKey}". Registered tokens: [${this.tokenStore.getTokens().join(', ')}]`
                  );
                } else {
                  console.warn(`[ClientGateway] Rejected invalid or expired token: "${tokenKey}"`);
                }
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid or expired token' }));
                ws.close(4002, 'Invalid token');
                return;
              }

              // IP binding check
              if (!this.tokenStore.isIpAllowed(tokenRecord, clientIp)) {
                console.warn(
                  `[ClientGateway] IP mismatch for player ${tokenRecord.playerName}. Bound IP: ${tokenRecord.clientIp}, Remote IP: ${clientIp}`
                );
                ws.send(JSON.stringify({ type: 'auth_error', message: 'IP_MISMATCH: Token bound to different IP address' }));
                ws.close(4003, 'IP_MISMATCH');
                return;
              }

              // Ban check for player UUID or IP
              if (this.isPlayerBanned(tokenRecord.playerUuid) || this.isIpBanned(clientIp)) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Banned from VoiceEngine' }));
                ws.close(4003, 'Banned');
                return;
              }

              clientRtpCapabilities = msg.rtpCapabilities;
              const sessionId = uuidv4();

              // Create Mediasoup Transports
              const sendTransport = await this.sfu.createWebRtcTransport();
              const recvTransport = await this.sfu.createWebRtcTransport();

              const isMuted = Boolean(tokenRecord.isMuted) || this.isPlayerMuted(tokenRecord.playerUuid);
              const isDeafened = this.isPlayerDeafened(tokenRecord.playerUuid);

              session = {
                sessionId,
                playerUuid: tokenRecord.playerUuid,
                username: tokenRecord.playerName,
                ws,
                sendTransport,
                recvTransport,
                consumers: new Map(),
                isSpeaking: false,
                activeChannel: 'proximity',
                clientIp,
                deviceId,
                isMuted,
                isDeafened,
              };

              const existingSession = this.playerSessions.get(session.playerUuid);
              if (existingSession && existingSession.sessionId !== sessionId) {
                console.log(`[ClientGateway] Cleaning up previous session for ${session.username} upon reconnect.`);
                this.cleanupSession(existingSession);
              }

              this.sessions.set(sessionId, session);
              this.playerSessions.set(session.playerUuid, session);

              console.log(`[ClientGateway] Player ${session.username} (${session.playerUuid}) connected.`);

              ws.send(
                JSON.stringify({
                  type: 'auth_success',
                  sessionId,
                  playerUuid: session.playerUuid,
                  username: session.username,
                  routerRtpCapabilities: this.sfu.getRtpCapabilities(),
                  sendTransportOptions: {
                    id: sendTransport.id,
                    iceParameters: sendTransport.iceParameters,
                    iceCandidates: sendTransport.iceCandidates,
                    dtlsParameters: sendTransport.dtlsParameters,
                  },
                  recvTransportOptions: {
                    id: recvTransport.id,
                    iceParameters: recvTransport.iceParameters,
                    iceCandidates: recvTransport.iceCandidates,
                    dtlsParameters: recvTransport.dtlsParameters,
                  },
                })
              );

              if (isMuted) {
                ws.send(
                  JSON.stringify({
                    type: 'moderation_notice',
                    action: 'mute',
                    active: true,
                    reason: 'Microphone muted by server moderation',
                  })
                );
              }
              if (isDeafened) {
                ws.send(
                  JSON.stringify({
                    type: 'moderation_notice',
                    action: 'deafen',
                    active: true,
                    reason: 'Audio output deafened by server moderation',
                  })
                );
              }

              if (this.audioEmitterManager) {
                ws.send(
                  JSON.stringify({
                    type: 'audio_state',
                    emitters: this.audioEmitterManager.getActiveEmitters(),
                  })
                );
              }
              break;
            }


            case 'connect_transport': {
              if (!session) return;
              const transport =
                msg.transportType === 'send' ? session.sendTransport : session.recvTransport;

              if (transport) {
                await transport.connect({ dtlsParameters: msg.dtlsParameters });
                ws.send(JSON.stringify({ type: 'transport_connected', transportType: msg.transportType }));
              }
              break;
            }

            case 'produce': {
              if (!session || !session.sendTransport) return;
              const producer = await session.sendTransport.produce({
                kind: 'audio',
                rtpParameters: msg.rtpParameters,
              });

              session.producer = producer;
              if (session.isMuted) {
                await producer.pause();
                ws.send(
                  JSON.stringify({
                    type: 'moderation_notice',
                    action: 'mute',
                    active: true,
                    reason: 'Microphone muted by server moderation',
                  })
                );
              }
              ws.send(JSON.stringify({ type: 'produced', producerId: producer.id }));
              break;
            }

            case 'pause_producer': {
              if (!session || !session.producer) return;
              await session.producer.pause();
              break;
            }

            case 'resume_producer': {
              if (!session || !session.producer) return;
              if (session.isMuted) {
                ws.send(
                  JSON.stringify({
                    type: 'moderation_notice',
                    action: 'mute',
                    active: true,
                    reason: 'Microphone muted by server moderation',
                  })
                );
                return;
              }
              await session.producer.resume();
              break;
            }

            case 'speaking': {
              if (!session) return;
              session.isSpeaking = !!msg.speaking;
              if (!session.activeChannel || session.activeChannel === 'proximity') {
                this.pluginGateway.notifySpeechStatus(session.playerUuid, session.isSpeaking);
              } else {
                this.broadcastChannelSpeaking(session);
              }
              break;
            }

            case 'join_channel': {
              if (!session) return;
              const targetChannel =
                typeof msg.channelId === 'string' && msg.channelId.trim()
                  ? msg.channelId.trim().toLowerCase()
                  : 'proximity';

              const prevChannel = session.activeChannel || 'proximity';
              if (prevChannel === targetChannel) {
                return;
              }

              // Close all current consumers
              for (const [peerUuid, consumer] of session.consumers.entries()) {
                try {
                  consumer.close();
                } catch {}
                session.ws.send(
                  JSON.stringify({
                    type: 'consumer_closed',
                    peerUuid,
                    consumerId: consumer.id,
                  })
                );
              }
              session.consumers.clear();

              // Also clean up consumers in other sessions that were listening to this player
              for (const otherSession of this.playerSessions.values()) {
                if (otherSession.playerUuid === session.playerUuid) continue;
                const consumer = otherSession.consumers.get(session.playerUuid);
                if (consumer) {
                  try {
                    consumer.close();
                  } catch {}
                  otherSession.consumers.delete(session.playerUuid);
                  if (otherSession.ws.readyState === WebSocket.OPEN) {
                    otherSession.ws.send(
                      JSON.stringify({
                        type: 'consumer_closed',
                        peerUuid: session.playerUuid,
                        consumerId: consumer.id,
                      })
                    );
                  }
                }
              }

              session.activeChannel = targetChannel;
              console.log(
                `[ClientGateway] Player ${session.username} switched from "${prevChannel}" to "${targetChannel}"`
              );

              session.ws.send(
                JSON.stringify({
                  type: 'channel_joined',
                  channelId: targetChannel,
                })
              );

              if (prevChannel !== 'proximity') {
                this.broadcastChannelMembers(prevChannel);
              }
              if (targetChannel !== 'proximity') {
                this.broadcastChannelMembers(targetChannel);
              }
              break;
            }

            case 'ping': {
              ws.send(
                JSON.stringify({
                  type: 'pong',
                  timestamp: msg.timestamp,
                })
              );
              break;
            }

            case 'time_sync': {
              ws.send(
                JSON.stringify({
                  type: 'time_sync_response',
                  clientTime: msg.clientTime,
                  serverTime: Date.now(),
                })
              );
              break;
            }


            case 'client_disconnect': {
              if (session) {
                this.cleanupSession(session);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.close(1000, 'Client disconnected');
                }
              }
              break;
            }
          }
        } catch (err) {
          console.error('[ClientGateway] Error handling client message:', err);
        }
      });

      ws.on('close', () => {
        if (session) {
          this.cleanupSession(session);
        }
      });
    };
    this.wss.on('connection', this.connectionHandler);
  }

  private startProximityLoop(): void {
    // Evaluates proximity and channel routing every 100ms (10 Hz)
    this.loopInterval = setInterval(async () => {
      for (const listenerSession of this.playerSessions.values()) {
        if (listenerSession.ws.readyState !== WebSocket.OPEN || !listenerSession.recvTransport) {
          continue;
        }

        const channel = listenerSession.activeChannel || 'proximity';

        if (channel === 'proximity') {
          // --- 1. Proximity 3D Audio Routing & Distance Pausing ---
          const audiblePeers = this.spatialEngine.getAudiblePeersFor(listenerSession.playerUuid);
          const activePeerUuids = new Set<string>();

          for (const peer of audiblePeers) {
            const speakerSession = this.playerSessions.get(peer.peerUuid);
            // Only route if speaker is also in proximity channel and producing audio
            if (
              !speakerSession ||
              !speakerSession.producer ||
              (speakerSession.activeChannel && speakerSession.activeChannel !== 'proximity')
            ) {
              continue;
            }

            activePeerUuids.add(peer.peerUuid);
            let consumer = listenerSession.consumers.get(peer.peerUuid);

            // If the consumer is referencing a stale producer from the speaker, clean it up
            if (consumer && (!consumer.closed && consumer.producerId !== speakerSession.producer.id)) {
              try {
                consumer.close();
              } catch {}
              listenerSession.consumers.delete(peer.peerUuid);
              consumer = undefined;
            }

            if (!consumer || consumer.closed) {
              try {
                consumer = await this.sfu.createConsumer(
                  listenerSession.recvTransport,
                  speakerSession.producer.id,
                  this.sfu.getRtpCapabilities()
                );

                if (listenerSession.isDeafened) {
                  await consumer.pause();
                }

                listenerSession.consumers.set(peer.peerUuid, consumer);

                listenerSession.ws.send(
                  JSON.stringify({
                    type: 'new_consumer',
                    peerUuid: peer.peerUuid,
                    peerUsername: peer.peerUsername,
                    consumerId: consumer.id,
                    producerId: speakerSession.producer.id,
                    rtpParameters: consumer.rtpParameters,
                    relX: peer.relX,
                    relY: peer.relY,
                    relZ: peer.relZ,
                    distance: peer.distance,
                    isSubmerged: peer.isSubmerged,
                    isChannel: false,
                    isBroadcast: peer.isBroadcast || false,
                  })
                );
              } catch (err) {
                console.error(`[ClientGateway] Failed to create proximity consumer for ${peer.peerUuid}:`, err);
              }
            } else {
              // If consumer was paused due to distance, resume RTP transmission if not deafened
              if (consumer.paused && !listenerSession.isDeafened) {
                try {
                  await consumer.resume();
                } catch (err) {
                  console.error(`[ClientGateway] Failed to resume consumer for ${peer.peerUuid}:`, err);
                }
              }

              listenerSession.ws.send(
                JSON.stringify({
                  type: 'peer_spatial_update',
                  peerUuid: peer.peerUuid,
                  peerUsername: peer.peerUsername,
                  relX: peer.relX,
                  relY: peer.relY,
                  relZ: peer.relZ,
                  distance: peer.distance,
                  isSubmerged: peer.isSubmerged,
                  isPaused: consumer.paused,
                  isBroadcast: peer.isBroadcast || false,
                })
              );
            }
          }

          // Distance pausing for inaudible proximity consumers
          // Instead of destroying consumers on distance threshold crossings, pause them.
          // This keeps WebRTC transceivers intact and drops RTP packets to 0 with zero SDP renegotiation.
          for (const [peerUuid, consumer] of listenerSession.consumers.entries()) {
            if (!activePeerUuids.has(peerUuid)) {
              const speakerSession = this.playerSessions.get(peerUuid);
              const stillInProximity =
                speakerSession && (!speakerSession.activeChannel || speakerSession.activeChannel === 'proximity');

              if (!stillInProximity) {
                // Speaker disconnected or left proximity channel -> Destroy consumer
                try {
                  consumer.close();
                } catch {}
                listenerSession.consumers.delete(peerUuid);

                listenerSession.ws.send(
                  JSON.stringify({
                    type: 'consumer_closed',
                    peerUuid,
                    consumerId: consumer.id,
                  })
                );
              } else {
                // Speaker is still in proximity mode, but out of audible range -> Pause consumer
                if (!consumer.paused) {
                  try {
                    await consumer.pause();
                  } catch (err) {
                    console.error(`[ClientGateway] Failed to pause consumer for ${peerUuid}:`, err);
                  }

                  listenerSession.ws.send(
                    JSON.stringify({
                      type: 'peer_spatial_update',
                      peerUuid,
                      peerUsername: speakerSession.username,
                      distance: 999,
                      relX: 0,
                      relY: 0,
                      relZ: -999,
                      isSubmerged: false,
                      isPaused: true,
                    })
                  );
                }
              }
            }
          }
        } else {
          // --- 2. Fixed Discord-Style Channel Audio Routing ---
          const fixedChannels = this.settingsManager?.getSettings().fixedChannels || [];
          const channelConfig = fixedChannels.find((c) => c.id === channel);
          const isServerScoped = channelConfig?.scope === 'server';
          const listenerPlayer = this.spatialEngine.getPlayer(listenerSession.playerUuid);
          const listenerServerId = listenerPlayer?.serverId || 'default';

          const channelPeers = Array.from(this.playerSessions.values()).filter((p) => {
            if (p.playerUuid === listenerSession.playerUuid) return false;
            if ((p.activeChannel || 'proximity') !== channel) return false;
            if (isServerScoped) {
              const speakerPlayer = this.spatialEngine.getPlayer(p.playerUuid);
              const speakerServerId = speakerPlayer?.serverId || 'default';
              if (speakerServerId !== listenerServerId) {
                return false;
              }
            }
            return true;
          });
          const channelPeerUuids = new Set(channelPeers.map((p) => p.playerUuid));

          for (const speakerSession of channelPeers) {
            if (!speakerSession.producer) {
              continue;
            }

            let consumer = listenerSession.consumers.get(speakerSession.playerUuid);
            if (!consumer || consumer.closed) {
              try {
                consumer = await this.sfu.createConsumer(
                  listenerSession.recvTransport,
                  speakerSession.producer.id,
                  this.sfu.getRtpCapabilities()
                );

                if (listenerSession.isDeafened) {
                  await consumer.pause();
                }

                listenerSession.consumers.set(speakerSession.playerUuid, consumer);

                listenerSession.ws.send(
                  JSON.stringify({
                    type: 'new_consumer',
                    peerUuid: speakerSession.playerUuid,
                    peerUsername: speakerSession.username,
                    consumerId: consumer.id,
                    producerId: speakerSession.producer.id,
                    rtpParameters: consumer.rtpParameters,
                    isChannel: true,
                    channelId: channel,
                  })
                );
              } catch (err) {
                console.error(`[ClientGateway] Failed to create channel consumer for ${speakerSession.playerUuid}:`, err);
              }
            } else if (consumer.paused && !listenerSession.isDeafened) {
              try {
                await consumer.resume();
              } catch {}
            }
          }

          // Cull consumers who left the channel
          for (const [peerUuid, consumer] of listenerSession.consumers.entries()) {
            if (!channelPeerUuids.has(peerUuid)) {
              try {
                consumer.close();
              } catch {}
              listenerSession.consumers.delete(peerUuid);

              listenerSession.ws.send(
                JSON.stringify({
                  type: 'consumer_closed',
                  peerUuid,
                  consumerId: consumer.id,
                })
              );
            }
          }
        }

        // --- 3. Spatial Audio Emitter Routing ---
        if (this.audioEmitterManager && listenerSession.ws.readyState === WebSocket.OPEN) {
          const listener = this.spatialEngine.getPlayer(listenerSession.playerUuid);
          const activeEmitters = this.audioEmitterManager.getActiveEmitters();
          for (const emitter of activeEmitters) {
            if (!emitter.spatial || !emitter.position) {
              continue;
            }

            if (!listener) {
              continue;
            }

            const emitterWorld = emitter.world || 'world';
            if (listener.world !== emitterWorld) {
              listenerSession.ws.send(
                JSON.stringify({
                  type: 'emitter_spatial_update',
                  id: emitter.id,
                  inRange: false,
                  distance: 9999,
                  relX: 0,
                  relY: 0,
                  relZ: -9999,
                })
              );
              continue;
            }

            const dx = emitter.position.x - listener.x;
            const dy = emitter.position.y - listener.y;
            const dz = emitter.position.z - listener.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const inRange = distance <= emitter.radius;

            const rad = (listener.yaw * Math.PI) / 180.0;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const localX = dx * cos - dz * sin;
            const localZ = dx * sin + dz * cos;
            const localY = dy;

            listenerSession.ws.send(
              JSON.stringify({
                type: 'emitter_spatial_update',
                id: emitter.id,
                inRange,
                distance: Math.round(distance * 100) / 100,
                relX: Math.round(localX * 100) / 100,
                relY: Math.round(localY * 100) / 100,
                relZ: Math.round(localZ * 100) / 100,
              })
            );
          }
        }
      }
    }, 100);
  }

  private broadcastChannelMembers(channelId: string): void {
    const members = Array.from(this.playerSessions.values())
      .filter((s) => (s.activeChannel || 'proximity') === channelId)
      .map((s) => ({
        uuid: s.playerUuid,
        username: s.username,
        isSpeaking: s.isSpeaking,
      }));

    for (const session of this.playerSessions.values()) {
      if ((session.activeChannel || 'proximity') === channelId && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(
          JSON.stringify({
            type: 'channel_members',
            channelId,
            members,
          })
        );
      }
    }
  }

  private broadcastChannelSpeaking(session: ClientSession): void {
    const channel = session.activeChannel;
    if (!channel || channel === 'proximity') return;

    for (const peerSession of this.playerSessions.values()) {
      if (
        peerSession.playerUuid !== session.playerUuid &&
        peerSession.activeChannel === channel &&
        peerSession.ws.readyState === WebSocket.OPEN
      ) {
        peerSession.ws.send(
          JSON.stringify({
            type: 'channel_peer_speaking',
            channelId: channel,
            peerUuid: session.playerUuid,
            speaking: session.isSpeaking,
          })
        );
      }
    }
  }

  public cleanupSession(session: ClientSession): void {
    if (!this.sessions.has(session.sessionId) && !this.playerSessions.has(session.playerUuid)) {
      return;
    }

    console.log(`[ClientGateway] Cleaning up session for ${session.username} (${session.playerUuid})`);
    const channel = session.activeChannel;

    if (session.isSpeaking) {
      session.isSpeaking = false;
      this.pluginGateway.notifySpeechStatus(session.playerUuid, false);
    }

    this.sessions.delete(session.sessionId);
    this.playerSessions.delete(session.playerUuid);

    for (const consumer of session.consumers.values()) {
      try {
        consumer.close();
      } catch {}
    }
    session.consumers.clear();

    // Clean up consumers in other sessions that were listening to this disconnected player
    for (const otherSession of this.playerSessions.values()) {
      if (otherSession.playerUuid === session.playerUuid) continue;
      const consumer = otherSession.consumers.get(session.playerUuid);
      if (consumer) {
        try {
          consumer.close();
        } catch {}
        otherSession.consumers.delete(session.playerUuid);
        if (otherSession.ws.readyState === WebSocket.OPEN) {
          otherSession.ws.send(
            JSON.stringify({
              type: 'consumer_closed',
              peerUuid: session.playerUuid,
              consumerId: consumer.id,
            })
          );
        }
      }
    }

    if (session.producer) {
      try {
        session.producer.close();
      } catch {}
    }
    if (session.sendTransport) {
      try {
        session.sendTransport.close();
      } catch {}
    }
    if (session.recvTransport) {
      try {
        session.recvTransport.close();
      } catch {}
    }

    if (channel && channel !== 'proximity') {
      this.broadcastChannelMembers(channel);
    }
  }

  public disconnectSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.cleanupSession(session);
      if (session.ws.readyState === WebSocket.OPEN) {
        try {
          session.ws.close(1000, 'Session disconnected via beacon/api');
        } catch {}
      }
      return true;
    }
    return false;
  }

  public disconnectPlayer(playerUuid: string): boolean {
    const session = this.playerSessions.get(playerUuid);
    if (session) {
      this.cleanupSession(session);
      if (session.ws.readyState === WebSocket.OPEN) {
        try {
          session.ws.close(1000, 'Session disconnected via beacon/api');
        } catch {}
      }
      return true;
    }
    return false;
  }

  public getConnectedClientsCount(): number {
    return this.playerSessions.size;
  }

  public getChannelStats(): Record<string, number> {
    const stats: Record<string, number> = { proximity: 0 };
    for (const session of this.playerSessions.values()) {
      const channel = session.activeChannel || 'proximity';
      stats[channel] = (stats[channel] || 0) + 1;
    }
    return stats;
  }

  public getSessionsSummary(): Array<{
    sessionId: string;
    playerUuid: string;
    username: string;
    activeChannel: string;
    isSpeaking: boolean;
  }> {
    return Array.from(this.playerSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      playerUuid: s.playerUuid,
      username: s.username,
      activeChannel: s.activeChannel || 'proximity',
      isSpeaking: s.isSpeaking,
    }));
  }

  public isPlayerBanned(uuid: string): boolean {
    const ban = this.bannedUuids.get(uuid);
    if (!ban) return false;
    if (ban.expiresAt && ban.expiresAt > 0 && Date.now() > ban.expiresAt) {
      this.bannedUuids.delete(uuid);
      return false;
    }
    return true;
  }

  public isIpBanned(ip?: string): boolean {
    if (!ip) return false;
    const norm = this.tokenStore.normalizeIp(ip);
    const ban = this.bannedIps.get(norm);
    if (!ban) return false;
    if (ban.expiresAt && ban.expiresAt > 0 && Date.now() > ban.expiresAt) {
      this.bannedIps.delete(norm);
      return false;
    }
    return true;
  }

  public isDeviceBanned(deviceId?: string): boolean {
    if (!deviceId) return false;
    const ban = this.bannedDevices.get(deviceId);
    if (!ban) return false;
    if (ban.expiresAt && ban.expiresAt > 0 && Date.now() > ban.expiresAt) {
      this.bannedDevices.delete(deviceId);
      return false;
    }
    return true;
  }

  public isPlayerMuted(uuid: string): boolean {
    const mute = this.mutedUuids.get(uuid);
    if (!mute) return false;
    if (mute.expiresAt && mute.expiresAt > 0 && Date.now() > mute.expiresAt) {
      this.mutedUuids.delete(uuid);
      return false;
    }
    return true;
  }

  public isPlayerDeafened(uuid: string): boolean {
    const deafen = this.deafenedUuids.get(uuid);
    if (!deafen) return false;
    if (deafen.expiresAt && deafen.expiresAt > 0 && Date.now() > deafen.expiresAt) {
      this.deafenedUuids.delete(uuid);
      return false;
    }
    return true;
  }

  public async handleModerationAction(payload: ModerationActionPayload): Promise<void> {
    const { targetUuid, action, active, reason, expiresAt, clientIp, deviceId } = payload;

    switch (action) {
      case 'kick': {
        const session = this.playerSessions.get(targetUuid);
        if (session) {
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(
              JSON.stringify({
                type: 'moderation_notice',
                action: 'kick',
                active: true,
                reason: reason || 'Kicked by staff',
              })
            );
            session.ws.close(4003, 'Kicked by staff');
          }
          this.cleanupSession(session);
        }
        break;
      }

      case 'ban': {
        if (active) {
          this.bannedUuids.set(targetUuid, { reason, expiresAt });
          if (clientIp) {
            this.bannedIps.set(this.tokenStore.normalizeIp(clientIp), { reason, expiresAt });
          }
          if (deviceId) {
            this.bannedDevices.set(deviceId, { reason, expiresAt });
          }

          const session = this.playerSessions.get(targetUuid);
          if (session) {
            if (session.clientIp) {
              this.bannedIps.set(this.tokenStore.normalizeIp(session.clientIp), { reason, expiresAt });
            }
            if (session.deviceId) {
              this.bannedDevices.set(session.deviceId, { reason, expiresAt });
            }

            if (session.ws.readyState === WebSocket.OPEN) {
              session.ws.send(
                JSON.stringify({
                  type: 'moderation_notice',
                  action: 'ban',
                  active: true,
                  reason: reason || 'Banned by staff',
                  expiresAt,
                })
              );
              session.ws.close(4003, 'Banned');
            }
            this.cleanupSession(session);
          }
        } else {
          this.bannedUuids.delete(targetUuid);
          if (clientIp) {
            this.bannedIps.delete(this.tokenStore.normalizeIp(clientIp));
          }
          if (deviceId) {
            this.bannedDevices.delete(deviceId);
          }
        }
        break;
      }

      case 'mute': {
        if (active) {
          this.mutedUuids.set(targetUuid, { reason, expiresAt });
        } else {
          this.mutedUuids.delete(targetUuid);
        }

        const session = this.playerSessions.get(targetUuid);
        if (session) {
          session.isMuted = active;
          if (session.producer) {
            try {
              if (active) {
                await session.producer.pause();
              } else {
                await session.producer.resume();
              }
            } catch (err) {
              console.error(`[ClientGateway] Error toggling producer mute for ${targetUuid}:`, err);
            }
          }
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(
              JSON.stringify({
                type: 'moderation_notice',
                action: 'mute',
                active,
                reason: reason || 'Muted by moderation',
                expiresAt,
              })
            );
          }
        }
        break;
      }

      case 'deafen': {
        if (active) {
          this.deafenedUuids.set(targetUuid, { reason, expiresAt });
        } else {
          this.deafenedUuids.delete(targetUuid);
        }

        const session = this.playerSessions.get(targetUuid);
        if (session) {
          session.isDeafened = active;
          for (const consumer of session.consumers.values()) {
            try {
              if (active) {
                await consumer.pause();
              } else {
                await consumer.resume();
              }
            } catch (err) {
              console.error(`[ClientGateway] Error toggling consumer deafen for ${targetUuid}:`, err);
            }
          }
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(
              JSON.stringify({
                type: 'moderation_notice',
                action: 'deafen',
                active,
                reason: reason || 'Deafened by moderation',
                expiresAt,
              })
            );
          }
        }
        break;
      }
    }
  }

  public async syncActivePunishments(punishments: any[]): Promise<void> {
    for (const p of punishments) {
      await this.handleModerationAction({
        targetUuid: p.targetUuid,
        action: p.action,
        active: true,
        reason: p.reason,
        expiresAt: p.expiresAt,
        clientIp: p.clientIp,
        deviceId: p.deviceId,
      });
    }
  }

  public broadcastAudioEvent(event: string, emitter: any): void {
    const payload = JSON.stringify({
      type: 'audio_event',
      event,
      emitter,
    });
    for (const session of this.sessions.values()) {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(payload);
      }
    }
  }

  public broadcastAudioState(): void {
    if (!this.audioEmitterManager) return;
    const payload = JSON.stringify({
      type: 'audio_state',
      emitters: this.audioEmitterManager.getActiveEmitters(),
    });
    for (const session of this.sessions.values()) {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(payload);
      }
    }
  }

  public getAudioEmitterManager(): AudioEmitterManager | undefined {
    return this.audioEmitterManager;
  }

  public shutdown(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
    if (this.connectionHandler) {
      this.wss.off('connection', this.connectionHandler);
    }
    for (const session of this.sessions.values()) {
      this.cleanupSession(session);
    }
  }
}
