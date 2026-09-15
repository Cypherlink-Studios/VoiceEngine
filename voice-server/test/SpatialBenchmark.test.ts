import { describe, it, expect } from 'vitest';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { PlayerSpatialState, RelativeSpatialAudio } from '../src/types.js';

class LegacyLinearSpatialEngine {
  private players = new Map<string, PlayerSpatialState>();
  private maxDistance = 30.0;
  private sneakDistance = 8.0;

  public updateBatch(players: PlayerSpatialState[]): void {
    for (const p of players) {
      this.players.set(p.uuid, p);
    }
  }

  public getAudiblePeersFor(listenerUuid: string): RelativeSpatialAudio[] {
    const listener = this.players.get(listenerUuid);
    if (!listener) return [];

    const audiblePeers: RelativeSpatialAudio[] = [];

    for (const [peerUuid, speaker] of this.players.entries()) {
      if (peerUuid === listenerUuid) continue;

      const speakerServer = speaker.serverId || 'default';
      const listenerServer = listener.serverId || 'default';
      if (speakerServer !== listenerServer || speaker.world !== listener.world) {
        continue;
      }

      const dx = speaker.x - listener.x;
      const dy = speaker.y - listener.y;
      const dz = speaker.z - listener.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const maxRange = speaker.isSneaking ? this.sneakDistance : this.maxDistance;
      const isAudible = distance <= maxRange;

      if (!isAudible) {
        continue;
      }

      const rad = (listener.yaw * Math.PI) / 180.0;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      const localY = dy;

      audiblePeers.push({
        peerUuid,
        peerUsername: speaker.username,
        distance: Math.round(distance * 100) / 100,
        isAudible: true,
        isSubmerged: speaker.isSubmerged || listener.isSubmerged,
        relX: Math.round(localX * 100) / 100,
        relY: Math.round(localY * 100) / 100,
        relZ: Math.round(localZ * 100) / 100,
      });
    }

    return audiblePeers;
  }
}

describe('SpatialEngine Performance Micro-Benchmark (500 Players)', () => {
  it('achieves >5x speedup over legacy linear loop while maintaining identical accuracy', () => {
    const NUM_PLAYERS = 800;
    const WORLD_SIZE = 2000;
    const players: PlayerSpatialState[] = [];

    // Deterministic pseudo-random distribution
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const seedX = (i * 9301 + 49297) % 233280;
      const seedY = (i * 49297 + 9301) % 233280;
      const seedZ = (i * 12345 + 67890) % 233280;

      const x = (seedX / 233280) * WORLD_SIZE - WORLD_SIZE / 2;
      const y = 64 + (seedY / 233280) * 20;
      const z = (seedZ / 233280) * WORLD_SIZE - WORLD_SIZE / 2;

      players.push({
        uuid: `player-${i}`,
        username: `Bot${i}`,
        world: 'world',
        serverId: 'default',
        x,
        y,
        z,
        yaw: (i * 37) % 360,
        pitch: 0,
        isSneaking: i % 10 === 0,
        isSubmerged: false,
      });
    }

    const gridEngine = new SpatialEngine(30.0, 8.0);
    gridEngine.updateBatch(players);

    const legacyEngine = new LegacyLinearSpatialEngine();
    legacyEngine.updateBatch(players);

    // Warm-up JIT
    for (let w = 0; w < 3; w++) {
      for (let i = 0; i < 50; i++) {
        gridEngine.getAudiblePeersFor(players[i].uuid);
        legacyEngine.getAudiblePeersFor(players[i].uuid);
      }
    }

    const ITERATIONS = 10;

    // 1. Benchmark SpatialGridIndex implementation
    const gridStart = performance.now();
    for (let it = 0; it < ITERATIONS; it++) {
      for (const p of players) {
        gridEngine.getAudiblePeersFor(p.uuid);
      }
    }
    const gridDuration = (performance.now() - gridStart) / ITERATIONS;

    // 2. Benchmark Legacy Linear implementation
    const linearStart = performance.now();
    for (let it = 0; it < ITERATIONS; it++) {
      for (const p of players) {
        legacyEngine.getAudiblePeersFor(p.uuid);
      }
    }
    const linearDuration = (performance.now() - linearStart) / ITERATIONS;

    // 3. Verify 100% accuracy equivalence between both implementations
    for (const p of players) {
      const gridPeers = gridEngine.getAudiblePeersFor(p.uuid).map((a) => a.peerUuid).sort();
      const legacyPeers = legacyEngine.getAudiblePeersFor(p.uuid).map((a) => a.peerUuid).sort();
      expect(gridPeers).toEqual(legacyPeers);
    }

    const speedup = linearDuration / Math.max(gridDuration, 0.001);
    console.log(
      `[Benchmark 500 Players (avg over ${ITERATIONS} runs)] Legacy Linear: ${linearDuration.toFixed(2)}ms, SpatialGrid: ${gridDuration.toFixed(2)}ms, Speedup: ${speedup.toFixed(1)}x`
    );

    expect(speedup).toBeGreaterThan(5.0);
  });
});
