# Tasks

## 1. Backend Core & Room Management (`voice-server`)

- [x] 1.1 Implement `RoomManager.ts` supporting collision-free 6-digit PIN generation, join rate limiting (max 5 failed attempts per minute with 60s lockout), room owner tracking, member kick actions, automatic owner transfer on departure, and 30-second empty room grace destruction. Verify with unit tests in `voice-server/test/RoomManager.test.ts`.
- [x] 1.2 Update `SpatialEngine.ts` to support staff vanish evaluation: regular players ignore vanished staff in proximity and deadband updates, while staff-to-staff proximity remains audible and visible. Verify with unit tests in `voice-server/test/SpatialEngine.test.ts`.
- [x] 1.3 Update `ClientGateway.ts` to handle `room_create`, `room_join`, `room_leave`, `room_kick`, `room_spy`, and `staff_vanish_toggle` messages, enforcing stereo unspatialized audio routing and zero-leak Mediasoup consumer creation rules. Verify with integration tests in `voice-server/test/ClientGateway.test.ts`.
- [x] 1.4 Update `PluginGateway.ts` to exchange room actions, active room member statuses, and staff vanish state updates with connected Paper servers. Verify with tests in `voice-server/test/PluginGateway.test.ts`.

## 2. Paper Plugin Commands & Telemetry (`paper-plugin`)

- [x] 2.1 Update `PlayerSpatialState` and `TelemetryCollector.java` to include `isStaffVanish` in telemetry batches dispatched to the voice server. Verify with unit tests in `paper-plugin/src/test/java/com/voiceengine/telemetry/TelemetryCollectorTest.java`.
- [x] 2.2 Update `SpeechFeedbackHandler.java` and `VisualFeedbackService.java` to suppress speaking particles and glow indicators when the speaking player is in staff vanish mode. Verify with unit tests in `paper-plugin/src/test/java/com/voiceengine/visual/SpeechFeedbackHandlerTest.java`.
- [x] 2.3 Implement in-game commands under `/voice room` (`create`, `join <pin>`, `leave`, `kick <player>`, `spy <playerName>`) and `/voice vanish` / `/voice staff` in `paper-plugin` with permissions and tab completion. Verify with command execution and tab completion tests in `paper-plugin/src/test/java/com/voiceengine/command/`.
- [x] 2.4 Add configuration entries for `rooms.max-members` and `vanish.auto-hook` to `config.yml`, and implement event listeners to synchronize with server vanish plugins (EssentialsX, SuperVanish, PremiumVanish) or `PlayerHideEvent`. Verify with configuration and listener unit tests.

## 3. Web Client Interface & Audio Pipeline (`web-client`)

- [x] 3.1 Update `VoiceSignaling.ts` to handle room protocol frames (`room_created`, `room_joined`, `room_left`, `room_kicked`, `room_members`, `room_error`, `staff_status`) and propagate state changes to the UI and audio pipeline. Verify with client signaling tests.
- [x] 3.2 Update `SpatialAudioPipeline.ts` to bypass 3D HRTF panners when receiving audio from a temporary room or room wiretap, routing audio in stereo unattenuated. Verify with audio pipeline tests.
- [x] 3.3 Implement the Temporary Rooms interface in `ChannelDrawer.tsx`, including the room creation trigger, 6-digit PIN input pad with rate-limit feedback, room roster with owner kick action, and leave button, localized in English and Spanish. Verify with component tests.
- [x] 3.4 Implement the Staff Vanish status indicator in `ControlDock.tsx` and ensure vanished staff are excluded from `Radar.tsx` unless the viewing user is also authorized staff. Verify with component rendering and radar tests.

## 4. End-to-End Verification & Integration Testing

- [x] 4.1 Run full test suites across `voice-server` (`npm test`), `paper-plugin` (`./gradlew test`), and `web-client` (`npm test` / build check) to verify zero build regressions.
- [x] 4.2 Verify zero-leak acoustic security by asserting that simulated regular player WebRTC transports receive no consumer creation events or spatial coordinate packets when approached by a vanished staff member.
