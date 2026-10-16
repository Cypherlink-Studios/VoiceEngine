# Tasks: Disable Player Radar per Server

## 1. Paper Plugin Configuration and Telemetry

- [x] 1.1 Add `mechanics.radar-enabled` (default `true`) to `paper-plugin/src/main/resources/config.yml` and update `VoiceConfig.java` to read and cache the value, verifying with unit test updates in `paper-plugin/src/test/java/com/voiceengine/config/VoiceConfigTest.java`.
- [x] 1.2 Update `SpatialTelemetryBatch.java` to include `radarEnabled` in records and constructors, verifying JSON serialization and deserialization in `paper-plugin/src/test/java/com/voiceengine/telemetry/SpatialTelemetryTest.java`.
- [x] 1.3 Update `TelemetryTask.java` to pass the active `radar-enabled` setting into telemetry batches and verify live reload via `/voice reload`.

## 2. Voice Server Backend Processing & Signaling

- [x] 2.1 Update `PluginGateway.ts` to read `radarEnabled` from incoming `telemetry_batch` payloads and store the per-server state.
- [x] 2.2 Update `ClientGateway.ts` to dispatch `radar_status` frames (`{ type: 'radar_status', enabled: boolean }`) during `auth_success` and whenever a player transitions between servers with differing radar policies.
- [x] 2.3 Write automated unit and integration tests in `voice-server/test/` validating `radar_status` generation and verify execution via `npm test`.

## 3. Web Client Proximity Roster & PiP Fallback

- [x] 3.1 Update `VoiceSignaling.ts` to process `radar_status` messages and expose `onRadarStatusChanged(enabled: boolean)` callback.
- [x] 3.2 Create `web-client/src/components/player/ProximityRoster.tsx` rendering player Minecraft avatars, active speaking rings, submerged indicators, local mute toggles, and volume sliders.
- [x] 3.3 Update `PlayerRoute.tsx` to conditionally display `<ProximityRoster />` instead of `<Radar />` when proximity chat is active and `radarEnabled` is `false`.
- [x] 3.4 Update `PipOverlay.tsx` to render a compact speaking roster when `radarEnabled` is `false`.
- [x] 3.5 Add English and Spanish localization strings in `web-client/src/i18n/locales/en.ts` and `es.ts` for proximity roster headings and empty states.
- [x] 3.6 Run `npm run build` and `npm test` in `web-client` to verify compilation and test integrity.

## 4. End-to-End Verification

- [x] 4.1 Execute end-to-end integration tests confirming multi-server radar status propagation across Paper, voice-server, and client UI.
