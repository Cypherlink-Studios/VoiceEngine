## 1. Audio Pipeline & Procedural Sound Effects

- [x] 1.1 Add deafen gain node and master deafen routing in `SpatialAudioPipeline.ts` and verify that incoming audio gain drops to zero when deafen is enabled.
- [x] 1.2 Add procedural deafen and undeafen transitional chimes in `SoundEffects.ts` and verify chime playback on state changes.
- [x] 1.3 Implement delayed microphone loopback self-test in `SpatialAudioPipeline.ts` and verify local monitoring without remote transmission.
- [x] 1.4 Implement proximity audio ducking in `SpatialAudioPipeline.ts` when peers transmit on fixed radio channels and verify automated gain attenuation.

## 2. Deafen & Streamer Mode Controls

- [x] 2.1 Add deafen button and keyboard shortcut (`D`) to `ControlDock.tsx` and `PlayerRoute.tsx` and verify bi-directional state synchronization.
- [x] 2.2 Implement Streamer Mode toggle in `SettingsModal.tsx` and apply masking to tokens, URLs, and coordinates across `PlayerRoute.tsx` and `Radar.tsx`.

## 3. Microphone Diagnostics & Level Metering

- [x] 3.1 Add real-time mic test visualizer in `SettingsModal.tsx` displaying input RMS amplitude alongside the VAD threshold marker and verify speech boundary feedback.

## 4. Mobile Companion & Screen Wake Lock

- [x] 4.1 Create mobile QR code onboarding dialog in `PlayerRoute.tsx` and verify scannable QR display of the authenticated session URL.
- [x] 4.2 Integrate Screen Wake Lock API and Vibration API haptic pulses in `PlayerRoute.tsx` and verify lock retention during connection.

## 5. Document Picture-in-Picture Floating Overlay & Radar Interactions

- [x] 5.1 Implement Document Picture-in-Picture overlay launcher in `PlayerRoute.tsx` with floating mini-radar and essential controls, verifying window lifecycle.
- [x] 5.2 Enhance `Radar.tsx` avatar click interactions to anchor quick peer volume and mute popovers directly from the radar.

## 6. Verification & Build

- [x] 6.1 Execute `npm run build` in `web-client/` and verify successful TypeScript compilation and bundle asset generation.
