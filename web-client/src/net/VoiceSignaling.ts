import { Device } from 'mediasoup-client';
import { types as mediasoupTypes } from 'mediasoup-client';
import { SpatialAudioPipeline } from '../audio/SpatialAudioPipeline.js';
import { PeerRadarInfo } from '../components/Radar.js';

export interface ChannelMember {
  uuid: string;
  username: string;
  isSpeaking: boolean;
}

export interface SignalingCallbacks {
  onAuthenticated: (player: { uuid: string; username: string }) => void;
  onError: (errorMsg: string) => void;
  onPeersUpdated: (peers: PeerRadarInfo[]) => void;
  onDisconnected: () => void;
  onChannelChanged?: (channelId: string) => void;
  onChannelMembersUpdated?: (channelId: string, members: ChannelMember[]) => void;
  onChannelPeerSpeaking?: (channelId: string, peerUuid: string, speaking: boolean) => void;
  onPingUpdated?: (pingMs: number) => void;
}

export class VoiceSignaling {
  private wsUrl: string;
  private token: string;
  private callbacks: SignalingCallbacks;
  private pipeline: SpatialAudioPipeline;

  private ws?: WebSocket;
  private device?: Device;
  private sendTransport?: mediasoupTypes.Transport;
  private recvTransport?: mediasoupTypes.Transport;
  private audioProducer?: mediasoupTypes.Producer;
  private consumers = new Map<string, mediasoupTypes.Consumer>(); // peerUuid -> consumer
  private peersInfo = new Map<string, PeerRadarInfo>(); // peerUuid -> PeerRadarInfo
  private knownUsernames = new Map<string, string>(); // peerUuid -> username
  private pingInterval?: any;
  private sessionId?: string;
  private peersUpdateRaf: number | null = null;

