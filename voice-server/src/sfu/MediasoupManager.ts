import * as mediasoup from 'mediasoup';
import { config } from '../config.js';

export interface WorkerLoadStat {
  workerIndex: number;
  pid: number;
  routerId: string;
  activeTransports: number;
}

export class MediasoupManager {
  private workers: mediasoup.types.Worker[] = [];
  private routers: mediasoup.types.Router[] = [];
  private routerTransportCounts: Map<string, number> = new Map();
  private transportRouters: Map<string, mediasoup.types.Router> = new Map();
  private producerRouters: Map<string, mediasoup.types.Router> = new Map();
  private pipedProducers: Map<string, Set<string>> = new Map(); // producerId -> Set<targetRouterId>

  public async init(numWorkersOverride?: number): Promise<void> {
    const numWorkers = numWorkersOverride || config.mediasoup.numWorkers || 1;
    const { rtcMinPort, rtcMaxPort, logLevel } = config.mediasoup.workerSettings;
    const totalPorts = rtcMaxPort - rtcMinPort + 1;
    const portsPerWorker = Math.max(2, Math.floor(totalPorts / numWorkers));

    for (let i = 0; i < numWorkers; i++) {
      const workerMinPort = rtcMinPort + i * portsPerWorker;
      const workerMaxPort = i === numWorkers - 1 ? rtcMaxPort : workerMinPort + portsPerWorker - 1;

      const worker = await mediasoup.createWorker({
        logLevel,
        rtcMinPort: workerMinPort,
        rtcMaxPort: workerMaxPort,
      });

      worker.on('died', () => {
        console.error(`[Mediasoup] Worker ${i} (PID: ${worker.pid}) died, exiting...`);
        process.exit(1);
      });

      const router = await worker.createRouter({
        mediaCodecs: config.mediasoup.router.mediaCodecs,
      });

      this.workers.push(worker);
      this.routers.push(router);
      this.routerTransportCounts.set(router.id, 0);
    }

    console.log(
      `[Mediasoup] Multi-Worker Pool initialized successfully: ${this.workers.length} worker(s) across ports ${rtcMinPort}-${rtcMaxPort}.`
    );
  }

  public getWorkers(): mediasoup.types.Worker[] {
    return this.workers;
  }

  public getRouters(): mediasoup.types.Router[] {
    return this.routers;
  }

  public getRouter(index = 0): mediasoup.types.Router {
    if (this.routers.length === 0) {
      throw new Error('Mediasoup router not initialized');
    }
    return this.routers[index] || this.routers[0];
  }

  public getLeastLoadedRouter(): mediasoup.types.Router {
    if (this.routers.length === 0) {
      throw new Error('No routers initialized');
    }

    let leastLoaded = this.routers[0];
    let minLoad = this.routerTransportCounts.get(leastLoaded.id) ?? 0;

    for (let i = 1; i < this.routers.length; i++) {
      const router = this.routers[i];
      const load = this.routerTransportCounts.get(router.id) ?? 0;
      if (load < minLoad) {
        minLoad = load;
        leastLoaded = router;
      }
    }

    return leastLoaded;
  }

  public getTransportRouter(transportId: string): mediasoup.types.Router | undefined {
    return this.transportRouters.get(transportId);
  }

  public getRtpCapabilities(): mediasoup.types.RtpCapabilities {
    return this.getRouter().rtpCapabilities;
  }

  public async createWebRtcTransport(
    targetRouter?: mediasoup.types.Router
  ): Promise<mediasoup.types.WebRtcTransport> {
    const router = targetRouter || this.getLeastLoadedRouter();
    const transport = await router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
      appData: { routerId: router.id },
    });

    this.transportRouters.set(transport.id, router);
    const currentCount = this.routerTransportCounts.get(router.id) ?? 0;
    this.routerTransportCounts.set(router.id, currentCount + 1);

    transport.on('@close', () => {
      this.transportRouters.delete(transport.id);
      const count = this.routerTransportCounts.get(router.id) ?? 0;
      this.routerTransportCounts.set(router.id, Math.max(0, count - 1));
    });

    return transport;
  }

  public registerProducer(producer: mediasoup.types.Producer, router: mediasoup.types.Router): void {
    this.producerRouters.set(producer.id, router);

    producer.on('@close', () => {
      this.producerRouters.delete(producer.id);
      this.pipedProducers.delete(producer.id);
    });
  }

  public async createConsumer(
    recvTransport: mediasoup.types.WebRtcTransport,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities
  ): Promise<mediasoup.types.Consumer> {
    const targetRouter =
      this.transportRouters.get(recvTransport.id) ||
      this.routers.find((r) => r.id === (recvTransport.appData as any)?.routerId) ||
      this.routers[0];

    if (!targetRouter) {
      throw new Error('Destination router not found for recvTransport');
    }

    const sourceRouter = this.producerRouters.get(producerId);

    // Cross-worker dynamic PipeTransport creation if producer lives on another router
    if (sourceRouter && sourceRouter.id !== targetRouter.id) {
      let pipedSet = this.pipedProducers.get(producerId);
      if (!pipedSet) {
        pipedSet = new Set<string>();
        this.pipedProducers.set(producerId, pipedSet);
      }

      if (!pipedSet.has(targetRouter.id)) {
        await sourceRouter.pipeToRouter({
          producerId,
          router: targetRouter,
        });
        pipedSet.add(targetRouter.id);
      }
    }

    if (!targetRouter.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Cannot consume producer ${producerId} on router ${targetRouter.id}`);
    }

    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    return consumer;
  }

  public getWorkerStats(): WorkerLoadStat[] {
    return this.workers.map((worker, i) => {
      const router = this.routers[i];
      return {
        workerIndex: i,
        pid: worker.pid,
        routerId: router ? router.id : '',
        activeTransports: router ? (this.routerTransportCounts.get(router.id) ?? 0) : 0,
      };
    });
  }

  public isClosed(): boolean {
    return (
      this.workers.length === 0 ||
      this.workers.every((w) => w.closed) ||
      this.routers.length === 0 ||
      this.routers.every((r) => r.closed)
    );
  }

  public close(): void {
    for (const router of this.routers) {
      try {
        router.close();
      } catch {}
    }
    this.routers = [];

    for (const worker of this.workers) {
      try {
        worker.close();
      } catch {}
    }
    this.workers = [];

    this.routerTransportCounts.clear();
    this.transportRouters.clear();
    this.producerRouters.clear();
    this.pipedProducers.clear();
  }
}
