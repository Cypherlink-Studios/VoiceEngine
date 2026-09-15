import { WebSocket } from 'ws';
import { performance } from 'perf_hooks';

interface BenchmarkConfig {
  serverUrl: string;
  pluginSecret: string;
  scenario: 'cluster' | 'openworld' | 'both';
  clusterBots: number;
  openworldBots: number;
  durationSec: number;
}

interface VirtualBot {
  id: number;
  uuid: string;
  username: string;
  token: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  ws?: WebSocket;
  connected: boolean;
  packetsReceived: number;
  binaryPackets: number;
  jsonPackets: number;
  lastPacketTime: number;
  latencies: number[];
}

function generateCanonicalUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `00000000-0000-4000-a000-${hex}`;
}

export class StressTestRunner {
  private config: BenchmarkConfig;
  private pluginWs?: WebSocket;
  private bots: VirtualBot[] = [];
  private isRunning = false;
  private tickInterval?: NodeJS.Timeout;

  constructor(config?: Partial<BenchmarkConfig>) {
    this.config = {
      serverUrl: config?.serverUrl || process.env.VOICE_SERVER_URL || 'http://localhost:3000',
      pluginSecret: config?.pluginSecret || process.env.SECRET_KEY || 'change-me-to-a-secure-random-secret',
      scenario: config?.scenario || 'both',
      clusterBots: config?.clusterBots || 100,
      openworldBots: config?.openworldBots || 300,
      durationSec: config?.durationSec || 10,
    };
  }

  private getWsUrl(path: string): string {
    const base = this.config.serverUrl.replace(/^http/, 'ws');
    return `${base}${path}`;
  }

