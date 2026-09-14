import * as mediasoup from 'mediasoup';
import { config } from '../config.js';

export class MediasoupManager {
  private worker?: mediasoup.types.Worker;
  private router?: mediasoup.types.Router;

  public async init(): Promise<void> {
    this.worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.workerSettings.logLevel,
      rtcMinPort: config.mediasoup.workerSettings.rtcMinPort,
      rtcMaxPort: config.mediasoup.workerSettings.rtcMaxPort,
    });

    this.worker.on('died', () => {
      console.error('[Mediasoup] Worker died, exiting...');
      process.exit(1);
    });

    this.router = await this.worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs,
    });

    console.log('[Mediasoup] Worker and Router initialized successfully.');
  }

  public getRouter(): mediasoup.types.Router {
    if (!this.router) {
      throw new Error('Mediasoup router not initialized');
    }
    return this.router;
  }

  public getRtpCapabilities(): mediasoup.types.RtpCapabilities {
    return this.getRouter().rtpCapabilities;
  }

  public async createWebRtcTransport(): Promise<mediasoup.types.WebRtcTransport> {
    const router = this.getRouter();
    const transport = await router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    return transport;
  }

  public async createConsumer(
    recvTransport: mediasoup.types.WebRtcTransport,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities
  ): Promise<mediasoup.types.Consumer> {
    const router = this.getRouter();

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Cannot consume producer ${producerId}`);
    }

    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    return consumer;
  }

  public isClosed(): boolean {
    return !this.worker || this.worker.closed || !this.router || this.router.closed;
  }

  public close(): void {
    if (this.router) {
      try {
        this.router.close();
      } catch {}
      this.router = undefined;
    }
    if (this.worker) {
      try {
        this.worker.close();
      } catch {}
      this.worker = undefined;
    }
  }
}