  private dispatchPeersUpdatedThrottled(): void {
    if (this.peersUpdateRaf !== null) return;
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      this.peersUpdateRaf = window.requestAnimationFrame(() => {
        this.peersUpdateRaf = null;
        this.callbacks.onPeersUpdated(Array.from(this.peersInfo.values()));
      });
    } else {
      this.callbacks.onPeersUpdated(Array.from(this.peersInfo.values()));
    }
  }

  constructor(
    wsUrl: string,
    token: string,
    pipeline: SpatialAudioPipeline,
    callbacks: SignalingCallbacks
  ) {
    this.wsUrl = wsUrl;
    this.token = token;
    this.pipeline = pipeline;
    this.callbacks = callbacks;
  }

  public async connect(micStream: MediaStream): Promise<void> {
    await this.pipeline.resume();

    this.device = new Device();
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = async () => {
      this.startPingLoop();
      // Send authentication request
      this.send({
        type: 'client_auth',
        token: this.token,
      });
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.handleMessage(msg, micStream);
      } catch (err) {
        console.error('[VoiceSignaling] Error parsing message:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[VoiceSignaling] WebSocket error:', err);
      this.callbacks.onError('Connection error. Please verify the voice server is running.');
    };

    this.ws.onclose = () => {
      this.stopPingLoop();
      console.log('[VoiceSignaling] WebSocket closed.');
      this.callbacks.onDisconnected();
    };
  }

  private async handleMessage(msg: any, micStream: MediaStream): Promise<void> {
    switch (msg.type) {
      case 'pong': {
        if (typeof msg.timestamp === 'number') {
          const rtt = Math.max(0, Date.now() - msg.timestamp);
          this.callbacks.onPingUpdated?.(rtt);
        }
        break;
      }

      case 'auth_error': {
        this.callbacks.onError(msg.message || 'Authentication failed');
        break;
      }

      case 'auth_success': {
        if (!this.device) return;

        this.sessionId = msg.sessionId;

        // Load router RTP capabilities into device
        await this.device.load({ routerRtpCapabilities: msg.routerRtpCapabilities });

        // 1. Create Send Transport
        this.sendTransport = this.device.createSendTransport(msg.sendTransportOptions);
        this.sendTransport.on('connectionstatechange', (state) => {
          console.log('[VoiceSignaling] Send transport state:', state);
        });
        this.sendTransport.on('connect', ({ dtlsParameters }, callback) => {
          this.send({
            type: 'connect_transport',
            transportType: 'send',
            dtlsParameters,
          });
          callback();
        });

        this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback) => {
          this.send({
            type: 'produce',
            kind,
            rtpParameters,
          });
          // Producer ID will be handled in callback on response
          const onProduced = (ev: MessageEvent) => {
            try {
              const res = JSON.parse(ev.data);
              if (res.type === 'produced') {
                this.ws?.removeEventListener('message', onProduced);
                callback({ id: res.producerId });
              }
            } catch {}
          };
          this.ws?.addEventListener('message', onProduced);
        });

        // 2. Create Receive Transport
        this.recvTransport = this.device.createRecvTransport(msg.recvTransportOptions);
        this.recvTransport.on('connectionstatechange', (state) => {
          console.log('[VoiceSignaling] Recv transport state:', state);
        });
        this.recvTransport.on('connect', ({ dtlsParameters }, callback) => {
          this.send({
            type: 'connect_transport',
            transportType: 'recv',
            dtlsParameters,
          });
          callback();
        });

        // Produce microphone audio track
        const micTrack = micStream.getAudioTracks()[0];
        if (micTrack) {
          this.audioProducer = await this.sendTransport.produce({ track: micTrack });
        }

        this.callbacks.onAuthenticated({
          uuid: msg.playerUuid,
          username: msg.username,
        });
        break;
      }

      case 'new_consumer': {
        if (!this.recvTransport || !this.device) return;

        const consumer = await this.recvTransport.consume({
          id: msg.consumerId,
          producerId: msg.producerId,
          kind: 'audio',
          rtpParameters: msg.rtpParameters,
        });

        this.consumers.set(msg.peerUuid, consumer);
        console.log('[VoiceSignaling] Consuming audio from peer:', msg.peerUuid, {
          consumerId: consumer.id,
          producerId: consumer.producerId,
          track: consumer.track,
          trackEnabled: consumer.track.enabled,
          trackMuted: consumer.track.muted,
        });

        // Add to Web Audio spatial or stereo graph
        this.pipeline.addPeerStream(msg.peerUuid, consumer.track, {
          relX: msg.relX,
          relY: msg.relY,
          relZ: msg.relZ,
          isSubmerged: msg.isSubmerged,
          isChannel: Boolean(msg.isChannel),
        });

        if (!msg.isChannel) {
          if (msg.peerUsername) {
            this.knownUsernames.set(msg.peerUuid, msg.peerUsername);
          }
          this.peersInfo.set(msg.peerUuid, {
            uuid: msg.peerUuid,
            username: msg.peerUsername,
            distance: msg.distance,
            relX: msg.relX,
            relY: msg.relY,
            relZ: msg.relZ,
            isSubmerged: msg.isSubmerged,
          });
          this.dispatchPeersUpdatedThrottled();
        }
        break;
      }

      case 'channel_joined': {
        this.callbacks.onChannelChanged?.(msg.channelId);
        break;
      }

      case 'channel_members': {
        this.callbacks.onChannelMembersUpdated?.(msg.channelId, msg.members || []);
        break;
      }

      case 'channel_peer_speaking': {
        this.callbacks.onChannelPeerSpeaking?.(msg.channelId, msg.peerUuid, Boolean(msg.speaking));
        break;
      }

      case 'peer_spatial_update': {
        this.pipeline.updatePeerPosition(
          msg.peerUuid,
          msg.relX,
          msg.relY,
          msg.relZ,
          msg.isSubmerged,
          Boolean(msg.isPaused)
        );

        if (msg.isPaused) {
          if (this.peersInfo.has(msg.peerUuid)) {
            this.peersInfo.delete(msg.peerUuid);
            this.dispatchPeersUpdatedThrottled();
          }
        } else {
          if (msg.peerUsername) {
            this.knownUsernames.set(msg.peerUuid, msg.peerUsername);
          }
          const resolvedUsername =
            msg.peerUsername || this.knownUsernames.get(msg.peerUuid) || 'Player';

          const current = this.peersInfo.get(msg.peerUuid);
          if (current) {
            current.distance = msg.distance;
            current.relX = msg.relX;
            current.relY = msg.relY;
            current.relZ = msg.relZ;
            current.isSubmerged = msg.isSubmerged;
            current.username = resolvedUsername;
          } else {
            this.peersInfo.set(msg.peerUuid, {
              uuid: msg.peerUuid,
              username: resolvedUsername,
              distance: msg.distance,
              relX: msg.relX,
              relY: msg.relY,
              relZ: msg.relZ,
              isSubmerged: msg.isSubmerged,
            });
          }
          this.dispatchPeersUpdatedThrottled();
        }
        break;
      }

      case 'consumer_closed': {
        const consumer = this.consumers.get(msg.peerUuid);
        if (consumer) {
          consumer.close();
          this.consumers.delete(msg.peerUuid);
        }
        this.pipeline.removePeerStream(msg.peerUuid);
        this.peersInfo.delete(msg.peerUuid);
        this.knownUsernames.delete(msg.peerUuid);
        this.dispatchPeersUpdatedThrottled();
        break;
      }
    }
  }

  public joinChannel(channelId: string): void {
    this.peersInfo.clear();
    this.dispatchPeersUpdatedThrottled();
    this.send({
      type: 'join_channel',
      channelId,
    });
  }

  public notifySpeaking(isSpeaking: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'speaking',
        speaking: isSpeaking,
      });
    }
  }

  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public async replaceMicrophoneTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (this.audioProducer) {
      await this.audioProducer.replaceTrack({ track: newTrack });
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: Date.now(),
        });
      }
    }, 2500);
  }

  private stopPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  public disconnect(): void {
    this.stopPingLoop();
    if (this.peersUpdateRaf !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.peersUpdateRaf);
      this.peersUpdateRaf = null;
    }
    if (this.audioProducer) {
      try {
        this.audioProducer.close();
      } catch {}
    }
    for (const consumer of this.consumers.values()) {
      try {
        consumer.close();
      } catch {}
    }
    this.consumers.clear();
    this.peersInfo.clear();

    if (this.sendTransport) {
      try {
        this.sendTransport.close();
      } catch {}
    }
    if (this.recvTransport) {
      try {
        this.recvTransport.close();
      } catch {}
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.send({ type: 'client_disconnect' });
        }
      } catch {}
      try {
        this.ws.close(1000, 'Client disconnected');
      } catch {}
    }
  }
}
