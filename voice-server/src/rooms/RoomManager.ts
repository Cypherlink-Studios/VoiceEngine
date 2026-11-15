import { TemporaryRoom, TemporaryRoomMember } from '../types.js';

interface FailedAttemptRecord {
  count: number;
  lockedUntil?: number;
  timestamps: number[];
}

export interface RoomOperationResult {
  success: boolean;
  error?: 'invalid_pin' | 'room_full' | 'rate_limited' | 'not_in_room' | 'not_owner' | 'player_not_found' | 'already_in_room';
  message?: string;
  room?: TemporaryRoom;
  retryAfterSeconds?: number;
  newOwnerUuid?: string;
  kickedMember?: TemporaryRoomMember;
}

export class RoomManager {
  private roomsByPin = new Map<string, TemporaryRoom>();
  private roomsById = new Map<string, TemporaryRoom>();
  private playerToRoomId = new Map<string, string>(); // playerUuid -> roomId

  // Rate limiting: key -> FailedAttemptRecord
  private failedAttempts = new Map<string, FailedAttemptRecord>();
  private readonly maxFailedAttempts = 5;
  private readonly windowMs = 60000; // 1 minute window
  private readonly lockoutMs = 60000; // 1 minute lockout
  private readonly emptyGracePeriodMs: number; // grace period before destroying empty room

  // Configurable default max members (0 = unlimited)
  private defaultMaxMembers = 0;

  constructor(defaultMaxMembers = 0, emptyGracePeriodMs = 30000) {
    this.defaultMaxMembers = defaultMaxMembers;
    this.emptyGracePeriodMs = emptyGracePeriodMs;
  }

  public setDefaultMaxMembers(limit: number): void {
    this.defaultMaxMembers = Math.max(0, limit);
  }

  public getDefaultMaxMembers(): number {
    return this.defaultMaxMembers;
  }

