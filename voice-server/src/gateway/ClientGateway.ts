import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { TokenStore } from '../auth/TokenStore.js';
import { SpatialEngine } from '../spatial/SpatialEngine.js';
import { MediasoupManager } from '../sfu/MediasoupManager.js';
import { PluginGateway } from './PluginGateway.js';
import { ClientSession } from '../types.js';
import * as mediasoup from 'mediasoup';

export class ClientGateway {
  private wss: WebSocketServer;
  private tokenStore: TokenStore;
  private spatialEngine: SpatialEngine;
  private sfu: MediasoupManager;
  private pluginGateway: PluginGateway;

  private sessions = new Map<string, ClientSession>(); // sessionId -> ClientSession
  private playerSessions = new Map<string, ClientSession>(); // playerUuid -> ClientSession
  private loopInterval?: NodeJS.Timeout;

  constructor(
    wss: WebSocketServer,
    tokenStore: TokenStore,
    spatialEngine: SpatialEngine,
    sfu: MediasoupManager,
    pluginGateway: PluginGateway
  ) {
    this.wss = wss;
    this.tokenStore = tokenStore;
    this.spatialEngine = spatialEngine;
    this.sfu = sfu;
    this.pluginGateway = pluginGateway;

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
              const tokenRecord = this.tokenStore.validateAndRedeem(msg.token);
              if (!tokenRecord) {
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
              this.pluginGateway.notifySpeechStatus(session.playerUuid, session.isSpeaking);
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
    // Evaluates proximity every 100ms (10 Hz)
    this.loopInterval = setInterval(async () => {
      for (const listenerSession of this.playerSessions.values()) {
        if (listenerSession.ws.readyState !== WebSocket.OPEN || !listenerSession.recvTransport) {
          continue;
        }

        const audiblePeers = this.spatialEngine.getAudiblePeersFor(listenerSession.playerUuid);
        const audiblePeerUuids = new Set(audiblePeers.map((p) => p.peerUuid));

        // 1. Process Audible Peers
        for (const peer of audiblePeers) {
          const speakerSession = this.playerSessions.get(peer.peerUuid);
          if (!speakerSession || !speakerSession.producer) {
            continue;
          }

          let consumer = listenerSession.consumers.get(peer.peerUuid);

          if (!consumer) {
            // Create new Consumer dynamically
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
                })
              );
            } catch (err) {
              console.error(`[ClientGateway] Failed to create consumer for ${peer.peerUuid}:`, err);
            }
          } else {
            // Update relative 3D spatial position
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

        // 2. Cull Inaudible Consumers
        for (const [peerUuid, consumer] of listenerSession.consumers.entries()) {
          if (!audiblePeerUuids.has(peerUuid)) {
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
    }, 100);
  }

  private cleanupSession(session: ClientSession): void {
    console.log(`[ClientGateway] Cleaning up session for ${session.username} (${session.playerUuid})`);
    this.sessions.delete(session.sessionId);
    this.playerSessions.delete(session.playerUuid);

    for (const consumer of session.consumers.values()) {
      consumer.close();
    }
    session.consumers.clear();

    if (session.producer) {
      session.producer.close();
    }
    if (session.sendTransport) {
      session.sendTransport.close();
    }
    if (session.recvTransport) {
      session.recvTransport.close();
    }
  }

  public getConnectedClientsCount(): number {
    return this.playerSessions.size;
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
