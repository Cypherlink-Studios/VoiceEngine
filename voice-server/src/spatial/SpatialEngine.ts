import { PlayerSpatialState, RelativeSpatialAudio, SpeakerBlockState } from '../types.js';
import { SpatialGridIndex } from './SpatialGridIndex.js';

export interface LastDispatchedPeerState {
  listenerX: number;
  listenerY: number;
  listenerZ: number;
  speakerX: number;
  speakerY: number;
  speakerZ: number;
  yaw: number;
  relX: number;
  relY: number;
  relZ: number;
  distance: number;
  isSubmerged: boolean;
  isPaused: boolean;
  isBroadcast: boolean;
  timestamp: number;
}

export class SpatialEngine {
  private players = new Map<string, PlayerSpatialState>();
  private speakers = new Map<string, SpeakerBlockState>();
  private spatialIndices = new Map<string, SpatialGridIndex<string>>();
  private maxDistance: number;
  private sneakDistance: number;
  private maxDistanceSq: number;
  private sneakDistanceSq: number;

  // Deadband delta suppression settings
  private deadbandDistance = 0.08;
  private deadbandDistanceSq = 0.08 * 0.08;
  private deadbandYaw = 2.0;
  private forceHeartbeatMs = 2000;
  private lastDispatched = new Map<string, Map<string, LastDispatchedPeerState>>();

  private totalAudibleEvaluated = 0;
  private deadbandSuppressedCount = 0;
  private spectatorMode: 'all' | 'listen-only' | 'isolated' = 'listen-only';

  constructor(
    maxDistance = 30.0,
    sneakDistance = 8.0,
    deadbandDistance = 0.08,
    deadbandYaw = 2.0,
    spectatorMode: 'all' | 'listen-only' | 'isolated' = 'listen-only'
  ) {
    this.maxDistance = maxDistance;
    this.sneakDistance = sneakDistance;
    this.maxDistanceSq = maxDistance * maxDistance;
    this.sneakDistanceSq = sneakDistance * sneakDistance;
    this.spectatorMode = spectatorMode;
    this.updateDeadband(deadbandDistance, deadbandYaw);
  }

  public setSpectatorMode(mode: 'all' | 'listen-only' | 'isolated'): void {
    this.spectatorMode = mode;
  }

  public getSpectatorMode(): 'all' | 'listen-only' | 'isolated' {
    return this.spectatorMode;
  }

  public updateDistances(maxDistance: number, sneakDistance: number): void {
    this.maxDistance = maxDistance;
    this.sneakDistance = sneakDistance;
    this.maxDistanceSq = maxDistance * maxDistance;
    this.sneakDistanceSq = sneakDistance * sneakDistance;
  }

  public updateDeadband(distance: number, yaw: number, heartbeatMs = 2000): void {
    this.deadbandDistance = Math.max(0, distance);
    this.deadbandDistanceSq = this.deadbandDistance * this.deadbandDistance;
    this.deadbandYaw = Math.max(0, yaw);
    this.forceHeartbeatMs = Math.max(500, heartbeatMs);
  }

  private getPartitionKey(serverId: string | undefined, world: string): string {
    return `${serverId || 'default'}:${world}`;
  }

  private getOrCreateIndex(serverId: string | undefined, world: string): SpatialGridIndex<string> {
    const key = this.getPartitionKey(serverId, world);
    let index = this.spatialIndices.get(key);
    if (!index) {
      index = new SpatialGridIndex<string>(Math.max(this.maxDistance, 32.0));
      this.spatialIndices.set(key, index);
    }
    return index;
  }

