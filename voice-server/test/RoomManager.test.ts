import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager } from '../src/rooms/RoomManager.js';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    vi.useFakeTimers();
    roomManager = new RoomManager(0, 30000);
  });

  afterEach(() => {
    roomManager.clear();
    vi.useRealTimers();
  });

  it('generates unique 6-digit numeric PINs', () => {
    const pin = roomManager.generatePin();
    expect(pin).toMatch(/^\d{6}$/);
    const pinNum = parseInt(pin, 10);
    expect(pinNum).toBeGreaterThanOrEqual(100000);
    expect(pinNum).toBeLessThanOrEqual(999999);
  });

  it('creates room and designates creator as owner and member', () => {
    const { room, pin } = roomManager.createRoom('uuid-1', 'Alice');
    expect(room.id).toBe(`room_${pin}`);
    expect(room.ownerUuid).toBe('uuid-1');
    expect(room.members.size).toBe(1);
    expect(room.members.get('uuid-1')?.username).toBe('Alice');
    expect(roomManager.getRoomByPin(pin)).toBe(room);
    expect(roomManager.getRoomByPlayerUuid('uuid-1')).toBe(room);
  });

  it('allows players to join via valid 6-digit PIN', () => {
    const { pin } = roomManager.createRoom('uuid-1', 'Alice');
    const result = roomManager.joinRoom(pin, 'uuid-2', 'Bob', '127.0.0.1');

    expect(result.success).toBe(true);
    expect(result.room?.members.size).toBe(2);
    expect(result.room?.members.has('uuid-2')).toBe(true);
  });

  it('enforces rate limiting: 5 failed attempts locks out for 60 seconds', () => {
    const ip = '192.168.1.100';
    const uuid = 'attacker-uuid';

    for (let i = 0; i < 4; i++) {
      const res = roomManager.joinRoom('000000', uuid, 'Attacker', ip);
      expect(res.success).toBe(false);
      expect(res.error).toBe('invalid_pin');
    }

    // 5th failed attempt triggers lockout
    const fifthAttempt = roomManager.joinRoom('000000', uuid, 'Attacker', ip);
    expect(fifthAttempt.success).toBe(false);

    // 6th attempt is blocked by rate limiting
    const lockedAttempt = roomManager.joinRoom('000000', uuid, 'Attacker', ip);
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.error).toBe('rate_limited');
    expect(lockedAttempt.retryAfterSeconds).toBeGreaterThan(0);

    // Advance timer past 60s lockout
    vi.advanceTimersByTime(61000);

    // Now allowed to attempt again
    const postLockoutAttempt = roomManager.joinRoom('000000', uuid, 'Attacker', ip);
    expect(postLockoutAttempt.error).toBe('invalid_pin');
  });

  it('enforces maximum member capacity when configured', () => {
    const { pin } = roomManager.createRoom('uuid-1', 'Alice', 2);
    const join1 = roomManager.joinRoom(pin, 'uuid-2', 'Bob');
    expect(join1.success).toBe(true);

    const join2 = roomManager.joinRoom(pin, 'uuid-3', 'Charlie');
    expect(join2.success).toBe(false);
    expect(join2.error).toBe('room_full');
  });

  it('allows owner to kick member and rejects non-owner kick', () => {
    const { pin } = roomManager.createRoom('uuid-1', 'Alice');
    roomManager.joinRoom(pin, 'uuid-2', 'Bob');

    // Non-owner kick rejected
    const nonOwnerKick = roomManager.kickMember('uuid-2', 'uuid-1');
    expect(nonOwnerKick.success).toBe(false);
    expect(nonOwnerKick.error).toBe('not_owner');

    // Owner kicks member
    const ownerKick = roomManager.kickMember('uuid-1', 'uuid-2');
    expect(ownerKick.success).toBe(true);
    expect(ownerKick.kickedMember?.username).toBe('Bob');
    expect(roomManager.getRoomByPlayerUuid('uuid-2')).toBeUndefined();
  });

  it('transfers ownership to oldest remaining member when owner leaves', () => {
    const { pin } = roomManager.createRoom('uuid-1', 'Alice');
    vi.advanceTimersByTime(100);
    roomManager.joinRoom(pin, 'uuid-2', 'Bob');
    vi.advanceTimersByTime(100);
    roomManager.joinRoom(pin, 'uuid-3', 'Charlie');

    const leaveRes = roomManager.leaveRoom('uuid-1');
    expect(leaveRes.left).toBe(true);
    expect(leaveRes.newOwnerUuid).toBe('uuid-2');
    expect(leaveRes.room?.ownerUuid).toBe('uuid-2');
  });

  it('starts 30-second grace timer when empty and destroys room upon timeout', () => {
    const { room, pin } = roomManager.createRoom('uuid-1', 'Alice');
    const roomId = room.id;

    roomManager.leaveRoom('uuid-1');
    expect(roomManager.getRoomById(roomId)).toBeDefined();

    // Advance 20 seconds: room still exists in grace period
    vi.advanceTimersByTime(20000);
    expect(roomManager.getRoomById(roomId)).toBeDefined();

    // Advance remaining 10 seconds: room destroyed
    vi.advanceTimersByTime(11000);
    expect(roomManager.getRoomById(roomId)).toBeUndefined();
    expect(roomManager.getRoomByPin(pin)).toBeUndefined();
  });

  it('allows staff to wiretap room via player username and excludes spy from public roster', () => {
    const { pin } = roomManager.createRoom('uuid-1', 'Alice');
    roomManager.joinRoom(pin, 'uuid-2', 'Bob');

    const spyRes = roomManager.spyRoom('staff-1', 'ModeratorDan', 'Bob');
    expect(spyRes.success).toBe(true);
    expect(spyRes.room?.pin).toBe(pin);

    const publicMembers = roomManager.getPublicMembers(spyRes.room!);
    expect(publicMembers.length).toBe(2);
    expect(publicMembers.some((m) => m.username === 'ModeratorDan')).toBe(false);
    expect(publicMembers.some((m) => m.username === 'Alice')).toBe(true);
    expect(publicMembers.some((m) => m.username === 'Bob')).toBe(true);
  });
});
