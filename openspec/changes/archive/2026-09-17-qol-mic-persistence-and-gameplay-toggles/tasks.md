## 1. Web Client Microphone State Persistence

- [x] 1.1 Implement `voiceengine:mic_muted` state persistence in `web-client/src/routes/PlayerRoute.tsx`, ensuring initial state reads from `localStorage` and `handleDisconnect` preserves the user's preference.
- [x] 1.2 Guard audio connection in `handleConnect` to initialize `micPipeline` directly in the persisted mute state (`sendTrack.enabled = false` and worklet mute) without hot-mic audio leakage.
- [x] 1.3 Handle undeafen restoration from saved `localStorage` state and ensure server-moderated mutes do not overwrite local user preferences.
- [x] 1.4 Verify the web client builds cleanly with `npm run build` and passes type checks.

## 2. Voice Server Spectator Spatial Isolation

- [x] 2.1 Add `isSpectator?: boolean` to `PlayerSpatialState` in `voice-server/src/types.ts`.
- [x] 2.2 Implement spectator proximity routing in `voice-server/src/spatial/SpatialEngine.ts`, supporting `listen-only` (living listeners ignore spectator audio while spectators hear living players) and `isolated` (living and spectators never hear each other).
- [x] 2.3 Add unit tests in `voice-server/test/SpatialEngine.test.ts` verifying proximity calculations for `listen-only`, `isolated`, and `all` spectator modes, and verify tests pass with `npm test`.

## 3. Paper Plugin Configuration and Gameplay Mechanics

- [x] 3.1 Update `paper-plugin/src/main/resources/config.yml` with new `mechanics:` and `speakers:` configuration sections with clear explanatory comments and default values.
- [x] 3.2 Update `paper-plugin/src/main/java/com/voiceengine/config/VoiceConfig.java` to parse `whisper-on-sneak`, `underwater-acoustics`, `speaking-particles`, `spectator-mode`, `speakers.enabled`, and `speakers.particles-enabled` with safe fallbacks.
- [x] 3.3 Update `paper-plugin/src/main/java/com/voiceengine/telemetry/TelemetryCollector.java` and `PlayerSpatialState.java` to respect `whisper-on-sneak` (forcing `isSneaking = false` when disabled), `underwater-acoustics` (forcing `isSubmerged = false` when disabled), and tag `isSpectator` based on game mode and spectator mode settings.
- [x] 3.4 Update `paper-plugin/src/main/java/com/voiceengine/visual/SpeechFeedbackHandler.java` to conditionally render speaking note particles based on `speaking-particles` and suppress particles for spectators.
- [x] 3.5 Update `paper-plugin/src/main/java/com/voiceengine/speaker/SpeakerManager.java` and `SpeakerCommands.java` to respect `speakers.enabled` and `speakers.particles-enabled`.
- [x] 3.6 Update `VoiceEnginePlugin.java` to apply all mechanic toggles and wire dynamic in-place updates during `reloadPlugin()`.
- [x] 3.7 Verify the Paper plugin builds and passes unit tests with `./gradlew test`.

## 4. Documentation and Integration Verification

- [x] 4.1 Update `docs/plugin/paper/configuration.md` with detailed descriptions, defaults, and recommendations for the new `mechanics:` and `speakers:` configuration sections.
- [x] 4.2 Run end-to-end build verification across all 3 modules (`paper-plugin`, `voice-server`, `web-client`) and confirm zero regressions.
