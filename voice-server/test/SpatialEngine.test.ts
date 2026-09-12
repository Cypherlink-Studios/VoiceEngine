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
});
