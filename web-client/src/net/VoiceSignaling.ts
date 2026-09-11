import { Device } from 'mediasoup-client';
import { types as mediasoupTypes } from 'mediasoup-client';
import { SpatialAudioPipeline } from '../audio/SpatialAudioPipeline.js';
import { PeerRadarInfo } from '../components/Radar.js';

export interface SignalingCallbacks {
  onAuthenticated: (player: { uuid: string; username: string }) => void;
  onError: (errorMsg: string) => void;
  onPeersUpdated: (peers: PeerRadarInfo[]) => void;
  onDisconnected: () => void;
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
      console.log('[VoiceSignaling] WebSocket closed.');
      this.callbacks.onDisconnected();
    };
  }

  private async handleMessage(msg: any, micStream: MediaStream): Promise<void> {
    switch (msg.type) {
      case 'auth_error': {
        this.callbacks.onError(msg.message || 'Authentication failed');
        break;
      }

      case 'auth_success': {
        if (!this.device) return;

        // Load router RTP capabilities into device
        await this.device.load({ routerRtpCapabilities: msg.routerRtpCapabilities });

        // 1. Create Send Transport
        this.sendTransport = this.device.createSendTransport(msg.sendTransportOptions);
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

        // Add to Web Audio 3D spatial graph
        this.pipeline.addPeerStream(msg.peerUuid, consumer.track, {
          relX: msg.relX,
          relY: msg.relY,
          relZ: msg.relZ,
          isSubmerged: msg.isSubmerged,
        });

        this.peersInfo.set(msg.peerUuid, {
          uuid: msg.peerUuid,
          username: msg.peerUsername,
          distance: msg.distance,
          relX: msg.relX,
          relY: msg.relY,
          relZ: msg.relZ,
          isSubmerged: msg.isSubmerged,
        });

        this.callbacks.onPeersUpdated(Array.from(this.peersInfo.values()));
        break;
      }

      case 'peer_spatial_update': {
        this.pipeline.updatePeerPosition(
          msg.peerUuid,
          msg.relX,
          msg.relY,
          msg.relZ,
          msg.isSubmerged
        );

        const current = this.peersInfo.get(msg.peerUuid);
        if (current) {
          current.distance = msg.distance;
          current.relX = msg.relX;
          current.relY = msg.relY;
          current.relZ = msg.relZ;
          current.isSubmerged = msg.isSubmerged;
          this.callbacks.onPeersUpdated(Array.from(this.peersInfo.values()));
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
        this.callbacks.onPeersUpdated(Array.from(this.peersInfo.values()));
        break;
      }
    }
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

  public disconnect(): void {
    if (this.audioProducer) {
      this.audioProducer.close();
    }
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();
    this.peersInfo.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
    }
    if (this.recvTransport) {
      this.recvTransport.close();
    }
    if (this.ws) {
      this.ws.close();
    }
    this.pipeline.close();
  }
}
