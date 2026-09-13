import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { TokenStore } from '../auth/TokenStore.js';
import { SpatialEngine } from '../spatial/SpatialEngine.js';
import { MediasoupManager } from '../sfu/MediasoupManager.js';
import { PluginGateway } from './PluginGateway.js';
import { ClientSession } from '../types.js';
import { SettingsManager } from '../config/SettingsManager.js';
import { config } from '../config.js';
import * as mediasoup from 'mediasoup';

export class ClientGateway {
  private wss: WebSocketServer;
  private tokenStore: TokenStore;
  private spatialEngine: SpatialEngine;
  private sfu: MediasoupManager;
  private pluginGateway: PluginGateway;
  private settingsManager?: SettingsManager;

  private sessions = new Map<string, ClientSession>(); // sessionId -> ClientSession
  private playerSessions = new Map<string, ClientSession>(); // playerUuid -> ClientSession
  private loopInterval?: NodeJS.Timeout;

  constructor(
    wss: WebSocketServer,
    tokenStore: TokenStore,
    spatialEngine: SpatialEngine,
    sfu: MediasoupManager,
    pluginGateway: PluginGateway,
    settingsManager?: SettingsManager
  ) {
    this.wss = wss;
    this.tokenStore = tokenStore;
    this.spatialEngine = spatialEngine;
    this.sfu = sfu;
    this.pluginGateway = pluginGateway;
    this.settingsManager = settingsManager;

    this.init();
    this.startProximityLoop();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      let session: ClientSession | null = null;
      let clientRtpCapabilities: mediasoup.types.RtpCapabilities | null = null;

      ws.on('message', async (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString());

          switch (msg.type) {
            case 'client_auth': {
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

              clientRtpCapabilities = msg.rtpCapabilities;
              const sessionId = uuidv4();

              // Create Mediasoup Transports
              const sendTransport = await this.sfu.createWebRtcTransport();
              const recvTransport = await this.sfu.createWebRtcTransport();

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
              };

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
              ws.send(JSON.stringify({ type: 'produced', producerId: producer.id }));
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
                consumer.close();
                session.ws.send(
                  JSON.stringify({
                    type: 'consumer_closed',
                    peerUuid,
                    consumerId: consumer.id,
                  })
                );
              }
              session.consumers.clear();

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
    });
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
          // --- 1. Proximity 3D Audio Routing ---
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

            if (!consumer) {
              try {
                consumer = await this.sfu.createConsumer(
                  listenerSession.recvTransport,
                  speakerSession.producer.id,
                  this.sfu.getRtpCapabilities()
                );

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
                  })
                );
              } catch (err) {
                console.error(`[ClientGateway] Failed to create proximity consumer for ${peer.peerUuid}:`, err);
              }
            } else {
              listenerSession.ws.send(
                JSON.stringify({
                  type: 'peer_spatial_update',
                  peerUuid: peer.peerUuid,
                  relX: peer.relX,
                  relY: peer.relY,
                  relZ: peer.relZ,
                  distance: peer.distance,
                  isSubmerged: peer.isSubmerged,
                })
              );
            }
          }

          // Cull inaudible proximity consumers
          for (const [peerUuid, consumer] of listenerSession.consumers.entries()) {
            if (!activePeerUuids.has(peerUuid)) {
              consumer.close();
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
            if (!consumer) {
              try {
                consumer = await this.sfu.createConsumer(
                  listenerSession.recvTransport,
                  speakerSession.producer.id,
                  this.sfu.getRtpCapabilities()
                );

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
            }
          }

          // Cull consumers who left the channel
          for (const [peerUuid, consumer] of listenerSession.consumers.entries()) {
            if (!channelPeerUuids.has(peerUuid)) {
              consumer.close();
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

  public shutdown(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
    for (const session of this.sessions.values()) {
      this.cleanupSession(session);
    }
  }
}
