import { Device } from 'mediasoup-client';
import { types as mediasoupTypes } from 'mediasoup-client';
import { SpatialAudioPipeline } from '../audio/SpatialAudioPipeline.js';
import { MediaPipeline } from '../audio/MediaPipeline.js';
import { PeerRadarInfo } from '../components/Radar.js';
import { decodeSpatialBatch } from './BinarySpatialDecoder.js';

export interface ChannelMember {
  uuid: string;
  username: string;
  isSpeaking: boolean;
}

export interface ModerationNotice {
  action: 'mute' | 'deafen' | 'kick' | 'ban' | 'unmute' | 'undeafen';
  active: boolean;
  reason?: string;
  expiresAt?: number;
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
  onModerationNotice?: (notice: ModerationNotice) => void;
}

export class VoiceSignaling {
  private wsUrl: string;
  private token: string;
  private callbacks: SignalingCallbacks;
  private pipeline: SpatialAudioPipeline;
  private mediaPipeline: MediaPipeline;

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
    this.mediaPipeline = new MediaPipeline(pipeline, (data) => this.send(data));
  }

  public getMediaPipeline(): MediaPipeline {
    return this.mediaPipeline;
  }

  private getOrCreateDeviceId(): string {
    const STORAGE_KEY = 'voiceengine_device_id';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let id = window.localStorage.getItem(STORAGE_KEY);
        if (!id) {
          id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'dev_' + Math.random().toString(36).substring(2, 15);
          window.localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
      }
    } catch (e) {
      console.warn('[VoiceSignaling] Failed to access localStorage for deviceId:', e);
    }
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'dev_' + Math.random().toString(36).substring(2, 15);
  }

  public async connect(micStream: MediaStream): Promise<void> {
    await this.pipeline.resume();

    this.device = new Device();
    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = async () => {
      this.startPingLoop();
      this.mediaPipeline.setWsSend((data) => this.send(data));
      const deviceId = this.getOrCreateDeviceId();
      // Send authentication request with binary spatial support flag
      this.send({
        type: 'client_auth',
        token: this.token,
        deviceId,
        supportsBinary: true,
      });
    };

    this.ws.onmessage = async (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          this.handleBinarySpatialBatch(event.data);
          return;
        }
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          await this.handleMessage(msg, micStream);
        }
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
      this.mediaPipeline.destroy();
      console.log('[VoiceSignaling] WebSocket closed.');
      this.callbacks.onDisconnected();
    };
  }

  private async handleMessage(msg: any, micStream: MediaStream): Promise<void> {
    switch (msg.type) {
      case 'time_sync_response': {
        this.mediaPipeline.handleTimeSyncResponse(msg);
        break;
      }

      case 'audio_state': {
        this.mediaPipeline.handleAudioState(msg.emitters || []);
        break;
      }

      case 'audio_event': {
        this.mediaPipeline.handleAudioEvent(msg.event, msg.emitter);
        break;
      }

      case 'emitter_spatial_update': {
        this.mediaPipeline.handleSpatialUpdate(msg);
        break;
      }

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

      case 'moderation_notice': {
        this.callbacks.onModerationNotice?.({
          action: msg.action,
          active: Boolean(msg.active),
          reason: msg.reason,
          expiresAt: msg.expiresAt,
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
          isBroadcast: Boolean(msg.isBroadcast),
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
            isBroadcast: Boolean(msg.isBroadcast),
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
          Boolean(msg.isPaused),
          Boolean(msg.isBroadcast)
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
            current.isBroadcast = Boolean(msg.isBroadcast);
          } else {
            this.peersInfo.set(msg.peerUuid, {
              uuid: msg.peerUuid,
              username: resolvedUsername,
              distance: msg.distance,
              relX: msg.relX,
              relY: msg.relY,
              relZ: msg.relZ,
              isSubmerged: msg.isSubmerged,
              isBroadcast: Boolean(msg.isBroadcast),
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

  private handleBinarySpatialBatch(data: ArrayBuffer): void {
    const batch = decodeSpatialBatch(data);
    let updated = false;

    for (const p of batch) {
      this.pipeline.updatePeerPosition(
        p.peerUuid,
        p.relX,
        p.relY,
        p.relZ,
        p.isSubmerged,
        p.isPaused,
        p.isBroadcast
      );

      if (p.isPaused) {
        if (this.peersInfo.has(p.peerUuid)) {
          this.peersInfo.delete(p.peerUuid);
          updated = true;
        }
      } else {
        const resolvedUsername = this.knownUsernames.get(p.peerUuid) || 'Player';
        const current = this.peersInfo.get(p.peerUuid);
        if (current) {
          current.distance = p.distance;
          current.relX = p.relX;
          current.relY = p.relY;
          current.relZ = p.relZ;
          current.isSubmerged = p.isSubmerged;
          current.username = resolvedUsername;
          current.isBroadcast = p.isBroadcast;
        } else {
          this.peersInfo.set(p.peerUuid, {
            uuid: p.peerUuid,
            username: resolvedUsername,
            distance: p.distance,
            relX: p.relX,
            relY: p.relY,
            relZ: p.relZ,
            isSubmerged: p.isSubmerged,
            isBroadcast: p.isBroadcast,
          });
        }
        updated = true;
      }
    }

    if (updated) {
      this.dispatchPeersUpdatedThrottled();
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
