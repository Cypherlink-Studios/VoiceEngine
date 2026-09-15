import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialEngine } from '../src/spatial/SpatialEngine.js';
import { PlayerSpatialState } from '../src/types.js';

describe('SpatialEngine', () => {
  let engine: SpatialEngine;

  beforeEach(() => {
    engine = new SpatialEngine(30.0, 8.0);
  });

  it('correctly identifies players within normal 30-block hearing distance', () => {
    const listener: PlayerSpatialState = {
      uuid: 'listener-1',
      username: 'Steve',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const nearbySpeaker: PlayerSpatialState = {
      uuid: 'speaker-1',
      username: 'Alex',
      world: 'world',
      x: 10,
      y: 64,
      z: 10,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const farSpeaker: PlayerSpatialState = {
      uuid: 'speaker-2',
      username: 'FarPlayer',
      world: 'world',
      x: 50,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    engine.updatePlayer(listener);
    engine.updatePlayer(nearbySpeaker);
    engine.updatePlayer(farSpeaker);

    const audible = engine.getAudiblePeersFor('listener-1');
    expect(audible).toHaveLength(1);
    expect(audible[0].peerUuid).toBe('speaker-1');
    expect(audible[0].distance).toBeCloseTo(14.14, 1);
  });

  it('restricts sneaking players to whisper radius (8 blocks)', () => {
    const listener: PlayerSpatialState = {
      uuid: 'listener-1',
      username: 'Steve',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const sneakWhisperClose: PlayerSpatialState = {
      uuid: 'sneaker-close',
      username: 'NinjaClose',
      world: 'world',
      x: 5,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: true,
      isSubmerged: false,
    };

    const sneakWhisperTooFar: PlayerSpatialState = {
      uuid: 'sneaker-far',
      username: 'NinjaFar',
      world: 'world',
      x: 12,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: true,
      isSubmerged: false,
    };

    engine.updatePlayer(listener);
    engine.updatePlayer(sneakWhisperClose);
    engine.updatePlayer(sneakWhisperTooFar);

    const audible = engine.getAudiblePeersFor('listener-1');
    expect(audible).toHaveLength(1);
    expect(audible[0].peerUuid).toBe('sneaker-close');
  });

  it('enforces dimensional isolation even with matching coordinates', () => {
    const overworldPlayer: PlayerSpatialState = {
      uuid: 'overworld-1',
      username: 'Steve',
      world: 'world',
      x: 100,
      y: 64,
      z: 100,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const netherPlayer: PlayerSpatialState = {
      uuid: 'nether-1',
      username: 'Alex',
      world: 'world_nether',
      x: 100,
      y: 64,
      z: 100,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    engine.updatePlayer(overworldPlayer);
    engine.updatePlayer(netherPlayer);

    expect(engine.getAudiblePeersFor('overworld-1')).toHaveLength(0);
    expect(engine.getAudiblePeersFor('nether-1')).toHaveLength(0);
  });

  it('sets submerged acoustic damping flag when either player is in water', () => {
    const dryListener: PlayerSpatialState = {
      uuid: 'dry-1',
      username: 'Steve',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const wetSpeaker: PlayerSpatialState = {
      uuid: 'wet-1',
      username: 'AlexDiver',
      world: 'world',
      x: 3,
      y: 62,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: true,
    };

    engine.updatePlayer(dryListener);
    engine.updatePlayer(wetSpeaker);

    const audible = engine.getAudiblePeersFor('dry-1');
    expect(audible).toHaveLength(1);
    expect(audible[0].isSubmerged).toBe(true);
  });

  it('enforces server isolation when players share the same world name and coordinates', () => {
    const lobbyPlayer: PlayerSpatialState = {
      uuid: 'player-lobby',
      username: 'LobbySteve',
      serverId: 'lobby',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const survivalPlayer: PlayerSpatialState = {
      uuid: 'player-survival',
      username: 'SurvivalAlex',
      serverId: 'survival',
      world: 'world',
      x: 2,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const sameServerPeer: PlayerSpatialState = {
      uuid: 'player-lobby-2',
      username: 'LobbyBob',
      serverId: 'lobby',
      world: 'world',
      x: 3,
      y: 64,
      z: 0,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    engine.updatePlayer(lobbyPlayer);
    engine.updatePlayer(survivalPlayer);
    engine.updatePlayer(sameServerPeer);

    const audibleForLobby = engine.getAudiblePeersFor('player-lobby');
    expect(audibleForLobby).toHaveLength(1);
    expect(audibleForLobby[0].peerUuid).toBe('player-lobby-2');

    const audibleForSurvival = engine.getAudiblePeersFor('player-survival');
    expect(audibleForSurvival).toHaveLength(0);
  });

  it('delivers 2D broadcast audio (relX: 0, relY: 0, relZ: 0) to listeners within speaker block radius', () => {
    const listener: PlayerSpatialState = {
      uuid: 'listener-1',
      username: 'ListenerBob',
      world: 'world',
      x: 10,
      y: 64,
      z: 10,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const speakerPlayer: PlayerSpatialState = {
      uuid: 'speaker-player-1',
      username: 'StaffAlice',
      world: 'world',
      x: 500, // Very far away in 3D proximity!
      y: 64,
      z: 500,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    engine.updatePlayer(listener);
    engine.updatePlayer(speakerPlayer);

    // Add an active speaker block near the listener (at 12, 64, 12, radius: 20)
    engine.updateSpeakers([
      {
        id: 'speaker-town-hall',
        world: 'world',
        x: 12,
        y: 64,
        z: 12,
        radius: 20,
        linkedPlayerUuid: 'speaker-player-1',
        powered: true,
      },
    ]);

    const audible = engine.getAudiblePeersFor('listener-1');
    expect(audible).toHaveLength(1);
    expect(audible[0].peerUuid).toBe('speaker-player-1');
    expect(audible[0].isBroadcast).toBe(true);
    expect(audible[0].relX).toBe(0);
    expect(audible[0].relY).toBe(0);
    expect(audible[0].relZ).toBe(0);
  });

  it('prioritizes 2D megaphone broadcast over direct 3D proximity when within range of both', () => {
    const listener: PlayerSpatialState = {
      uuid: 'listener-1',
      username: 'ListenerBob',
      world: 'world',
      x: 10,
      y: 64,
      z: 10,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const speakerPlayer: PlayerSpatialState = {
      uuid: 'speaker-player-1',
      username: 'StaffAlice',
      world: 'world',
      x: 15, // Close enough for direct 3D proximity (distance 5 blocks)
      y: 64,
      z: 10,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    engine.updatePlayer(listener);
    engine.updatePlayer(speakerPlayer);

    // Also link to an active speaker block right next to listener
    engine.updateSpeakers([
      {
        id: 'speaker-main',
        world: 'world',
        x: 10,
        y: 64,
        z: 10,
        radius: 30,
        linkedPlayerUuid: 'speaker-player-1',
        powered: true,
      },
    ]);

    const audible = engine.getAudiblePeersFor('listener-1');
    // Exactly 1 entry (not duplicated into both proximity and broadcast)
    expect(audible).toHaveLength(1);
    expect(audible[0].peerUuid).toBe('speaker-player-1');
    expect(audible[0].isBroadcast).toBe(true);
    expect(audible[0].relX).toBe(0);
    expect(audible[0].relY).toBe(0);
    expect(audible[0].relZ).toBe(0);
  });

  it('does not broadcast from unpowered speaker blocks', () => {
    const listener: PlayerSpatialState = {
      uuid: 'listener-1',
      username: 'ListenerBob',
      world: 'world',
      x: 10,
      y: 64,
      z: 10,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    const speakerPlayer: PlayerSpatialState = {
      uuid: 'speaker-player-1',
      username: 'StaffAlice',
      world: 'world',
      x: 500, // Far away
      y: 64,
      z: 500,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    engine.updatePlayer(listener);
    engine.updatePlayer(speakerPlayer);

    // Unpowered speaker
    engine.updateSpeakers([
      {
        id: 'speaker-unpowered',
        world: 'world',
        x: 10,
        y: 64,
        z: 10,
        radius: 20,
        linkedPlayerUuid: 'speaker-player-1',
        powered: false,
      },
    ]);

    const audible = engine.getAudiblePeersFor('listener-1');
    expect(audible).toHaveLength(0);
  });

  it('correctly tracks and isolates partitions when players switch worlds or servers', () => {
    const player: PlayerSpatialState = {
      uuid: 'player-world-hopper',
      username: 'Hopper',
      world: 'world',
      serverId: 'survival',
      x: 10,
      y: 64,
      z: 10,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    };

    engine.updatePlayer(player);
    expect(engine.getPartitionCount()).toBe(1);
    expect(engine.getActiveCellCount()).toBe(1);

    // Player switches to the Nether
    engine.updatePlayer({
      ...player,
      world: 'world_nether',
      x: 100,
      y: 64,
      z: 100,
    });

    expect(engine.getPartitionCount()).toBe(1); // Old empty partition cleaned up
    expect(engine.getActiveCellCount()).toBe(1);

    // Remove player completely
    engine.removePlayer('player-world-hopper');
    expect(engine.getPartitionCount()).toBe(0);
    expect(engine.getActiveCellCount()).toBe(0);
  });
});

