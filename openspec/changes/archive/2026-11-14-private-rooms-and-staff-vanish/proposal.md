# Proposal

## Why

Players currently only have access to 3D spatial proximity voice chat or pre-configured fixed channels, lacking the ability to form spontaneous, private audio rooms for teams, mini-games, or friend groups without proximity distance attenuation. Additionally, server staff investigating voice chat rule violations have no way to observe or approach players acoustically without revealing their presence through WebRTC streams, radar icons, or in-game speech particles.

This change introduces dynamic temporary private rooms accessible via a random 6-digit PIN, along with a zero-leak staff vanish mode that enables covert proximity eavesdropping and mutual staff communication while remaining completely undetectable to regular players.

## What Changes

- **Temporary Private Rooms**:
  - Ephemeral stereo audio rooms isolated from proximity 3D audio, created on-demand either in-game (`/voice room create`) or via the web client.
  - Access controlled by a unique, random 6-digit numeric PIN with rate-limiting protection against brute-force attempts.
  - In-game commands (`/voice room join <pin>`, `/voice room leave`, `/voice room kick <player>`) and web client UI controls (PIN keypad modal, member roster, kick button).
  - Configurable maximum room capacity in `paper-plugin` `config.yml` (default unlimited: `0`).
  - Automatic owner transfer upon owner disconnect and a 30-second empty room grace period before destruction and PIN recycling.
  - Administrative room wiretapping (`/voice room spy <playerName>`) allowing staff to listen silently to any player's room without needing the PIN and without appearing on the room roster.

- **Staff Voice Vanish (Zero-Leak Stealth)**:
  - Stealth toggle command (`/voice vanish` / `/voice staff`) with permission `voiceengine.admin.vanish`, plus optional automatic hooks into Paper vanish plugins (EssentialsX, SuperVanish, PremiumVanish).
  - Strict zero-leak guarantee: no WebRTC consumers created on regular players' transports, spatial coordinates omitted from proximity batches, speech particles suppressed in-game, and icons omitted from web radar.
  - Mutual staff-to-staff awareness: staff members in vanish mode hear each other in 3D audio and appear on each other's radar, but remain entirely invisible to non-staff players.
  - Session persistence across web client reloads and network reconnections to prevent accidental acoustic leakage.

## Capabilities

### New Capabilities
- `temporary-private-rooms`: Ephemeral unspatialized audio rooms secured by random 6-digit PINs, rate-limited join attempts, room owner kick moderation, auto-lifecycle cleanup, and staff wiretap integration.
- `staff-voice-vanish`: Zero-leak acoustic vanish system for server staff, enforcing WebRTC consumer suppression, proximity culling, in-game particle suppression, staff-to-staff mutual routing, and persistent stealth sessions.

### Modified Capabilities
<!-- None -->

## Impact

- **`voice-server`**:
  - New `RoomManager` module to manage temporary room lifecycles, PIN generation/validation, rate limits, and membership.
  - Updates to `ClientGateway` for room WebSocket events (`room_create`, `room_join`, `room_leave`, `room_kick`, `room_spy`, `staff_vanish_toggle`).
  - Updates to `SpatialEngine` to cull vanished staff from regular players' proximity evaluations while enabling mutual staff-to-staff routing.
  - Updates to `MediasoupManager` consumer creation rules to prevent regular clients from creating consumers for vanished staff producers.
- **`paper-plugin`**:
  - New commands under `/voice room` and `/voice vanish` with contextual tab completion.
  - Updates to `TelemetryCollector` and `PlayerSpatialState` to include staff vanish flags.
  - Updates to `SpeechFeedbackHandler` and `VisualFeedbackService` to suppress particle emission for vanished staff.
  - New configuration entries in `config.yml` for room capacity limits and vanish auto-hooking.
- **`web-client`**:
  - New UI components in `ChannelDrawer` for temporary rooms, PIN entry keypad, room roster, and kick controls.
  - Visual status indicator in `ControlDock` when Staff Vanish mode is active.
  - Logic to bypass spatial HRTF panners when receiving stereo audio from a temporary room or room spy.
