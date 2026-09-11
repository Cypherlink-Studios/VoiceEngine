import { PlayerSpatialState, RelativeSpatialAudio } from '../types.js';

export class SpatialEngine {
  private players = new Map<string, PlayerSpatialState>();
  private readonly maxDistance: number;
  private readonly sneakDistance: number;

  constructor(maxDistance = 30.0, sneakDistance = 8.0) {
    this.maxDistance = maxDistance;
    this.sneakDistance = sneakDistance;
  }

  public updatePlayer(state: PlayerSpatialState): void {
    this.players.set(state.uuid, {
      ...state,
      lastUpdated: Date.now(),
    });
  }

  public updateBatch(players: PlayerSpatialState[]): void {
    const now = Date.now();
    for (const p of players) {
      this.players.set(p.uuid, { ...p, lastUpdated: now });
    }
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

    for (const [peerUuid, speaker] of this.players.entries()) {
      if (peerUuid === listenerUuid) {
        continue;
      }

      // Check dimensional isolation
      if (speaker.world !== listener.world) {
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
