# Proposal: Web Client & UX Enhancements

## Why

In VoiceEngine's zero-mod architecture, players run Minecraft in full screen or focused windows while the voice client operates in a browser tab or auxiliary device. Currently, players on single monitors must Alt+Tab to see active speakers, adjust volume, or check their mute status, and players onboarding via mobile lack dedicated companion conveniences (screen auto-locking, haptics). Additionally, players have no way to test their microphone/VAD settings before speaking, lack a global deafen option, and streamers risk leaking join tokens or coordinates.

Enhancing the web client with Document Picture-in-Picture, mobile companion utilities, mic diagnostics, deafen controls, streamer privacy mode, and direct radar interactions dramatically improves usability and immersion without introducing client-side Minecraft mods.

## What Changes

- **Document Picture-in-Picture Floating Overlay**: Add an always-on-top native OS overlay window using the `documentPictureInPicture` API, displaying a compact radar, speaking indicators, and quick mute/deafen controls.
- **Mobile Companion Mode & QR Onboarding**: Introduce a prominent QR code action to easily transfer the session to a smartphone/tablet, combined with the Screen Wake Lock API to prevent screen timeout and Vibration API haptic feedback on toggles.
- **Microphone Diagnostics & Self-Test Loopback**: Add a self-test loopback mode in settings allowing players to hear their own voice with real-time level meters and VAD threshold indicators before going live.
- **Deafen Mode**: Add a global deafen toggle (keyboard shortcut `D` and UI button) that mutes outgoing microphone transmission and silences all incoming audio streams with distinct procedural audio cues.
- **Streamer Privacy Mode**: Add a 1-click toggle that masks connection tokens, URLs, exact player coordinates, and server hostnames across the UI.
- **Interactive Radar & Audio Ducking**: Enable direct clicks on radar avatars to open quick volume and local mute popovers, and support automatic audio ducking of proximity chat when an incoming transmission occurs on a fixed radio channel.

## Capabilities

### New Capabilities
<!-- None: all behavior updates directly extend the web-client capability -->

### Modified Capabilities
- `web-client-spatial-audio`: Adds requirements for Document Picture-in-Picture overlay, mobile companion integrations (Wake Lock & QR), audio loopback diagnostics, deafen mode, streamer privacy masking, interactive radar avatar interactions, and radio channel audio ducking.

## Impact

- **Web Client**:
  - `web-client/src/routes/PlayerRoute.tsx`: Integrate deafen state, streamer mode state, PiP overlay spawning, ducking logic, and QR companion drawer.
  - `web-client/src/audio/SpatialAudioPipeline.ts`: Support master deafen gain routing, loopback node management, and audio ducking gain adjustments.
  - `web-client/src/components/Radar.tsx`: Enhanced avatar click handlers, mini variant for Picture-in-Picture, and coordinate masking for streamer mode.
  - `web-client/src/components/player/ControlDock.tsx`: Add deafen toggle button, overlay button, and QR companion toggle.
  - `web-client/src/components/player/SettingsModal.tsx`: Add mic test / loopback section with live level meter, streamer mode toggle, and ducking preferences.
  - `web-client/src/audio/SoundEffects.ts`: Add deafen / undeafen procedural sound cues.
- **Dependencies**: No external runtime libraries required (using standard Web APIs: `documentPictureInPicture`, `navigator.wakeLock`, `navigator.vibrate`, Web Audio API, and existing lucide icons).
- **Backend / Plugins**: Zero changes required on `paper-plugin`, `velocity-plugin`, or `voice-server`.
