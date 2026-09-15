export const SPATIAL_PACKET_TYPE = 0x01;
export const HEADER_SIZE = 3; // 1 byte packetType + 2 bytes peerCount
export const PEER_ENTRY_SIZE = 25; // 16 bytes UUID + 2B relX + 2B relY + 2B relZ + 2B dist + 1B flags

export const FLAG_SUBMERGED = 0x01;
export const FLAG_PAUSED = 0x02;
export const FLAG_BROADCAST = 0x04;

export interface BinaryPeerSpatial {
  peerUuid: string;
  relX: number;
  relY: number;
  relZ: number;
  distance: number;
  isSubmerged: boolean;
  isPaused: boolean;
  isBroadcast: boolean;
}

/**
 * Encodes a 36-character UUID string (with or without hyphens) into 16 bytes.
 */
export function uuidToBytes(uuid: string, target: Uint8Array, offset = 0): void {
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32) {
    // If not a valid 32-char hex, pad or fallback safely
    for (let i = 0; i < 16; i++) {
      target[offset + i] = 0;
    }
    const textBytes = new TextEncoder().encode(uuid.slice(0, 16));
    target.set(textBytes, offset);
    return;
  }

  for (let i = 0; i < 16; i++) {
    target[offset + i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
}

/**
 * Decodes 16 bytes into a canonical 36-character UUID string (8-4-4-4-12).
 */
export function bytesToUuid(source: Uint8Array, offset = 0): string {
  let hex = '';
  for (let i = 0; i < 16; i++) {
    const byte = source[offset + i];
    hex += (byte < 16 ? '0' : '') + byte.toString(16);
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Encodes a list of audible peer spatial updates into a compact binary Buffer.
 */
export function encodeSpatialBatch(peers: BinaryPeerSpatial[]): Buffer {
  const peerCount = Math.min(peers.length, 65535);
  const totalLength = HEADER_SIZE + peerCount * PEER_ENTRY_SIZE;
  const buffer = Buffer.allocUnsafe(totalLength);

  // Header: [packetType: uint8, peerCount: uint16 LE]
  buffer.writeUInt8(SPATIAL_PACKET_TYPE, 0);
  buffer.writeUInt16LE(peerCount, 1);

  let offset = HEADER_SIZE;
  for (let i = 0; i < peerCount; i++) {
    const p = peers[i];

    // UUID (16 bytes)
    uuidToBytes(p.peerUuid, buffer, offset);
    offset += 16;

    // Relative coordinates: 16-bit signed integers (cm precision, range +-327.67m)
    const scaledX = Math.max(-32768, Math.min(32767, Math.round(p.relX * 100)));
    const scaledY = Math.max(-32768, Math.min(32767, Math.round(p.relY * 100)));
    const scaledZ = Math.max(-32768, Math.min(32767, Math.round(p.relZ * 100)));
    buffer.writeInt16LE(scaledX, offset);
    offset += 2;
    buffer.writeInt16LE(scaledY, offset);
    offset += 2;
    buffer.writeInt16LE(scaledZ, offset);
    offset += 2;

    // Distance: 16-bit unsigned integer (cm precision, range 0 to 655.35m)
    const scaledDist = Math.max(0, Math.min(65535, Math.round(p.distance * 100)));
    buffer.writeUInt16LE(scaledDist, offset);
    offset += 2;

    // Status Flags (1 byte)
    let flags = 0;
    if (p.isSubmerged) flags |= FLAG_SUBMERGED;
    if (p.isPaused) flags |= FLAG_PAUSED;
    if (p.isBroadcast) flags |= FLAG_BROADCAST;
    buffer.writeUInt8(flags, offset);
    offset += 1;
  }

  return buffer;
}

/**
 * Decodes a compact binary spatial batch buffer into structured peer spatial updates.
 */
export function decodeSpatialBatch(data: Buffer | ArrayBuffer | Uint8Array): BinaryPeerSpatial[] {
  const bytes = data instanceof Uint8Array
    ? data
    : new Uint8Array(data);

  if (bytes.length < HEADER_SIZE) {
    return [];
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packetType = view.getUint8(0);
  if (packetType !== SPATIAL_PACKET_TYPE) {
    return [];
  }

  const peerCount = view.getUint16(1, true); // Little-Endian
  const availablePeers = Math.floor((bytes.length - HEADER_SIZE) / PEER_ENTRY_SIZE);
  const count = Math.min(peerCount, availablePeers);

  const results: BinaryPeerSpatial[] = new Array(count);
  let offset = HEADER_SIZE;

  for (let i = 0; i < count; i++) {
    const peerUuid = bytesToUuid(bytes, offset);
    offset += 16;

    const relX = view.getInt16(offset, true) / 100.0;
    offset += 2;
    const relY = view.getInt16(offset, true) / 100.0;
    offset += 2;
    const relZ = view.getInt16(offset, true) / 100.0;
    offset += 2;
    const distance = view.getUint16(offset, true) / 100.0;
    offset += 2;

    const flags = view.getUint8(offset);
    offset += 1;

    results[i] = {
      peerUuid,
      relX,
      relY,
      relZ,
      distance,
      isSubmerged: (flags & FLAG_SUBMERGED) !== 0,
      isPaused: (flags & FLAG_PAUSED) !== 0,
      isBroadcast: (flags & FLAG_BROADCAST) !== 0,
    };
  }

  return results;
}
