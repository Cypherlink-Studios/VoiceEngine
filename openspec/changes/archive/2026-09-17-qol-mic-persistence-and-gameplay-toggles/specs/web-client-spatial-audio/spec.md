## ADDED Requirements

### Requirement: Microphone Mute State Persistence and Lifecycle
The web client SHALL persist user microphone mute preferences in local storage, initialize new sessions and WebRTC upstream tracks in the stored mute state without audio leakage, and retain the preference across session disconnections and deafen cycles.

#### Scenario: Restoring microphone mute state on connection
- **WHEN** a user opens or refreshes the web client with a previously persisted muted state (`voiceengine:mic_muted = true`) and connects voice
- **THEN** the client SHALL initialize the microphone processing pipeline in a muted state, keep the outgoing WebRTC audio track disabled, and reflect the muted state in the user interface.

#### Scenario: Persisting microphone mute toggle
- **WHEN** a user toggles the microphone mute button or activates the mute hotkey
- **THEN** the client SHALL immediately toggle audio transmission and persist the updated boolean state to `localStorage` under `voiceengine:mic_muted`.

#### Scenario: Preserving mute preference across disconnects
- **WHEN** a user disconnects their voice session or the session terminates
- **THEN** the client SHALL retain the persisted `voiceengine:mic_muted` value rather than resetting the mute state to unmuted.

#### Scenario: Restoring prior mute preference after undeafen
- **WHEN** a user toggles deafen mode off
- **THEN** the client SHALL restore the microphone mute state to the preference saved prior to deafening.
