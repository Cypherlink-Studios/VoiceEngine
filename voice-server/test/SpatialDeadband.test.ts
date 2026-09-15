import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { PlayerSpatialState } from '../src/types.js';

describe('SpatialEngine Deadband Delta Suppression', () => {
  let engine: SpatialEngine;

  const baseListener: PlayerSpatialState = {
    uuid: 'listener-1',
    username: 'Steve',
    world: 'world',
    serverId: 'default',
    x: 0,
    y: 64,
    z: 0,
    yaw: 0,
    pitch: 0,
    isSneaking: false,
    isSubmerged: false,
  };

  const baseSpeaker: PlayerSpatialState = {
    uuid: 'speaker-1',
    username: 'Alex',
    world: 'world',
    serverId: 'default',
    x: 10,
    y: 64,
    z: 10,
    yaw: 0,
    pitch: 0,
    isSneaking: false,
    isSubmerged: false,
  };

  beforeEach(() => {
    engine = new SpatialEngine(30.0, 8.0, 0.08, 2.0);
    engine.updatePlayer(baseListener);
    engine.updatePlayer(baseSpeaker);
  });

  it('dispatches on first evaluation and suppresses subsequent stationary ticks', () => {
    const t0 = 1000;
    // First evaluation: must dispatch
    const first = engine.getAudiblePeersFor('listener-1', true, t0);
    expect(first).toHaveLength(1);
    expect(first[0].peerUuid).toBe('speaker-1');

    // Second evaluation 100ms later with no movement: must suppress
    const t1 = t0 + 100;
    const second = engine.getAudiblePeersFor('listener-1', true, t1);
    expect(second).toHaveLength(0);

    const stats = engine.getSuppressionStats();
    expect(stats.totalEvaluated).toBe(2);
    expect(stats.suppressed).toBe(1);
    expect(stats.ratio).toBe(0.5);
  });

  it('dispatches when position delta exceeds distance threshold (0.08 blocks)', () => {
    const t0 = 1000;
    engine.getAudiblePeersFor('listener-1', true, t0);

    // Move speaker by 0.03 blocks (below 0.08 threshold) -> suppressed
    engine.updatePlayer({
      ...baseSpeaker,
      x: 10.03,
    });
    const subThreshold = engine.getAudiblePeersFor('listener-1', true, t0 + 100);
    expect(subThreshold).toHaveLength(0);

    // Move speaker by 0.15 blocks (above 0.08 threshold) -> dispatched
    engine.updatePlayer({
      ...baseSpeaker,
      x: 10.18,
    });
    const aboveThreshold = engine.getAudiblePeersFor('listener-1', true, t0 + 200);
    expect(aboveThreshold).toHaveLength(1);
    expect(aboveThreshold[0].peerUuid).toBe('speaker-1');
  });

  it('dispatches when listener yaw changes beyond threshold (2.0 degrees)', () => {
    const t0 = 1000;
    engine.getAudiblePeersFor('listener-1', true, t0);

    // Rotate listener by 1.0 degree -> suppressed
    engine.updatePlayer({
      ...baseListener,
      yaw: 1.0,
    });
    expect(engine.getAudiblePeersFor('listener-1', true, t0 + 100)).toHaveLength(0);

    // Rotate listener by 5.0 degrees -> dispatched
    engine.updatePlayer({
      ...baseListener,
      yaw: 6.0,
    });
    const rotated = engine.getAudiblePeersFor('listener-1', true, t0 + 200);
    expect(rotated).toHaveLength(1);
  });

  it('immediately dispatches when environmental submersion flag changes', () => {
    const t0 = 1000;
    engine.getAudiblePeersFor('listener-1', true, t0);

    // Speaker dives into water without moving position
    engine.updatePlayer({
      ...baseSpeaker,
      isSubmerged: true,
    });

    const submerged = engine.getAudiblePeersFor('listener-1', true, t0 + 100);
    expect(submerged).toHaveLength(1);
    expect(submerged[0].isSubmerged).toBe(true);
  });

  it('emits a periodic heartbeat frame after 2 seconds even if stationary', () => {
    const t0 = 1000;
    engine.getAudiblePeersFor('listener-1', true, t0);

    // 1900ms later: still suppressed
    expect(engine.getAudiblePeersFor('listener-1', true, t0 + 1900)).toHaveLength(0);

    // 2050ms later: heartbeat triggered!
    const heartbeat = engine.getAudiblePeersFor('listener-1', true, t0 + 2050);
    expect(heartbeat).toHaveLength(1);
    expect(heartbeat[0].peerUuid).toBe('speaker-1');
  });

  it('cleans up deadband cache on player disconnect', () => {
    engine.getAudiblePeersFor('listener-1', true, 1000);
    engine.removePlayer('listener-1');

    // Reconnect listener
    engine.updatePlayer(baseListener);
    // Should be treated as a fresh session and dispatched immediately
    const res = engine.getAudiblePeersFor('listener-1', true, 1050);
    expect(res).toHaveLength(1);
  });
});
