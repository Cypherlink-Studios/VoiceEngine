import { WebSocket } from 'ws';
import * as mediasoup from 'mediasoup';

export interface PlayerSpatialState {
  uuid: string;
  username: string;
  serverId?: string;
  world: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  isSneaking: boolean;
  isSubmerged: boolean;
  lastUpdated?: number;
}

export interface SessionTokenRecord {
  token: string;
  playerUuid: string;
  playerName: string;
  expiresAt: number;
  redeemed: boolean;
  isAdmin?: boolean;
}

export interface RelativeSpatialAudio {
  peerUuid: string;
  peerUsername: string;
  distance: number;
  isAudible: boolean;
  isSubmerged: boolean;
  // Local coordinates rotated relative to listener's head
  relX: number;
  relY: number;
  relZ: number;
}

export interface ServerBrandingConfig {
  serverName: string;
  tagline: string;
  logoUrl: string;
  backgroundUrl: string;
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string;
}

export interface ServerVoiceConfig {
  maxSlots: number;
  maxVoiceDistance: number;
  sneakVoiceDistance: number;
  defaultBitrate: number;
}

export interface FixedChannelConfig {
  id: string;
  name: string;
  description: string;
  userLimit: number; // 0 = unlimited
  isDefault?: boolean;
  scope?: 'global' | 'server';
}

export interface ServerSettings {
  branding: ServerBrandingConfig;
  voice: ServerVoiceConfig;
  fixedChannels: FixedChannelConfig[];
}

export interface ClientSession {
  sessionId: string;
  playerUuid: string;
  username: string;
  ws: WebSocket;
  sendTransport?: mediasoup.types.WebRtcTransport;
  recvTransport?: mediasoup.types.WebRtcTransport;
  producer?: mediasoup.types.Producer;
  // map of peerUuid -> consumer
  consumers: Map<string, mediasoup.types.Consumer>;
  isSpeaking: boolean;
  activeChannel?: string; // 'proximity' or fixed channel id
}
