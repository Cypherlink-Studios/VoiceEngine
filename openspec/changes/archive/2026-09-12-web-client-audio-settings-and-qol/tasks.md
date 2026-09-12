## 1. Voice Server Latency Probe Protocol

- [x] 1.1 Implement `{ type: 'ping', timestamp }` handling in `voice-server/src/gateway/ClientGateway.ts` returning `{ type: 'pong', timestamp }` and verify with unit tests.
- [x] 1.2 Run `voice-server` test suite (`npm test`) to verify existing SFU and gateway tests pass without regressions.

## 2. Web Client Audio Pipeline & Signaling Enhancements

- [x] 2.1 Extend `SpatialAudioPipeline.ts` with `setOutputDevice(sinkId: string)` using Web Audio `setSinkId` with graceful fallback and verify build.
- [x] 2.2 Implement per-user volume multipliers (`setPeerVolume`) and local mutes (`setPeerMuted`) in `SpatialAudioPipeline.ts` updating peer `GainNode` instances, and verify audio calculations.
- [x] 2.3 Implement procedural sound effects generator (`SoundEffects.ts`) using Web Audio oscillators for mute, unmute, connect, disconnect, and channel transitions, and verify procedural synthesis.
- [x] 2.4 Extend `VoiceSignaling.ts` with `replaceMicrophoneTrack` on the Mediasoup Producer and a periodic WebSocket ping probe calculating round-trip time (RTT), and verify signaling handling.

## 3. Quality of Life UI Components & Accessibility

- [x] 3.1 Build `PlayerVolumePopover.tsx` with volume slider (0-200%) and local mute toggle, and integrate into player heads in `Radar.tsx` and members in `ChannelDrawer.tsx`.
- [x] 3.2 Build `SettingsModal.tsx` featuring tabbed sections for Audio Devices (input dropdown, live mic VU meter, output dropdown, filter toggles), Player Volumes, and System Preferences (sound FX volume, ping stats, shortcut reference).
- [x] 3.3 Update `ControlDock.tsx` to include the Settings (⚙️) trigger button, real-time color-coded ping badge, and shortcut tooltips.
- [x] 3.4 Implement global keyboard shortcuts (`M` for mute with text-input guardrails, `Escape` to close active modal/drawer) and wire procedural sound feedback to UI events in `PlayerRoute.tsx`.

## 4. End-to-End Build & Validation

- [x] 4.1 Run full production build (`npm run build`) in `web-client` ensuring clean TypeScript compilation and bundle generation.
- [x] 4.2 Run `openspec validate --strict` to ensure all change artifacts and specifications strictly adhere to OpenSpec standard.
