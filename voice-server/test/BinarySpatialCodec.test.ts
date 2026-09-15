import { describe, it, expect } from 'vitest';
import {
  encodeSpatialBatch,
  decodeSpatialBatch,
  uuidToBytes,
  bytesToUuid,
  BinaryPeerSpatial,
  SPATIAL_PACKET_TYPE,
  HEADER_SIZE,
  PEER_ENTRY_SIZE,
} from '../src/spatial/BinarySpatialCodec.js';

describe('BinarySpatialCodec', () => {
  it('converts canonical UUIDs to bytes and back with exact fidelity', () => {
    const originalUuid = '12345678-1234-5678-1234-567812345678';
    const bytes = new Uint8Array(16);
    uuidToBytes(originalUuid, bytes, 0);

    const reconstructed = bytesToUuid(bytes, 0);
    expect(reconstructed).toBe(originalUuid);
  });

  it('encodes and decodes an empty batch correctly', () => {
    const buffer = encodeSpatialBatch([]);
    expect(buffer.length).toBe(HEADER_SIZE);
    expect(buffer.readUInt8(0)).toBe(SPATIAL_PACKET_TYPE);
    expect(buffer.readUInt16LE(1)).toBe(0);

    const decoded = decodeSpatialBatch(buffer);
    expect(decoded).toEqual([]);
  });

  it('performs lossless roundtrip on multi-peer spatial updates with flags', () => {
    const peers: BinaryPeerSpatial[] = [
      {
        peerUuid: 'c0ffee00-dead-beef-cafe-0123456789ab',
        relX: 12.34,
        relY: -5.67,
        relZ: 28.9,
        distance: 29.55,
        isSubmerged: true,
        isPaused: false,
        isBroadcast: false,
      },
      {
        peerUuid: '00000000-0000-0000-0000-000000000002',
        relX: -30.0,
        relY: 0.0,
        relZ: -0.05,
        distance: 30.0,
        isSubmerged: false,
        isPaused: true,
        isBroadcast: true,
      },
    ];

    const buffer = encodeSpatialBatch(peers);
    expect(buffer.length).toBe(HEADER_SIZE + 2 * PEER_ENTRY_SIZE);

    const decoded = decodeSpatialBatch(buffer);
    expect(decoded).toHaveLength(2);

    expect(decoded[0].peerUuid).toBe('c0ffee00-dead-beef-cafe-0123456789ab');
    expect(decoded[0].relX).toBeCloseTo(12.34, 2);
    expect(decoded[0].relY).toBeCloseTo(-5.67, 2);
    expect(decoded[0].relZ).toBeCloseTo(28.9, 2);
    expect(decoded[0].distance).toBeCloseTo(29.55, 2);
    expect(decoded[0].isSubmerged).toBe(true);
    expect(decoded[0].isPaused).toBe(false);
    expect(decoded[0].isBroadcast).toBe(false);

    expect(decoded[1].peerUuid).toBe('00000000-0000-0000-0000-000000000002');
    expect(decoded[1].relX).toBeCloseTo(-30.0, 2);
    expect(decoded[1].relY).toBeCloseTo(0.0, 2);
    expect(decoded[1].relZ).toBeCloseTo(-0.05, 2);
    expect(decoded[1].distance).toBeCloseTo(30.0, 2);
    expect(decoded[1].isSubmerged).toBe(false);
    expect(decoded[1].isPaused).toBe(true);
    expect(decoded[1].isBroadcast).toBe(true);
  });

  it('rejects invalid or truncated packet headers safely', () => {
    // Too short
    expect(decodeSpatialBatch(Buffer.from([0x01]))).toEqual([]);

    // Wrong packet type
    expect(decodeSpatialBatch(Buffer.from([0x99, 0x00, 0x01]))).toEqual([]);
  });
});