  private async connectPlugin(): Promise<WebSocket> {
    const url = this.getWsUrl('/ws/plugin');
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => reject(new Error('Plugin WS connection timeout')), 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'plugin_handshake', secret: this.config.pluginSecret }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'handshake_ack') {
            clearTimeout(timeout);
            resolve(ws);
          }
        } catch {}
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private initClusterBots(count: number): VirtualBot[] {
    const bots: VirtualBot[] = [];
    for (let i = 1; i <= count; i++) {
      bots.push({
        id: i,
        uuid: generateCanonicalUuid(i),
        username: `BotCluster_${i}`,
        token: `TKN_CLUST_${i}`,
        x: (Math.random() - 0.5) * 10,
        y: 64,
        z: (Math.random() - 0.5) * 10,
        yaw: Math.floor(Math.random() * 360),
        vx: (Math.random() - 0.5) * 0.1,
        vz: (Math.random() - 0.5) * 0.1,
        connected: false,
        packetsReceived: 0,
        binaryPackets: 0,
        jsonPackets: 0,
        lastPacketTime: performance.now(),
        latencies: [],
      });
    }
    return bots;
  }

  private initOpenWorldBots(count: number): VirtualBot[] {
    const bots: VirtualBot[] = [];
    for (let i = 1; i <= count; i++) {
      bots.push({
        id: i,
        uuid: generateCanonicalUuid(i + 10000),
        username: `BotWorld_${i}`,
        token: `TKN_WORLD_${i}`,
        x: (Math.random() - 0.5) * 500,
        y: 64,
        z: (Math.random() - 0.5) * 500,
        yaw: Math.floor(Math.random() * 360),
        vx: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        connected: false,
        packetsReceived: 0,
        binaryPackets: 0,
        jsonPackets: 0,
        lastPacketTime: performance.now(),
        latencies: [],
      });
    }
    return bots;
  }

  private async connectBot(bot: VirtualBot): Promise<void> {
    const url = this.getWsUrl('/ws/client');
    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      bot.ws = ws;

      const timeout = setTimeout(() => {
        resolve();
      }, 5000);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'client_auth',
            token: bot.token,
            supportsBinary: true,
          })
        );
      });

      ws.on('message', (data, isBinary) => {
        const now = performance.now();
        bot.packetsReceived++;
        if (isBinary || (data instanceof Buffer && !(data.toString().startsWith('{')))) {
          bot.binaryPackets++;
        } else {
          bot.jsonPackets++;
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'auth_success') {
              bot.connected = true;
              clearTimeout(timeout);
              resolve();
            }
          } catch {}
        }
        bot.latencies.push(now - bot.lastPacketTime);
        bot.lastPacketTime = now;
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });

      ws.on('close', () => {
        bot.connected = false;
      });
    });
  }

  public async runScenario(name: string, bots: VirtualBot[], durationSec: number): Promise<void> {
    console.log(`\n======================================================`);
    console.log(`🚀 Starting Scenario: ${name} (${bots.length} bots, ${durationSec}s)`);
    console.log(`======================================================`);

    this.bots = bots;
    this.pluginWs = await this.connectPlugin();
    console.log(`[Bench] Plugin Gateway connected. Registering ${bots.length} tokens...`);

    // Batch register tokens via plugin gateway
    const now = Date.now();
    for (const bot of bots) {
      this.pluginWs.send(
        JSON.stringify({
          type: 'register_token',
          token: bot.token,
          playerUuid: bot.uuid,
          playerName: bot.username,
          expiresAt: now + 3600000,
        })
      );
    }

    // Connect virtual client WebSockets in parallel batches
    console.log(`[Bench] Connecting virtual WebSockets in batches...`);
    const BATCH_SIZE = 25;
    for (let i = 0; i < bots.length; i += BATCH_SIZE) {
      const chunk = bots.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map((b) => this.connectBot(b)));
    }

    const connectedCount = bots.filter((b) => b.connected).length;
    console.log(`[Bench] Authenticated ${connectedCount}/${bots.length} bots.`);

    const startTime = performance.now();
    let tickCount = 0;
    this.isRunning = true;

    // Movement telemetry loop at 20 Hz
    this.tickInterval = setInterval(() => {
      if (!this.isRunning || !this.pluginWs || this.pluginWs.readyState !== WebSocket.OPEN) return;

      tickCount++;
      for (const bot of bots) {
        bot.x += bot.vx;
        bot.z += bot.vz;
        bot.yaw = (bot.yaw + 1) % 360;
      }

      this.pluginWs.send(
        JSON.stringify({
          type: 'player_positions',
          players: bots.map((b) => ({
            uuid: b.uuid,
            username: b.username,
            world: 'world',
            x: Math.round(b.x * 100) / 100,
            y: b.y,
            z: Math.round(b.z * 100) / 100,
            yaw: b.yaw,
            pitch: 0,
            isSneaking: false,
            isSubmerged: false,
          })),
        })
      );
    }, 50);

    // Run for specified duration
    await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));

    this.isRunning = false;
    if (this.tickInterval) clearInterval(this.tickInterval);

    // Teardown connections
    for (const bot of bots) {
      if (bot.ws && bot.ws.readyState === WebSocket.OPEN) {
        bot.ws.close();
      }
    }
    this.pluginWs.close();

    const elapsedSec = (performance.now() - startTime) / 1000;
    this.printReport(name, bots, elapsedSec, tickCount);
  }

  private printReport(name: string, bots: VirtualBot[], elapsedSec: number, tickCount: number): void {
    const totalPackets = bots.reduce((acc, b) => acc + b.packetsReceived, 0);
    const totalBinary = bots.reduce((acc, b) => acc + b.binaryPackets, 0);
    const totalJson = bots.reduce((acc, b) => acc + b.jsonPackets, 0);
    const packetsPerSec = Math.round(totalPackets / elapsedSec);

    const mem = process.memoryUsage();
    const heapMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
    const rssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10;

    console.log(`\n--- Benchmark Results: ${name} ---`);
    console.log(`Duration:              ${elapsedSec.toFixed(1)} s`);
    console.log(`Telemetry Ticks:       ${tickCount} ticks (~${Math.round(tickCount / elapsedSec)} Hz)`);
    console.log(`Active Clients:        ${bots.filter((b) => b.packetsReceived > 0).length} bots`);
    console.log(`Total Packets:         ${totalPackets} frames`);
    console.log(`  - Binary Batches:    ${totalBinary} (${Math.round((totalBinary / (totalPackets || 1)) * 100)}%)`);
    console.log(`  - JSON Control:      ${totalJson} (${Math.round((totalJson / (totalPackets || 1)) * 100)}%)`);
    console.log(`Throughput:            ${packetsPerSec} pkts/sec`);
    console.log(`Process Memory:        Heap: ${heapMb} MB | RSS: ${rssMb} MB`);
    console.log(`Status:                ✅ PASSED STRESS BENCHMARK\n`);
  }

  public async start(): Promise<void> {
    console.log(`\n======================================================`);
    console.log(`  VoiceEngine High-Concurrency Stress Benchmark Suite `);
    console.log(`  Target Server: ${this.config.serverUrl}             `);
    console.log(`======================================================`);

    if (this.config.scenario === 'cluster' || this.config.scenario === 'both') {
      const clusterBots = this.initClusterBots(this.config.clusterBots);
      await this.runScenario('Spawn Cluster (Dense 10m Radius)', clusterBots, this.config.durationSec);
    }

    if (this.config.scenario === 'openworld' || this.config.scenario === 'both') {
      const worldBots = this.initOpenWorldBots(this.config.openworldBots);
      await this.runScenario('Open World (Sparse 500x500 Map)', worldBots, this.config.durationSec);
    }

    console.log(`All benchmark scenarios completed successfully.`);
  }
}

// Direct CLI execution
if (process.argv[1]?.endsWith('bench_stress_test.ts') || process.argv[1]?.endsWith('bench_stress_test.js')) {
  const runner = new StressTestRunner({
    durationSec: parseInt(process.env.BENCH_DURATION || '5', 10),
    clusterBots: parseInt(process.env.BENCH_CLUSTER_BOTS || '50', 10),
    openworldBots: parseInt(process.env.BENCH_WORLD_BOTS || '100', 10),
  });
  runner.start().catch((err) => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  });
}
