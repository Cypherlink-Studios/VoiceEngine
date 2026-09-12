## 1. Paper Plugin Admin Command & Permission

- [x] 1.1 Add `voiceengine.admin` permission to `plugin.yml` and extend `VoiceCommand.java` to handle `/voice admin`, verifying permission checks and clickable admin URL generation via `./gradlew test`.
- [x] 1.2 Update plugin token transmission protocol to flag administrative session tokens to the voice backend and verify build via `./gradlew build`.

## 2. Voice Server Settings Persistence & API Endpoints

- [x] 2.1 Implement `SettingsManager` in `voice-server` with schema validation, default initialization, and atomic persistence to `data/settings.json`, verified with automated unit tests.
- [x] 2.2 Add `GET /api/config/public` endpoint returning public branding, slot limits, and active fixed channels, verified with HTTP test requests.
- [x] 2.3 Implement admin authentication and session management (`POST /api/admin/auth`, `GET /api/admin/settings`, `PUT /api/admin/settings`, `GET /api/admin/metrics`) protected by admin tokens, verified with unit tests.

## 3. Fixed Channels SFU Audio Routing

- [x] 3.1 Extend `ClientSession` and `ClientGateway` to track active channels (`proximity` vs fixed channel ID) and handle channel switch messages, verifying with gateway tests.
- [x] 3.2 Implement unattenuated stereo producer-consumer subscription in `MediasoupManager` and `ClientGateway` for clients in the same fixed channel, verified via SFU routing tests.

## 4. Web Client Infrastructure & Dual-Mode Audio Engine

- [x] 4.1 Install `react-router-dom` in `web-client` and establish route structure (`/` and `/admin`) with `BrandProvider` for dynamic CSS variable injection, verifying build via `npm run build`.
- [x] 4.2 Upgrade `SpatialAudioPipeline` to support dual-mode audio (3D HRTF spatial panner for proximity vs unattenuated stereo for fixed channels) and verify with audio node tests.
- [x] 4.3 Create reactive audio waveform component (`AudioWaveform.tsx`) reading from `AudioContext` analyser node and verify visual animation behavior.

## 5. Modern Player Interface (/)

- [x] 5.1 Implement glassmorphism UI with brand-reactive colors, modern control dock (mute, PTT, volume, channel switcher), and verify responsive layout.
- [x] 5.2 Enhance `Radar.tsx` with Minecraft player head skins and relative elevation indicators (above/below/level), verifying radar rendering.
- [x] 5.3 Implement channel drawer allowing instant switching between proximity chat and fixed Discord-style channels, verifying channel change signaling.

## 6. Admin Portal Interface (/admin)

- [x] 6.1 Implement administrative access screen (token validation from URL query, access-locked screen with `/voice admin` instructions if unauthorized), verifying session storage.
- [x] 6.2 Build `BrandingTab.tsx` with live interactive preview, color pickers, logo/background inputs, and save action to `/api/admin/settings`.
- [x] 6.3 Build `ChannelsTab.tsx` for creating, editing, and deleting fixed channels with user limits and verify reactive updates.
- [x] 6.4 Build `BackendTab.tsx` and `LiveMonitorTab.tsx` for tuning slot limits, voice distances, bitrates, and viewing live connected player statistics.

## 7. End-to-End Verification & Mock Integration

- [x] 7.1 Extend mock telemetry simulator (`mockTelemetry.ts`) to register test admin tokens and simulated fixed channels, verifying end-to-end player and admin flows.
- [x] 7.2 Run full build verification across all subprojects (`paper-plugin`, `voice-server`, `web-client`) and run `openspec validate --strict`.