  public updatePlayer(state: PlayerSpatialState): void {
    const prev = this.players.get(state.uuid);
    const newPartitionKey = this.getPartitionKey(state.serverId, state.world);

    if (prev) {
      const prevPartitionKey = this.getPartitionKey(prev.serverId, prev.world);
      if (prevPartitionKey !== newPartitionKey) {
        const oldIndex = this.spatialIndices.get(prevPartitionKey);
        if (oldIndex) {
          oldIndex.remove(state.uuid);
          if (oldIndex.getItemCount() === 0) {
            this.spatialIndices.delete(prevPartitionKey);
          }
        }
      }
    }

    const index = this.getOrCreateIndex(state.serverId, state.world);
    index.update(state.uuid, state.x, state.y, state.z);

    this.players.set(state.uuid, {
      ...state,
      lastUpdated: Date.now(),
    });
  }

  public updateBatch(players: PlayerSpatialState[], speakers?: SpeakerBlockState[]): void {
    const now = Date.now();
    for (const p of players) {
      const prev = this.players.get(p.uuid);
      const newPartitionKey = this.getPartitionKey(p.serverId, p.world);

      if (prev) {
        const prevPartitionKey = this.getPartitionKey(prev.serverId, prev.world);
        if (prevPartitionKey !== newPartitionKey) {
          const oldIndex = this.spatialIndices.get(prevPartitionKey);
          if (oldIndex) {
            oldIndex.remove(p.uuid);
            if (oldIndex.getItemCount() === 0) {
              this.spatialIndices.delete(prevPartitionKey);
            }
          }
        }
      }

      const index = this.getOrCreateIndex(p.serverId, p.world);
      index.update(p.uuid, p.x, p.y, p.z);
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
    const player = this.players.get(uuid);
    if (player) {
      const partitionKey = this.getPartitionKey(player.serverId, player.world);
      const index = this.spatialIndices.get(partitionKey);
      if (index) {
        index.remove(uuid);
        if (index.getItemCount() === 0) {
          this.spatialIndices.delete(partitionKey);
        }
      }
      this.players.delete(uuid);
    }

    // Clean up deadband cache
    this.lastDispatched.delete(uuid);
    for (const listenerMap of this.lastDispatched.values()) {
      listenerMap.delete(uuid);
    }
  }

  public clearListenerHistory(listenerUuid: string): void {
    this.lastDispatched.delete(listenerUuid);
  }

  public getPlayer(uuid: string): PlayerSpatialState | undefined {
    return this.players.get(uuid);
  }

  public getAllPlayers(): PlayerSpatialState[] {
    return Array.from(this.players.values());
  }

  public getActiveCellCount(): number {
    let count = 0;
    for (const index of this.spatialIndices.values()) {
      count += index.getCellCount();
    }
    return count;
  }

  public getPartitionCount(): number {
    return this.spatialIndices.size;
  }

  public getSuppressionStats(): { totalEvaluated: number; suppressed: number; ratio: number } {
    const ratio = this.totalAudibleEvaluated > 0
      ? this.deadbandSuppressedCount / this.totalAudibleEvaluated
      : 0;
    return {
      totalEvaluated: this.totalAudibleEvaluated,
      suppressed: this.deadbandSuppressedCount,
      ratio: Math.round(ratio * 10000) / 10000,
    };
  }

  public resetSuppressionStats(): void {
    this.totalAudibleEvaluated = 0;
    this.deadbandSuppressedCount = 0;
  }

  /**
   * Calculates Euclidean distance and relative positioning of all audible peers for a listener.
   * Utilizes 3D spatial grid hashing with squared-distance pre-filtering and configurable deadband suppression.
   */
  public getAudiblePeersFor(listenerUuid: string, applyDeadband = false, now = Date.now()): RelativeSpatialAudio[] {
    return this.getAudiblePeersEvaluation(listenerUuid, applyDeadband, now).updates;
  }

  /**
   * Evaluates all audible peers for a listener, returning the full set of currently audible peer UUIDs
   * along with the list of spatial updates that passed the deadband suppression filter.
   */
  public getAudiblePeersEvaluation(
    listenerUuid: string,
    applyDeadband = false,
    now = Date.now()
  ): {
    audiblePeerUuids: Set<string>;
    updates: RelativeSpatialAudio[];
  } {
    const listener = this.players.get(listenerUuid);
    if (!listener) {
      return { audiblePeerUuids: new Set(), updates: [] };
    }

    const audiblePeers: RelativeSpatialAudio[] = [];
    const audiblePeerUuids = new Set<string>();
    const broadcastSpeakers = new Map<string, number>();

    let listenerDeadbandMap: Map<string, LastDispatchedPeerState> | undefined;
    if (applyDeadband) {
      listenerDeadbandMap = this.lastDispatched.get(listenerUuid);
      if (!listenerDeadbandMap) {
        listenerDeadbandMap = new Map();
        this.lastDispatched.set(listenerUuid, listenerDeadbandMap);
      }
    }

    // 1. Check if listener is within radius of any active, powered speaker block
    if (this.speakers.size > 0) {
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
        const distSq = dx * dx + dy * dy + dz * dz;
        const radiusSq = speakerBlock.radius * speakerBlock.radius;

        if (distSq <= radiusSq) {
          const dist = Math.sqrt(distSq);
          const existing = broadcastSpeakers.get(speakerBlock.linkedPlayerUuid);
          if (existing === undefined || dist < existing) {
            broadcastSpeakers.set(speakerBlock.linkedPlayerUuid, dist);
          }
        }
      }
    }

    // Add broadcast audio with relX: 0, relY: 0, relZ: 0 and isBroadcast: true
    for (const [linkedUuid, dist] of broadcastSpeakers.entries()) {
      const linkedPlayer = this.players.get(linkedUuid);
      if (linkedPlayer) {
        const speakerIsSpectator = Boolean(linkedPlayer.isSpectator);
        const listenerIsSpectator = Boolean(listener.isSpectator);

        if (this.spectatorMode === 'listen-only') {
          if (speakerIsSpectator && !listenerIsSpectator) {
            continue;
          }
        } else if (this.spectatorMode === 'isolated') {
          if (speakerIsSpectator !== listenerIsSpectator) {
            continue;
          }
        }

        audiblePeerUuids.add(linkedPlayer.uuid);
        if (applyDeadband && listenerDeadbandMap) {
          this.totalAudibleEvaluated++;
          const last = listenerDeadbandMap.get(linkedUuid);
          if (last) {
            const timeElapsed = now - last.timestamp;
            const heartbeatDue = timeElapsed >= this.forceHeartbeatMs;
            const listenerMovedSq =
              (listener.x - last.listenerX) ** 2 +
              (listener.y - last.listenerY) ** 2 +
              (listener.z - last.listenerZ) ** 2;
            const wasBroadcast = last.isBroadcast;

            if (!heartbeatDue && listenerMovedSq < this.deadbandDistanceSq && wasBroadcast) {
              this.deadbandSuppressedCount++;
              continue; // Suppressed
            }
          }

          listenerDeadbandMap.set(linkedUuid, {
            listenerX: listener.x,
            listenerY: listener.y,
            listenerZ: listener.z,
            speakerX: linkedPlayer.x,
            speakerY: linkedPlayer.y,
            speakerZ: linkedPlayer.z,
            yaw: listener.yaw,
            relX: 0,
            relY: 0,
            relZ: 0,
            distance: Math.round(dist * 100) / 100,
            isSubmerged: false,
            isPaused: false,
            isBroadcast: true,
            timestamp: now,
          });
        }

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

    // 2. Query 3D Spatial Grid Index for adjacent candidate peers in the same world partition
    const listenerServer = listener.serverId || 'default';
    const partitionKey = this.getPartitionKey(listenerServer, listener.world);
    const spatialIndex = this.spatialIndices.get(partitionKey);

    if (!spatialIndex) {
      return { audiblePeerUuids, updates: audiblePeers };
    }

    let hasComputedTrig = false;
    let cos = 1;
    let sin = 0;

    spatialIndex.forEachNearby(listener.x, listener.y, listener.z, (peerUuid) => {
      if (peerUuid === listenerUuid) {
        return;
      }
      if (broadcastSpeakers.has(peerUuid)) {
        // Megaphone broadcast overrides direct proximity
        return;
      }

      const speaker = this.players.get(peerUuid);
      if (!speaker) {
        return;
      }

      // Spectator isolation and routing rules
      const speakerIsSpectator = Boolean(speaker.isSpectator);
      const listenerIsSpectator = Boolean(listener.isSpectator);

      if (this.spectatorMode === 'listen-only') {
        if (speakerIsSpectator && !listenerIsSpectator) {
          return;
        }
      } else if (this.spectatorMode === 'isolated') {
        if (speakerIsSpectator !== listenerIsSpectator) {
          return;
        }
      }

      // Pre-filter with squared Euclidean distance (avoids Math.sqrt for non-audible players)
      const dx = speaker.x - listener.x;
      const dy = speaker.y - listener.y;
      const dz = speaker.z - listener.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      const maxRangeSq = speaker.isSneaking ? this.sneakDistanceSq : this.maxDistanceSq;
      if (distSq > maxRangeSq) {
        return;
      }

      audiblePeerUuids.add(peerUuid);

      if (!hasComputedTrig) {
        const rad = (listener.yaw * Math.PI) / 180.0;
        cos = Math.cos(rad);
        sin = Math.sin(rad);
        hasComputedTrig = true;
      }

      const distance = Math.sqrt(distSq);

      // Rotate around Y-axis into listener's local coordinates:
      // X = right, Y = up, Z = forward
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      const localY = dy;

      const isSubmerged = speaker.isSubmerged || listener.isSubmerged;

      if (applyDeadband && listenerDeadbandMap) {
        this.totalAudibleEvaluated++;
        const last = listenerDeadbandMap.get(peerUuid);
        if (last) {
          const flagsChanged =
            last.isSubmerged !== isSubmerged ||
            last.isBroadcast !== false;

          const timeElapsed = now - last.timestamp;
          const heartbeatDue = timeElapsed >= this.forceHeartbeatMs;

          const listenerMovedSq =
            (listener.x - last.listenerX) ** 2 +
            (listener.y - last.listenerY) ** 2 +
            (listener.z - last.listenerZ) ** 2;

          const speakerMovedSq =
            (speaker.x - last.speakerX) ** 2 +
            (speaker.y - last.speakerY) ** 2 +
            (speaker.z - last.speakerZ) ** 2;

          let yawDelta = Math.abs(listener.yaw - last.yaw) % 360;
          if (yawDelta > 180) yawDelta = 360 - yawDelta;

          const movedBeyondDeadband =
            listenerMovedSq >= this.deadbandDistanceSq ||
            speakerMovedSq >= this.deadbandDistanceSq ||
            yawDelta >= this.deadbandYaw;

          if (!flagsChanged && !heartbeatDue && !movedBeyondDeadband) {
            this.deadbandSuppressedCount++;
            return; // Suppressed by deadband!
          }
        }

        listenerDeadbandMap.set(peerUuid, {
          listenerX: listener.x,
          listenerY: listener.y,
          listenerZ: listener.z,
          speakerX: speaker.x,
          speakerY: speaker.y,
          speakerZ: speaker.z,
          yaw: listener.yaw,
          relX: Math.round(localX * 100) / 100,
          relY: Math.round(localY * 100) / 100,
          relZ: Math.round(localZ * 100) / 100,
          distance: Math.round(distance * 100) / 100,
          isSubmerged,
          isPaused: false,
          isBroadcast: false,
          timestamp: now,
        });
      }

      audiblePeers.push({
        peerUuid,
        peerUsername: speaker.username,
        distance: Math.round(distance * 100) / 100,
        isAudible: true,
        isSubmerged,
        relX: Math.round(localX * 100) / 100,
        relY: Math.round(localY * 100) / 100,
        relZ: Math.round(localZ * 100) / 100,
      });
    });

    return { audiblePeerUuids, updates: audiblePeers };
  }
}
