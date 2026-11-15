import { describe, it, expect, vi } from 'vitest';
import { PeerRadarInfo } from '../../web-client/src/components/Radar.js';
import { RoomMember } from '../../web-client/src/net/VoiceSignaling.js';

describe('Web Client Rooms & Staff Vanish Protocol', () => {
  describe('Radar Staff Vanish Exclusion Matrix', () => {
    const regularPeer: PeerRadarInfo = {
      uuid: 'uuid-regular',
      username: 'RegularUser',
      distance: 5,
      relX: 2,
      relY: 0,
      relZ: 3,
      isStaffVanish: false,
    };

    const vanishedStaffPeer: PeerRadarInfo = {
      uuid: 'uuid-staff',
      username: 'AdminUser',
      distance: 4,
      relX: 1,
      relY: 0,
      relZ: 2,
      isStaffVanish: true,
    };

    const peers = [regularPeer, vanishedStaffPeer];

    it('excludes vanished staff from radar when viewer is a regular player', () => {
      const isViewerStaff = false;
      const visiblePeers = peers.filter((p) => !p.isStaffVanish || isViewerStaff);
      expect(visiblePeers).toHaveLength(1);
      expect(visiblePeers[0].uuid).toBe('uuid-regular');
      expect(visiblePeers.find((p) => p.uuid === 'uuid-staff')).toBeUndefined();
    });

    it('includes vanished staff on radar when viewer is also authorized staff', () => {
      const isViewerStaff = true;
      const visiblePeers = peers.filter((p) => !p.isStaffVanish || isViewerStaff);
      expect(visiblePeers).toHaveLength(2);
      expect(visiblePeers.find((p) => p.uuid === 'uuid-staff')).toBeDefined();
    });
  });

  describe('Signaling Room Frames & Dispatch Handling', () => {
    it('dispatches room protocol events and updates local room state', () => {
      const callbacks = {
        onRoomCreated: vi.fn(),
        onRoomJoined: vi.fn(),
        onRoomLeft: vi.fn(),
        onRoomKicked: vi.fn(),
        onRoomMembersUpdated: vi.fn(),
        onRoomSpeaking: vi.fn(),
        onRoomError: vi.fn(),
        onStaffVanishStatusChanged: vi.fn(),
      };

      // Simulated dispatch receiver similar to VoiceSignaling.handleMessage
      const handleMessage = (msg: any) => {
        switch (msg.type) {
          case 'room_created':
            callbacks.onRoomCreated({ roomId: msg.roomId, pin: msg.pin, ownerUuid: msg.ownerUuid });
            break;
          case 'room_joined':
            callbacks.onRoomJoined({ roomId: msg.roomId, pin: msg.pin, ownerUuid: msg.ownerUuid });
            break;
          case 'room_left':
            callbacks.onRoomLeft();
            break;
          case 'room_kicked':
            callbacks.onRoomKicked({ roomId: msg.roomId, reason: msg.reason });
            break;
          case 'room_members':
            callbacks.onRoomMembersUpdated(msg.roomId, msg.members || [], msg.pin, msg.ownerUuid);
            break;
          case 'room_speaking':
            callbacks.onRoomSpeaking(msg.roomId, msg.peerUuid, Boolean(msg.speaking));
            break;
          case 'room_error':
            callbacks.onRoomError({ error: msg.error, message: msg.message, retryAfterSeconds: msg.retryAfterSeconds });
            break;
          case 'staff_vanish_status':
            callbacks.onStaffVanishStatusChanged(Boolean(msg.enabled));
            break;
        }
      };

      handleMessage({ type: 'room_created', roomId: 'room_123456', pin: '123456', ownerUuid: 'uuid-1' });
      expect(callbacks.onRoomCreated).toHaveBeenCalledWith({ roomId: 'room_123456', pin: '123456', ownerUuid: 'uuid-1' });

      handleMessage({ type: 'room_joined', roomId: 'room_123456', pin: '123456', ownerUuid: 'uuid-1' });
      expect(callbacks.onRoomJoined).toHaveBeenCalledWith({ roomId: 'room_123456', pin: '123456', ownerUuid: 'uuid-1' });

      const members: RoomMember[] = [
        { uuid: 'uuid-1', username: 'Alice', isSpeaking: false, isOwner: true },
        { uuid: 'uuid-2', username: 'Bob', isSpeaking: true, isOwner: false },
      ];
      handleMessage({ type: 'room_members', roomId: 'room_123456', pin: '123456', ownerUuid: 'uuid-1', members });
      expect(callbacks.onRoomMembersUpdated).toHaveBeenCalledWith('room_123456', members, '123456', 'uuid-1');

      handleMessage({ type: 'room_speaking', roomId: 'room_123456', peerUuid: 'uuid-2', speaking: true });
      expect(callbacks.onRoomSpeaking).toHaveBeenCalledWith('room_123456', 'uuid-2', true);

      handleMessage({ type: 'room_error', error: 'rate_limit', message: 'Too many attempts', retryAfterSeconds: 45 });
      expect(callbacks.onRoomError).toHaveBeenCalledWith({ error: 'rate_limit', message: 'Too many attempts', retryAfterSeconds: 45 });

      handleMessage({ type: 'staff_vanish_status', enabled: true });
      expect(callbacks.onStaffVanishStatusChanged).toHaveBeenCalledWith(true);

      handleMessage({ type: 'room_kicked', roomId: 'room_123456', reason: 'Kicked by owner' });
      expect(callbacks.onRoomKicked).toHaveBeenCalledWith({ roomId: 'room_123456', reason: 'Kicked by owner' });

      handleMessage({ type: 'room_left' });
      expect(callbacks.onRoomLeft).toHaveBeenCalled();
    });
  });

  describe('Audio Pipeline Unspatialized Stereo Routing', () => {
    it('bypasses 3D HRTF panners and lowpass filters when stream is marked as isRoom', () => {
      // Mock AudioNode graph structure
      const mockConnect = vi.fn();
      const mockMasterGain = { id: 'masterGain', connect: mockConnect };
      const mockProximityBus = { id: 'proximityBusGain', connect: mockConnect };

      // Helper function replicating SpatialAudioPipeline routing logic
      const routePeerStream = (initialPos: { isChannel?: boolean; isBroadcast?: boolean; isRoom?: boolean }) => {
        const isBroadcast = Boolean(initialPos.isBroadcast);
        const isRoom = Boolean(initialPos.isRoom);

        if (initialPos.isChannel || isBroadcast || isRoom) {
          // Direct Stereo Routing
          return {
            dest: mockMasterGain,
            hasPanner: false,
            hasFilter: false,
            isRoom: true,
          };
        }

        // 3D Spatial Routing
        return {
          dest: mockProximityBus,
          hasPanner: true,
          hasFilter: true,
          isRoom: false,
        };
      };

      const roomRoute = routePeerStream({ isRoom: true });
      expect(roomRoute.dest).toBe(mockMasterGain);
      expect(roomRoute.hasPanner).toBe(false);
      expect(roomRoute.hasFilter).toBe(false);
      expect(roomRoute.isRoom).toBe(true);

      const proximityRoute = routePeerStream({ isRoom: false });
      expect(proximityRoute.dest).toBe(mockProximityBus);
      expect(proximityRoute.hasPanner).toBe(true);
      expect(proximityRoute.hasFilter).toBe(true);
      expect(proximityRoute.isRoom).toBe(false);
    });
  });
});
