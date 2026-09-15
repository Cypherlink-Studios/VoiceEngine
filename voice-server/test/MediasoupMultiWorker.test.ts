import { describe, it, expect, afterEach } from 'vitest';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';

describe('Mediasoup Multi-Worker Pool & PipeTransport Routing', () => {
  let sfu: MediasoupManager;

  afterEach(() => {
    if (sfu && !sfu.isClosed()) {
      sfu.close();
    }
  });

  it('spawns multiple workers and partitions routers across workers', async () => {
    sfu = new MediasoupManager();
    await sfu.init(2);

    expect(sfu.getWorkers()).toHaveLength(2);
    expect(sfu.getRouters()).toHaveLength(2);

    const stats = sfu.getWorkerStats();
    expect(stats).toHaveLength(2);
    expect(stats[0].workerIndex).toBe(0);
    expect(stats[1].workerIndex).toBe(1);
    expect(stats[0].pid).toBeGreaterThan(0);
    expect(stats[1].pid).toBeGreaterThan(0);
  });

  it('allocates transports according to least-loaded router strategy', async () => {
    sfu = new MediasoupManager();
    await sfu.init(2);

    const router0 = sfu.getRouters()[0];
    const router1 = sfu.getRouters()[1];

    // First transport -> router 0
    const transport1 = await sfu.createWebRtcTransport();
    expect(sfu.getTransportRouter(transport1.id)?.id).toBe(router0.id);

    // Second transport -> router 1 (least loaded)
    const transport2 = await sfu.createWebRtcTransport();
    expect(sfu.getTransportRouter(transport2.id)?.id).toBe(router1.id);

    // Third transport -> router 0 again (tied load 1 vs 1, picks first)
    const transport3 = await sfu.createWebRtcTransport();
    expect(sfu.getTransportRouter(transport3.id)?.id).toBe(router0.id);

    const stats = sfu.getWorkerStats();
    expect(stats[0].activeTransports).toBe(2);
    expect(stats[1].activeTransports).toBe(1);

    // Close transport 1 -> router 0 active count drops to 1
    transport1.close();
    const statsAfterClose = sfu.getWorkerStats();
    expect(statsAfterClose[0].activeTransports).toBe(1);
    expect(statsAfterClose[1].activeTransports).toBe(1);

    transport2.close();
    transport3.close();
  });

  it('pipes producers across different worker routers on demand', async () => {
    sfu = new MediasoupManager();
    await sfu.init(2);

    const router0 = sfu.getRouters()[0];
    const router1 = sfu.getRouters()[1];

    // Worker 0 creates sender transport and producer
    const sendTransport = await sfu.createWebRtcTransport(router0);
    const producer = await sendTransport.produce({
      kind: 'audio',
      rtpParameters: {
        codecs: [
          {
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            payloadType: 111,
          },
        ],
        encodings: [{ ssrc: 99999999 }],
      },
    });
    sfu.registerProducer(producer, router0);

    // Worker 1 creates receiver transport
    const recvTransport = await sfu.createWebRtcTransport(router1);
    expect(sfu.getTransportRouter(recvTransport.id)?.id).toBe(router1.id);

    // Prior to consumption, router 1 does not have the producer
    expect(router1.canConsume({ producerId: producer.id, rtpCapabilities: sfu.getRtpCapabilities() })).toBe(false);

    // Consuming across workers automatically triggers router0.pipeToRouter({ producerId, router: router1 })
    const consumer = await sfu.createConsumer(recvTransport, producer.id, sfu.getRtpCapabilities());

    expect(consumer).toBeDefined();
    expect(consumer.id).toBeDefined();
    expect(consumer.producerId).toBe(producer.id);
    expect(router1.canConsume({ producerId: producer.id, rtpCapabilities: sfu.getRtpCapabilities() })).toBe(true);

    // Creating a second consumer on router 1 reuses the piped producer without re-piping
    const recvTransport2 = await sfu.createWebRtcTransport(router1);
    const consumer2 = await sfu.createConsumer(recvTransport2, producer.id, sfu.getRtpCapabilities());
    expect(consumer2).toBeDefined();

    consumer.close();
    consumer2.close();
    producer.close();
    sendTransport.close();
    recvTransport.close();
    recvTransport2.close();
  });
});
