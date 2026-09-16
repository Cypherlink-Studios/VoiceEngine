## 1. Web Client Background Audio & VAD Resiliency

- [x] 1.1 Implement dual-clock background ticker (inline Web Worker ticker with fallback interval and AudioWorklet event coupling) in `MicrophonePipeline.ts`, verifying unthrottled execution when tab visibility is hidden.
- [x] 1.2 Implement monotonic timestamp-based hangover logic (`performance.now()`) in `MicrophonePipeline.ts`, eliminating `setTimeout` and verifying that silence duration triggers gate release accurately.
- [x] 1.3 Add `AudioContext` state listener (`onstatechange`) to automatically resume suspended contexts on background transitions in `MicrophonePipeline.ts` and `SpatialAudioPipeline.ts`.

## 2. Web Client Mute & Deafen Speaking Synchronization

- [x] 2.1 Refactor `PlayerRoute.tsx` to centralize transmission state in `updateAudioTransmission`, gating `notifySpeaking(canTransmit)` strictly by `speaking && !isMuted && !isDeafened`.
- [x] 2.2 Update `onSpeakingChange` in `PlayerRoute.tsx` so the local avatar speaking visual ring only activates when unmuted and undeafened.
- [x] 2.3 Verify `PlayerRoute.tsx` audio toggle handlers (`handleToggleMute`, `handleToggleDeafen`, `onModerationNotice`) immediately synchronize speaking state to `false` and restore it seamlessly upon unmuting if speech continues.

## 3. Voice Server Moderation Guard

- [x] 3.1 Guard `case 'speaking':` in `ClientGateway.ts` to reject incoming speech notifications when `session.isMuted` is active, verifying that Paper plugin `speech_status` and channel broadcast notifications are suppressed.

## 4. Verification and Automated Testing

- [x] 4.1 Run unit tests in `web-client` (`npm test`) and `voice-server` (`npm test`) to ensure all suites pass without regressions.
- [x] 4.2 Validate complete OpenSpec change compliance using `openspec validate fix-client-vad-and-mute-particles --strict`.
