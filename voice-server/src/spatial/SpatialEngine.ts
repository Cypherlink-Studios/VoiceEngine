import { PlayerSpatialState, RelativeSpatialAudio, SpeakerBlockState } from '../types.js';

export class SpatialEngine {
  private players = new Map<string, PlayerSpatialState>();
  private speakers = new Map<string, SpeakerBlockState>();
  private maxDistance: number;
  private sneakDistance: number;

  constructor(maxDistance = 30.0, sneakDistance = 8.0) {
    this.maxDistance = maxDistance;
    this.sneakDistance = sneakDistance;
  }

  public updateDistances(maxDistance: number, sneakDistance: number): void {
    this.maxDistance = maxDistance;
    this.sneakDistance = sneakDistance;
  }

  public updatePlayer(state: PlayerSpatialState): void {
    this.players.set(state.uuid, {
      ...state,
      lastUpdated: Date.now(),
    });
  }

  public updateBatch(players: PlayerSpatialState[], speakers?: SpeakerBlockState[]): void {
    const now = Date.now();
    for (const p of players) {
      this.players.set(p.uuid, { ...p, lastUpdated: now });
    }
    if (speakers) {
      this.updateSpeakers(speakers);
    }
  }

  public updateSpeakers(speakers: SpeakerBlockState[]): void {
    this.speakers.clear();
    for (const s of speakers) {
      this.speakers.set(s.id, s);
    }
  }

  public getSpeakers(): SpeakerBlockState[] {
    return Array.from(this.speakers.values());
  }

  public removePlayer(uuid: string): void {
    this.players.delete(uuid);
  }

  public getPlayer(uuid: string): PlayerSpatialState | undefined {
    return this.players.get(uuid);
  }

  public getAllPlayers(): PlayerSpatialState[] {
    return Array.from(this.players.values());
  }

  /**
   * Calculates Euclidean distance and relative positioning of all audible peers for a listener.
   */
  public getAudiblePeersFor(listenerUuid: string): RelativeSpatialAudio[] {
    const listener = this.players.get(listenerUuid);
    if (!listener) {
      return [];
    }

    const audiblePeers: RelativeSpatialAudio[] = [];
    const broadcastSpeakers = new Map<string, number>();

    // 1. Check if listener is within radius of any active, powered speaker block
    for (const speakerBlock of this.speakers.values()) {
      if (!speakerBlock.powered || !speakerBlock.linkedPlayerUuid) {
        continue;
      }
      if (speakerBlock.linkedPlayerUuid === listenerUuid) {
        continue; // A player does not receive their own megaphone broadcast
      }

      const speakerServer = speakerBlock.serverId || 'default';
      const listenerServer = listener.serverId || 'default';
      if (speakerServer !== listenerServer || speakerBlock.world !== listener.world) {
        continue;
      }

      const dx = speakerBlock.x - listener.x;
      const dy = speakerBlock.y - listener.y;
      const dz = speakerBlock.z - listener.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= speakerBlock.radius) {
        const existing = broadcastSpeakers.get(speakerBlock.linkedPlayerUuid);
        if (existing === undefined || dist < existing) {
          broadcastSpeakers.set(speakerBlock.linkedPlayerUuid, dist);
        }
      }
    }

    // Add broadcast audio with relX: 0, relY: 0, relZ: 0 and isBroadcast: true
    for (const [linkedUuid, dist] of broadcastSpeakers.entries()) {
      const linkedPlayer = this.players.get(linkedUuid);
      if (linkedPlayer) {
        audiblePeers.push({
          peerUuid: linkedPlayer.uuid,
          peerUsername: linkedPlayer.username,
          distance: Math.round(dist * 100) / 100,
          isAudible: true,
          isSubmerged: false,
          relX: 0,
          relY: 0,
          relZ: 0,
          isBroadcast: true,
        });
      }
    }

    // 2. Evaluate direct proximity peers (skipping peers receiving 2D broadcast)
    for (const [peerUuid, speaker] of this.players.entries()) {
      if (peerUuid === listenerUuid) {
        continue;
      }
      if (broadcastSpeakers.has(peerUuid)) {
        // Megaphone broadcast overrides direct proximity
        continue;
      }

      // Check dimensional and server isolation
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

      // Transform world offset (dx, dy, dz) to listener local heading
      // Minecraft Yaw: 0 is South (+Z), 90 is West (-X), 180 is North (-Z), 270 is East (+X)
      const rad = (listener.yaw * Math.PI) / 180.0;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Rotate around Y-axis into listener's local coordinates:
      // X = right, Y = up, Z = forward
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
