# Proposal: Disable Player Radar per Server

## Why

In competitive gameplay environments such as PvP, Factions, Hardcore, and UHC, the web client's 2D/3D visual radar acts as an unintentional tactical mini-map or acoustic ESP, revealing the direction, elevation, and relative distance of nearby players through walls and obstacles. Server administrators need a per-server configuration toggle to disable the visual proximity radar and replace it with a non-tactical proximity presence roster while preserving full 3D spatial audio immersion.

## What Changes

- **Paper Plugin (`paper-voice-bridge`)**:
  - Add a configurable `mechanics.radar-enabled` toggle (default: `true`) in `config.yml`.
  - Include the `radarEnabled` boolean flag in `SpatialTelemetryBatch` sent to the voice backend during periodic telemetry and plugin registration.
  - Support hot-reloading `mechanics.radar-enabled` dynamically via `/voice reload`.

- **Voice Server Backend (`voice-server`)**:
  - Record and maintain the `radarEnabled` state per `serverId` in `PluginGateway` and `SpatialEngine`.
  - Dispatch a `radar_status` WebSocket message (`{ type: 'radar_status', enabled: boolean }`) to connected web clients upon session initialization and whenever a player transitions between backend servers.
  - Preserve all existing 3D spatial audio processing, WebRTC consumer lifecycles, and `PannerNode` positional audio feeds so voice immersion is unchanged.

- **Web Client (`web-client-spatial-audio`)**:
  - Listen for `radar_status` signaling frames in `VoiceSignaling.ts` and expose reactive state to player components.
  - When `radarEnabled` is `false`, render `<ProximityRoster />` in `PlayerRoute.tsx` instead of the circular `<Radar />` soundstage.
  - Provide player avatars, speaking pulse indicators, local mute toggles, and individual volume sliders in the proximity roster without rendering directional compass cues, distance rings, or relative coordinates.
  - Adapt Document Picture-in-Picture (`PipOverlay.tsx`) to render a compact speaking roster when radar is disabled.
  - Add English and Spanish localization strings for the proximity roster and server radar policies.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `paper-voice-bridge`: Extend configurable in-game mechanics and spatial telemetry batches to include server-level `radar-enabled` toggles.
- `web-client-spatial-audio`: Update radar requirements to support dynamic server-driven radar suppression and render a proximity presence roster with per-user volume controls when radar is disabled.

## Impact

- **Paper Plugin**: `config.yml`, `SpatialTelemetryBatch.java`, `VoiceConfig.java`, `TelemetryTask.java`.
- **Backend**: `PluginGateway.ts`, `ClientGateway.ts`, `SpatialEngine.ts`, and corresponding automated unit/integration tests.
- **Frontend**: `VoiceSignaling.ts`, `PlayerRoute.tsx`, `PipOverlay.tsx`, new `ProximityRoster.tsx`, and i18n locales (`en.ts`, `es.ts`).
- **Protocols & Schemas**: Adds `radarEnabled` to `telemetry_batch` frame and `radar_status` to client WebSocket protocol. Backward compatible with existing clients.
