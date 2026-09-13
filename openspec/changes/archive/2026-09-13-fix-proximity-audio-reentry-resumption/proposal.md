## Why

When players walk outside of audible proximity range (> 30 blocks) and return on foot (<= 30 blocks), audio frequently fails to resume and players become permanently inaudible despite appearing on the radar. This occurs because Chromium's `MediaStreamAudioSourceNode` drops into unrecoverable silence after an incoming WebRTC track undergoes an RTP starvation / track-mute cycle, combined with muted sink optimizations and omission of peer usernames during spatial resumption updates.

## What Changes

- **Web Client Audio Source Self-Healing**: Automatically re-bind and refresh `MediaStreamAudioSourceNode` upon track unpause (`isPaused: false`) and `track.onunmute` events so Chromium establishes a clean, active WebRTC audio consumer without touching the heavy HRTF PannerNode graph.
- **Active Low-Volume Audio Sink**: Update the persistent audio sink in `SpatialAudioPipeline` from `muted = true` to an active inaudible gain level (`volume = 0.0001`) and ensure dynamic stream assignment so Chromium maintains active WebRTC audio decoding.
- **AudioContext State Recovery**: Verify and resume `AudioContext` in `updatePeerPosition` if background tab throttling suspended audio rendering.
- **Radar Identity Preservation**: Include `peerUsername` in `peer_spatial_update` packets sent from `ClientGateway` so re-entering players maintain their display names instead of falling back to "Player".
- **Producer ID Validation**: Verify that existing consumers match the speaker's active producer ID before resuming, avoiding stale consumer deadlocks.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `web-client-spatial-audio`: Adds audio source node self-healing on track unpause/unmute, persistent active low-volume sink configuration, and background context resumption.
- `voice-backend-sfu`: Adds `peerUsername` to `peer_spatial_update` payloads and validates active producer ID integrity during proximity consumer evaluation.

## Impact

- `web-client/src/audio/SpatialAudioPipeline.ts`: Re-attaches `MediaStreamAudioSourceNode` on resumption and configures active low-volume sink.
- `web-client/src/net/VoiceSignaling.ts`: Preserves peer username when re-entering audible range.
- `voice-server/src/gateway/ClientGateway.ts`: Emits `peerUsername` in `peer_spatial_update` and verifies `consumer.producerId === speakerSession.producer.id`.
- Test suites in `voice-server/test/ClientGateway.test.ts` updated to verify username delivery in `peer_spatial_update`.