  /**
   * Generates a unique, collision-free 6-digit numeric PIN.
   */
  public generatePin(): string {
    let pin = '';
    let attempts = 0;
    while (attempts < 1000) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      if (!this.roomsByPin.has(pin)) {
        return pin;
      }
      attempts++;
    }
    // Fallback timestamp slice if saturated
    return (Date.now() % 1000000).toString().padStart(6, '0');
  }

  /**
   * Creates a new temporary room and assigns the caller as owner.
   */
  public createRoom(
    ownerUuid: string,
    ownerUsername: string,
    maxMembers: number = this.defaultMaxMembers
  ): { room: TemporaryRoom; pin: string } {
    // If player is already in a room, leave it first
    if (this.playerToRoomId.has(ownerUuid)) {
      this.leaveRoom(ownerUuid);
    }

    const pin = this.generatePin();
    const id = `room_${pin}`;
    const now = Date.now();

    const room: TemporaryRoom = {
      id,
      pin,
      ownerUuid,
      createdAt: now,
      maxMembers: Math.max(0, maxMembers),
      members: new Map<string, TemporaryRoomMember>(),
    };

    const ownerMember: TemporaryRoomMember = {
      playerUuid: ownerUuid,
      username: ownerUsername,
      joinedAt: now,
      isSpeaking: false,
    };

    room.members.set(ownerUuid, ownerMember);
    this.roomsByPin.set(pin, room);
    this.roomsById.set(id, room);
    this.playerToRoomId.set(ownerUuid, id);

    return { room, pin };
  }

  /**
   * Verifies rate limit for an identifier (IP or UUID).
   */
  private checkRateLimit(key: string, now: number): { allowed: boolean; retryAfterSeconds?: number } {
    const record = this.failedAttempts.get(key);
    if (!record) {
      return { allowed: true };
    }

    if (record.lockedUntil && record.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    // Clean up expired timestamps outside window
    record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);
    record.count = record.timestamps.length;
    if (record.lockedUntil && record.lockedUntil <= now) {
      delete record.lockedUntil;
    }

    return { allowed: true };
  }

  /**
   * Records a failed join attempt against rate limits.
   */
  private recordFailedAttempt(key: string, now: number): void {
    let record = this.failedAttempts.get(key);
    if (!record) {
      record = { count: 0, timestamps: [] };
      this.failedAttempts.set(key, record);
    }
    record.timestamps.push(now);
    record.count = record.timestamps.length;

    if (record.count >= this.maxFailedAttempts) {
      record.lockedUntil = now + this.lockoutMs;
    }
  }

  /**
   * Clears failed attempt counters upon successful authentication.
   */
  private clearFailedAttempts(key: string): void {
    this.failedAttempts.delete(key);
  }

  /**
   * Attempts to join an active room via 6-digit PIN.
   */
  public joinRoom(
    pin: string,
    playerUuid: string,
    username: string,
    clientIp?: string
  ): RoomOperationResult {
    const now = Date.now();
    const cleanPin = (pin || '').trim();

    // Check rate limit by playerUuid and clientIp
    const uuidLimit = this.checkRateLimit(`uuid:${playerUuid}`, now);
    if (!uuidLimit.allowed) {
      return {
        success: false,
        error: 'rate_limited',
        message: 'Too many failed attempts. Please wait before trying again.',
        retryAfterSeconds: uuidLimit.retryAfterSeconds,
      };
    }

    if (clientIp) {
      const ipLimit = this.checkRateLimit(`ip:${clientIp}`, now);
      if (!ipLimit.allowed) {
        return {
          success: false,
          error: 'rate_limited',
          message: 'Too many failed attempts from your IP. Please wait before trying again.',
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        };
      }
    }

    const room = this.roomsByPin.get(cleanPin);
    if (!room) {
      this.recordFailedAttempt(`uuid:${playerUuid}`, now);
      if (clientIp) {
        this.recordFailedAttempt(`ip:${clientIp}`, now);
      }
      return {
        success: false,
        error: 'invalid_pin',
        message: 'Room not found with the provided 6-digit PIN.',
      };
    }

    // Success on PIN: clear failure history
    this.clearFailedAttempts(`uuid:${playerUuid}`);
    if (clientIp) {
      this.clearFailedAttempts(`ip:${clientIp}`);
    }

    // Check capacity (excluding spies from count)
    const nonSpyCount = Array.from(room.members.values()).filter((m) => !m.isSpy).length;
    if (room.maxMembers > 0 && nonSpyCount >= room.maxMembers) {
      return {
        success: false,
        error: 'room_full',
        message: 'The room has reached maximum capacity.',
      };
    }

    // Leave any previous room
    if (this.playerToRoomId.has(playerUuid)) {
      this.leaveRoom(playerUuid);
    }

    // Cancel empty grace timer if active
    if (room.emptyTimeout) {
      clearTimeout(room.emptyTimeout);
      room.emptyTimeout = undefined;
    }

    const member: TemporaryRoomMember = {
      playerUuid,
      username,
      joinedAt: now,
      isSpeaking: false,
    };

    room.members.set(playerUuid, member);
    this.playerToRoomId.set(playerUuid, room.id);

    return {
      success: true,
      room,
    };
  }

  /**
   * Leaves current room, transferring ownership if needed or starting empty grace cleanup.
   */
  public leaveRoom(playerUuid: string): {
    left: boolean;
    room?: TemporaryRoom;
    newOwnerUuid?: string;
    destroyed: boolean;
  } {
    const roomId = this.playerToRoomId.get(playerUuid);
    if (!roomId) {
      return { left: false, destroyed: false };
    }

    const room = this.roomsById.get(roomId);
    this.playerToRoomId.delete(playerUuid);

    if (!room) {
      return { left: true, destroyed: true };
    }

    room.members.delete(playerUuid);

    let newOwnerUuid: string | undefined;

    // Filter remaining active non-spy members
    const remainingMembers = Array.from(room.members.values()).filter((m) => !m.isSpy);

    if (remainingMembers.length === 0) {
      // Room is completely empty of non-spies -> start 30s grace period
      if (room.emptyTimeout) {
        clearTimeout(room.emptyTimeout);
      }
      room.emptyTimeout = setTimeout(() => {
        this.destroyRoom(room.id);
      }, this.emptyGracePeriodMs);

      return { left: true, room, destroyed: false };
    }

    // If owner left, transfer ownership to the oldest joined remaining member
    if (room.ownerUuid === playerUuid) {
      remainingMembers.sort((a, b) => a.joinedAt - b.joinedAt);
      newOwnerUuid = remainingMembers[0].playerUuid;
      room.ownerUuid = newOwnerUuid;
    }

    return { left: true, room, newOwnerUuid, destroyed: false };
  }

  /**
   * Kicks a member from a room (owner only).
   */
  public kickMember(ownerUuid: string, targetUuid: string): RoomOperationResult {
    const roomId = this.playerToRoomId.get(ownerUuid);
    if (!roomId) {
      return { success: false, error: 'not_in_room', message: 'You are not in a room.' };
    }

    const room = this.roomsById.get(roomId);
    if (!room) {
      return { success: false, error: 'not_in_room', message: 'Room not found.' };
    }

    if (room.ownerUuid !== ownerUuid) {
      return { success: false, error: 'not_owner', message: 'Only the room owner can kick members.' };
    }

    const kickedMember = room.members.get(targetUuid);
    if (!kickedMember) {
      return { success: false, error: 'player_not_found', message: 'Target player is not in your room.' };
    }

    this.leaveRoom(targetUuid);

    return {
      success: true,
      room,
      kickedMember,
    };
  }

  /**
   * Wiretaps an active room silently by target player username or UUID.
   */
  public spyRoom(
    staffUuid: string,
    staffUsername: string,
    targetPlayer: string
  ): RoomOperationResult {
    const cleanTarget = targetPlayer.trim().toLowerCase();

    // Find the room occupied by target
    let targetRoom: TemporaryRoom | undefined;

    // Check by target UUID directly
    const directRoomId = this.playerToRoomId.get(targetPlayer);
    if (directRoomId) {
      targetRoom = this.roomsById.get(directRoomId);
    } else {
      // Search by username
      for (const room of this.roomsById.values()) {
        for (const member of room.members.values()) {
          if (member.username.toLowerCase() === cleanTarget || member.playerUuid === cleanTarget) {
            targetRoom = room;
            break;
          }
        }
        if (targetRoom) break;
      }
    }

    if (!targetRoom) {
      return {
        success: false,
        error: 'player_not_found',
        message: `Player "${targetPlayer}" is not currently in any temporary room.`,
      };
    }

    // Leave previous room if any
    if (this.playerToRoomId.has(staffUuid)) {
      this.leaveRoom(staffUuid);
    }

    const spyMember: TemporaryRoomMember = {
      playerUuid: staffUuid,
      username: staffUsername,
      joinedAt: Date.now(),
      isSpeaking: false,
      isSpy: true,
    };

    targetRoom.members.set(staffUuid, spyMember);
    this.playerToRoomId.set(staffUuid, targetRoom.id);

    return {
      success: true,
      room: targetRoom,
    };
  }

  /**
   * Destroys an active room immediately, clearing timers and lookups.
   */
  public destroyRoom(roomId: string): boolean {
    const room = this.roomsById.get(roomId);
    if (!room) {
      return false;
    }

    if (room.emptyTimeout) {
      clearTimeout(room.emptyTimeout);
      room.emptyTimeout = undefined;
    }

    for (const memberUuid of room.members.keys()) {
      this.playerToRoomId.delete(memberUuid);
    }

    this.roomsByPin.delete(room.pin);
    this.roomsById.delete(roomId);
    return true;
  }

  public getRoomByPin(pin: string): TemporaryRoom | undefined {
    return this.roomsByPin.get((pin || '').trim());
  }

  public getRoomById(roomId: string): TemporaryRoom | undefined {
    return this.roomsById.get(roomId);
  }

  public getRoomByPlayerUuid(playerUuid: string): TemporaryRoom | undefined {
    const roomId = this.playerToRoomId.get(playerUuid);
    return roomId ? this.roomsById.get(roomId) : undefined;
  }

  public getRoomByPlayerUsername(username: string): TemporaryRoom | undefined {
    const target = username.trim().toLowerCase();
    for (const room of this.roomsById.values()) {
      for (const m of room.members.values()) {
        if (m.username.toLowerCase() === target) {
          return room;
        }
      }
    }
    return undefined;
  }

  /**
   * Returns members for public broadcast (excluding covert staff spies).
   */
  public getPublicMembers(room: TemporaryRoom): Array<{ uuid: string; username: string; isSpeaking?: boolean }> {
    return Array.from(room.members.values())
      .filter((m) => !m.isSpy)
      .map((m) => ({
        uuid: m.playerUuid,
        username: m.username,
        isSpeaking: m.isSpeaking,
      }));
  }

  /**
   * Returns total active room count.
   */
  public getRoomCount(): number {
    return this.roomsById.size;
  }

  /**
   * Resets all rooms and timers for testing/shutdown.
   */
  public clear(): void {
    for (const room of this.roomsById.values()) {
      if (room.emptyTimeout) {
        clearTimeout(room.emptyTimeout);
      }
    }
    this.roomsByPin.clear( );
    this.roomsById.clear();
    this.playerToRoomId.clear();
    this.failedAttempts.clear();
  }
}
