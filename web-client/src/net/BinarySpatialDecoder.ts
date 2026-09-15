export const SPATIAL_PACKET_TYPE = 0x01;
export const HEADER_SIZE = 3; // 1B packetType + 2B peerCount LE
export const PEER_ENTRY_SIZE = 25; // 16B UUID + 2B relX + 2B relY + 2B relZ + 2B dist + 1B flags

export const FLAG_SUBMERGED = 0x01;
export const FLAG_PAUSED = 0x02;
export const FLAG_BROADCAST = 0x04;

export interface DecodedPeerSpatial {
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
 * Decodes 16 raw bytes into a canonical 36-character UUID string (8-4-4-4-12).
 */
export function bytesToUuid(bytes: Uint8Array, offset = 0): string {
  let hex = '';
  for (let i = 0; i < 16; i++) {
    const byte = bytes[offset + i];
    hex += (byte < 16 ? '0' : '') + byte.toString(16);
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Decodes a binary ArrayBuffer frame into structured peer spatial coordinates.
 */
export function decodeSpatialBatch(data: ArrayBuffer | Uint8Array): DecodedPeerSpatial[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (bytes.byteLength < HEADER_SIZE) {
    return [];
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packetType = view.getUint8(0);
  if (packetType !== SPATIAL_PACKET_TYPE) {
    return [];
  }

  const peerCount = view.getUint16(1, true); // Little-Endian
  const availablePeers = Math.floor((bytes.byteLength - HEADER_SIZE) / PEER_ENTRY_SIZE);
  const count = Math.min(peerCount, availablePeers);

  const results: DecodedPeerSpatial[] = new Array(count);
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
