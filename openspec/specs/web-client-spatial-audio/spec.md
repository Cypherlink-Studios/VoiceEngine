# web-client-spatial-audio Specification

## Purpose
Delivers a zero-mod web interface that captures microphone audio with voice activity detection, renders 3D binaural spatialized audio, and visualizes nearby players.

## Requirements

### Requirement: One-Click Connection and Microphone Acquisition
The web client SHALL support instant onboarding through URL tokens, acquiring microphone input and establishing the WebRTC audio session upon a single user interaction.

#### Scenario: One-click session initialization
- **WHEN** a player opens the web client via the link provided in-game and clicks the connect button
- **THEN** the client SHALL initialize the browser AudioContext, request microphone media access, and initiate WebRTC negotiation with the SFU.

#### Scenario: Player avatar and identity display
- **WHEN** session credentials are authenticated by the backend
- **THEN** the client UI SHALL display the user's Minecraft username, avatar render, and connection latency.

### Requirement: Voice Activity Detection (VAD) and Input Management
The client SHALL process local microphone input using a dedicated client-side audio DSP pipeline at 48kHz, integrating subsonic high-pass filtering, neural noise suppression, hybrid voice activity detection combining neural speech probability with volume thresholds, smooth envelope gating, input gain calibration, and automatic fallback.

#### Scenario: Voice activation threshold exceeded
- **WHEN** incoming microphone audio contains human speech where the neural speech probability exceeds the calibrated threshold (e.g., $P_{voice} \ge 0.65$) and exceeds minimum background volume while the client is unmuted
- **THEN** the client SHALL transition the upstream audio gain to full volume using an exponential smooth attack envelope (~15ms), transmit audio packets over WebRTC, and notify the backend of active speech.

#### Scenario: Silence and hangover duration
- **WHEN** neural speech probability or input volume drops below the active threshold for longer than the configured hangover duration (e.g., 250ms)
- **THEN** the client SHALL ramp down the upstream audio gain using an exponential smooth release envelope (~15ms) before muting transmission, eliminating digital audio clicks and popping.

#### Scenario: Neural noise suppression of non-speech audio
- **WHEN** the microphone captures non-speech background noise (such as mechanical keyboard keystrokes, PC cooling fans, desk taps, or ambient hum) while AI noise suppression is enabled
- **THEN** the RNNoise AudioWorklet SHALL suppress the ambient noise from the outgoing audio stream, compute a low speech probability ($P_{voice} \approx 0$), and maintain the transmission gate in a closed state.

#### Scenario: Subsonic rumble filtering
- **WHEN** microphone input contains sub-audible low-frequency noise below 80Hz (such as desk thumps, AC hum, or plosive breath pops)
- **THEN** the input pipeline SHALL filter the signal through an 80Hz high-pass biquad filter prior to worklet processing and transmission.

#### Scenario: Input gain calibration and peak limiting
- **WHEN** a user adjusts the microphone input gain slider between 0% and 200%
- **THEN** the client SHALL scale the input signal by the configured multiplier and route it through a soft-knee compressor to prevent digital clipping before WebRTC encoding.

#### Scenario: Graceful fallback when WebAssembly or AudioWorklet is unsupported
- **WHEN** the user's browser or environment fails to initialize WebAssembly or register the AudioWorklet processor
- **THEN** the client SHALL fall back immediately to standard browser constraints (native noise suppression and RMS volume-based VAD) without terminating the audio call or interrupting the user session.

#### Scenario: Toggling AI noise suppression
- **WHEN** a user toggles the AI noise suppression option in settings
- **THEN** the input pipeline SHALL bypass or re-enable the RNNoise worklet processing stage in real time without renegotiating the WebRTC PeerConnection or dropping the stream.

#### Scenario: Continuous background and minimized tab VAD operation
- **WHEN** the web client tab is minimized, placed in the background, or running without an active Document Picture-in-Picture overlay
- **THEN** the audio input pipeline SHALL continue evaluating voice activity detection and upstream transmission gating via unthrottled background timers or audio thread worklet cycles, maintaining active microphone communication without interruption.

#### Scenario: Speech notification suppression during mute or deafen
- **WHEN** local microphone input exceeds voice detection thresholds while the user is locally muted, deafened, or server-moderation muted
- **THEN** the web client SHALL suppress speech notification signals to the signaling server, maintain the WebRTC audio send track in a disabled state, and refrain from rendering the speaking ring on the user's local avatar.

### Requirement: Binaural 3D Spatial Audio Rendering
The web client SHALL process incoming peer audio streams through the Web Audio API using HRTF `PannerNode` instances positioned according to in-game relative coordinates and orientations parsed from batched binary or JSON telemetry frames, dynamic distance-based atmospheric absorption filtering, an underwater muffled low-pass filter, master output bus brickwall peak limiting, or bypass spatialization when receiving broadcast audio.

#### Scenario: Dynamic 3D positional positioning
- **WHEN** relative position updates are received for an audible peer via binary `ArrayBuffer` batch frames or fallback JSON frames without broadcast flags
- **THEN** the client SHALL interpolate and apply the X, Y, and Z offsets to that peer's `PannerNode` relative to the local listener's yaw and pitch using smooth linear ramp transitions.

#### Scenario: Deadband position retention
- **WHEN** an audible peer is omitted from an incoming tick's spatial batch due to server-side deadband suppression
- **THEN** the client SHALL retain the peer's existing PannerNode position and audio routing without resetting coordinates or pausing audio playback.

#### Scenario: Submerged low-pass acoustic filtering
- **WHEN** spatial telemetry flags that either the listener or speaker is submerged in water
- **THEN** the client SHALL route the incoming stream through a BiquadFilterNode configured as a low-pass filter to produce muffled acoustic damping at 600 Hz cutoff, overriding distance air absorption.

#### Scenario: Atmospheric distance frequency absorption
- **WHEN** an audible proximity peer is not submerged and positioned at distance $d$ from the listener
- **THEN** the client SHALL adjust that peer's BiquadFilterNode cutoff frequency according to distance, rolling off high frequencies from 20 kHz at close proximity ($d \le 2$ blocks) down to approximately 3.5 kHz at maximum distance ($d \ge 30$ blocks) using smooth parameter automation.

#### Scenario: Master output bus brickwall limiting and anti-clipping
- **WHEN** multiple peer audio streams, sound effects, or media tracks play simultaneously and exceed 0 dBFS
- **THEN** the master output stage SHALL route the combined mix through a brickwall DynamicsCompressorNode limiter (`threshold: -1.5 dB`, `ratio: 20:1`, fast attack) before final hardware output, transparently preventing digital clipping and distortion.

#### Scenario: Proximity radar visualization
- **WHEN** audible players are within proximity range
- **THEN** the client UI SHALL display their relative distance, direction, and speaking activity on a radar display.

#### Scenario: Speaker block 2D broadcast bypass
- **WHEN** incoming peer audio is flagged with `isBroadcast: true`
- **THEN** the client SHALL route the audio stream directly to master output gain, bypassing the 3D HRTF `PannerNode` to deliver uniform stereo audio across the speaker block's coverage area.

### Requirement: Dual-Mode Audio Switching (Proximity vs Fixed Channels)
The web client SHALL support switching between 3D spatialized proximity chat and unattenuated stereo fixed channels.

#### Scenario: Switching to a fixed channel
- **WHEN** a player selects a fixed channel from the channel drawer
- **THEN** the client SHALL switch incoming audio routing to unspatialized stereo, bypass the 3D panner, and attenuate or mute proximity audio.

#### Scenario: Switching back to proximity
- **WHEN** a player selects the proximity channel
- **THEN** the client SHALL reactivate 3D HRTF spatial panners and distance attenuation according to in-game coordinates.

### Requirement: Reactive Audio Waveform Visualizer
The web client SHALL render a real-time reactive audio waveform in the control dock to visualize microphone audio levels and speech activity.

#### Scenario: Speech audio waveform rendering
- **WHEN** local microphone input detects active speech
- **THEN** the UI SHALL animate a dynamic audio wave indicating volume and voice activity.

### Requirement: Enhanced Radar with Minecraft Head Skins
The radar display SHALL render player Minecraft head skins retrieved by player UUID and display relative elevation indicators.

#### Scenario: Rendering player skin and elevation
- **WHEN** a nearby player appears on the proximity radar
- **THEN** the radar SHALL render their Minecraft avatar head and indicate whether they are above, level with, or below the listener's elevation.

### Requirement: Dynamic Brand Theme Application
The web client SHALL query `/api/config/public` upon loading and dynamically apply configured colors, logos, titles, and background assets.

#### Scenario: Brand styling initialization
- **WHEN** the web client loads
- **THEN** it SHALL fetch the public brand configuration and apply the primary and accent colors to CSS variables and render server branding.

### Requirement: Audio Device Selection and Dynamic Stream Switching
The web client SHALL enumerate audio input and output devices, persist selected device IDs across sessions, and dynamically switch streams at runtime without terminating the WebRTC session.

#### Scenario: Selecting a different input microphone at runtime
- **WHEN** a connected user selects a different microphone device in the settings modal
- **THEN** the client SHALL acquire the new media stream from `navigator.mediaDevices.getUserMedia`, hot-swap the upstream audio track on the active Mediasoup producer, re-bind the VAD analyzer, and persist the choice in `localStorage`.

#### Scenario: Selecting an output playback device
- **WHEN** a user selects an output playback device (speakers or headphones)
- **THEN** the client SHALL route the `AudioContext` destination to the chosen sink via `setSinkId` if supported, fall back gracefully if unsupported, and persist the choice in `localStorage`.

#### Scenario: Audio processing constraint toggling
- **WHEN** a user toggles echo cancellation, noise suppression, or auto gain control in settings
- **THEN** the client SHALL re-acquire the microphone stream applying the updated audio constraints and replace the active producer track.

### Requirement: Per-User Volume Attenuation and Local Mute
The web client SHALL allow listeners to adjust the playback gain of individual peers between 0% and 200% and apply local mutes independently from server-side state.

#### Scenario: Adjusting a specific player volume gain
- **WHEN** a user adjusts the volume slider for a specific player UUID (from the radar, channel drawer, or settings modal)
- **THEN** the client SHALL apply the multiplier to that peer's `GainNode` in the audio pipeline and save the preference in `localStorage`.

#### Scenario: Muting a specific player locally
- **WHEN** a user enables the local mute toggle for a specific player UUID
- **THEN** the client SHALL set that peer's audio gain to zero without impacting other connected listeners or notifying the muted player.

### Requirement: Procedural User Interface Sound Effects
The web client SHALL generate procedural audio feedback chimes using the Web Audio API for interactive voice state transitions without downloading external media files.

#### Scenario: Audio feedback chime on mute state change
- **WHEN** a user mutes or unmutes their microphone
- **THEN** the client SHALL play a distinct procedural sound effect chime if sound effects are enabled.

#### Scenario: Audio feedback chime on channel transition
- **WHEN** a user switches between proximity chat and a fixed voice channel
- **THEN** the client SHALL play a distinct transitional sound effect chime.

### Requirement: Keyboard Shortcuts and Accessibility Navigation
The web client SHALL provide keyboard shortcut bindings for essential voice actions with text-input guardrails and modal dismissal.

#### Scenario: Toggling mute via keyboard shortcut
- **WHEN** a user presses the `M` key while the document focus is not on an editable text input or textarea
- **THEN** the client SHALL toggle microphone mute state and trigger the corresponding audio feedback.

#### Scenario: Dismissing modals and overlays via Escape
- **WHEN** a user presses the `Escape` key while a modal, drawer, or popover is open
- **THEN** the client SHALL close the active overlay.

### Requirement: Network Latency Monitoring and Visual Quality Indicator
The web client SHALL periodically probe round-trip latency to the voice backend and display an intuitive visual connection health indicator in the control dock.

#### Scenario: Probing round-trip latency and displaying connection health
- **WHEN** the client receives a pong response to its periodic ping probe
- **THEN** the client SHALL calculate the round-trip time in milliseconds and render a color-coded status badge in the control dock.

### Requirement: Document Picture-in-Picture Floating Overlay
The web client SHALL support launching an always-on-top floating native window using the Document Picture-in-Picture API, rendering real-time radar and essential voice controls without requiring browser window focus.

#### Scenario: Launching floating overlay window
- **WHEN** a connected user clicks the "Floating Overlay" button on a browser supporting Document Picture-in-Picture
- **THEN** the client SHALL open a native floating window containing a compact radar, speaking indicators, latency status, and mute/deafen toggle controls while mirroring styling and active state.

#### Scenario: Graceful fallback when Picture-in-Picture is unsupported
- **WHEN** a user is running a browser without Document Picture-in-Picture support
- **THEN** the client SHALL hide the overlay trigger or display an informative tooltip indicating browser incompatibility without errors.

#### Scenario: Bi-directional state synchronization
- **WHEN** a user toggles mute or deafen from inside the floating overlay window
- **THEN** the primary tab SHALL immediately reflect the state change and apply the corresponding audio mutations and sound effects.

### Requirement: Mobile Companion Integration and Screen Wake Lock
The web client SHALL provide mobile companion utilities including instant QR code session transfer, screen wake lock retention, and tactile haptic feedback.

#### Scenario: Displaying session QR code for mobile companion
- **WHEN** a user opens the mobile companion drawer or modal
- **THEN** the client SHALL generate and render a scannable QR code encoding the direct URL with the active session token.

#### Scenario: Acquiring and maintaining screen wake lock
- **WHEN** the web client connects on a mobile device supporting the Screen Wake Lock API
- **THEN** the client SHALL request a screen wake lock to prevent the device display from sleeping during an active voice session, releasing the lock upon disconnection.

#### Scenario: Haptic feedback vibration on voice toggles
- **WHEN** a user toggles mute or deafen on a device supporting `navigator.vibrate`
- **THEN** the client SHALL emit a short tactile vibration pulse (e.g. 30ms-50ms).

### Requirement: Microphone Diagnostic Loopback and Visual Calibration
The web client SHALL provide a real-time self-monitoring loopback mechanism with visual level metering to verify input quality and calibrate voice activity thresholds.

#### Scenario: Starting microphone loopback test
- **WHEN** a user activates the "Mic Test" toggle within the settings modal
- **THEN** the client SHALL route the local microphone stream through a delay buffer into the local audio output without transmitting to the SFU or remote peers.

#### Scenario: Visual VAD threshold feedback
- **WHEN** speaking during the mic test
- **THEN** the UI SHALL render an input meter indicating current RMS amplitude alongside the configured VAD threshold marker to clearly signal when speech triggers transmission.

### Requirement: Deafen Mode and Incoming Audio Suppression
The web client SHALL support a global deafen mode that simultaneously mutes local microphone transmission and silences all incoming audio streams.

#### Scenario: Toggling deafen mode via UI and keyboard shortcut
- **WHEN** a user clicks the deafen button or presses the `D` key while focus is outside of a text input
- **THEN** the client SHALL toggle deafen state, setting master incoming audio gain to zero and muting the microphone producer track.

#### Scenario: Procedural deafen audio feedback
- **WHEN** deafen state is enabled or disabled
- **THEN** the client SHALL play a distinct procedural audio chime indicating the state transition.

### Requirement: Streamer Privacy Masking Mode
The web client SHALL provide a streamer mode toggle that conceals sensitive server details, tokens, and coordinates from UI displays.

#### Scenario: Masking sensitive tokens and coordinates
- **WHEN** streamer mode is enabled
- **THEN** the client SHALL mask the join token, session URL parameters, server hostnames, and exact relative coordinates in player inspection popovers with obfuscated placeholders.

### Requirement: Interactive Radar Peer Control and Radio Audio Ducking
The web client SHALL allow direct interaction with peers on the proximity radar and support automatic attenuation of proximity chat when active speech occurs on a fixed radio channel.

#### Scenario: Quick peer popover interaction from radar avatar click
- **WHEN** a user clicks on an avatar icon on the proximity radar
- **THEN** the client SHALL open the volume and mute popover anchored to that specific player.

#### Scenario: Proximity audio ducking during radio channel speech
- **WHEN** audio packets are received from a peer speaking in an active fixed radio channel while proximity audio is enabled
- **THEN** the client SHALL temporarily attenuate proximity audio volume by 50% for the duration of the radio transmission.

### Requirement: Persistent WebRTC Audio Sink and Seamless Stream Lifecycle
The web client SHALL maintain an active WebRTC audio sink and resilient source node lifecycle to prevent Chromium audio decoder stalls, avoiding repeated DOM element thrashing per peer while guaranteeing seamless audio resumption upon proximity re-entry.

#### Scenario: Persistent dummy audio sink maintenance
- **WHEN** the spatial audio pipeline initializes
- **THEN** the client SHALL maintain a single persistent `<audio>` element with an inaudible volume level (`volume = 0.0001`) attached to remote streams, preventing audio hardware underruns and WASAPI thrashing while keeping Chromium WebRTC audio decoding active in the background.

#### Scenario: Distance pausing without Web Audio graph destruction
- **WHEN** an existing peer stream is paused due to distance attenuation or out-of-range culling
- **THEN** the audio pipeline SHALL smoothly ramp that peer's `GainNode` to zero and retain the instantiated audio nodes (HRTF PannerNode, BiquadFilterNode) without destroying the spatial graph.

#### Scenario: Atomic source node reconnection upon resumption or track unmuting
- **WHEN** a peer spatial update signals `isPaused: false` or the peer's `MediaStreamTrack` emits an `unmute` event after an inaudible pause period
- **THEN** the audio pipeline SHALL atomically re-instantiate only the `MediaStreamAudioSourceNode` for that peer's track and reconnect it to the existing filter/panner/gain graph, bypassing Chromium's Web Audio unmuted-silence stall while preserving the HRTF convolution state.

#### Scenario: Background AudioContext state recovery
- **WHEN** spatial updates arrive while the browser `AudioContext` is suspended due to background tab throttling or user inactivity
- **THEN** the pipeline SHALL automatically invoke `resume()` on the `AudioContext` to restore active clock progression and audio sample processing.

#### Scenario: Throttled radar and peer state dispatch
- **WHEN** peer spatial updates or membership changes arrive from the WebSocket
- **THEN** the client SHALL update the audio pipeline in real time and throttle React state dispatches to avoid UI frame drops and avatar asset request storms.

### Requirement: Persistent Device Fingerprint Generation
The web client SHALL generate and store a persistent cryptographic device identifier in browser storage to detect alternate account connections from the same machine.

#### Scenario: Client transmits device ID during handshake
- **WHEN** the web client connects and authenticates with the voice backend
- **THEN** the client SHALL load or generate a persistent UUID stored in `localStorage` and transmit it inside the `client_auth` frame.

### Requirement: Moderation Status UI Banner
The web client SHALL display clear visual status indicators when a player is subjected to moderation sanctions.

#### Scenario: Muted or deafened banner notification
- **WHEN** the client receives a `moderation_notice` frame indicating an active mute or deafen
- **THEN** the UI SHALL render an alert banner detailing the sanction type, reason, and remaining duration, and disable the corresponding microphone input controls.

### Requirement: Synchronized Media Pipeline and Linear Distance Attenuation
The web client SHALL maintain a dedicated media audio pipeline that synchronizes playback time with the voice server and renders 3D spatial emitters using linear distance attenuation.

#### Scenario: Clock synchronization via lightweight WebSocket NTP
- **WHEN** the web client connects or receives server time sync frames
- **THEN** the client SHALL calculate the round-trip latency and clock offset (`clockOffset = serverTime - (clientTime + rtt / 2)`) to align client time with the voice server.

#### Scenario: Absolute offset seeking upon entering emitter radius
- **WHEN** a listener moves within the radius of an active spatial emitter
- **THEN** the client SHALL initialize playback at the exact elapsed offset (`(clientNow + clockOffset - startedAt) % duration`), aligning playback with other listeners.

#### Scenario: Linear distance attenuation rendering
- **WHEN** a spatial audio emitter is within audible radius
- **THEN** the client SHALL connect the stream to a `PannerNode` configured with `distanceModel = 'linear'`, attenuating volume proportionally to distance until reaching zero at max radius.

#### Scenario: Node suspension when out of audible radius
- **WHEN** the listener moves beyond the radius of an active spatial emitter
- **THEN** the client SHALL pause the `<audio>` element and disconnect the `PannerNode` to conserve browser CPU and audio decoding resources.

### Requirement: Isolated Client-Side Media Volume Control
The web client SHALL provide separate local volume controls for media emitters that do not impact player voice volume or global server playback state.

#### Scenario: User adjusts media volume slider
- **WHEN** a user adjusts the "Media & Music Volume" slider in the settings modal
- **THEN** the client SHALL adjust the gain multiplier on the dedicated `mediaBusGain` node without affecting `proximityBusGain` or incoming peer volumes.

#### Scenario: User toggles media mute
- **WHEN** a user activates the "Mute Media" toggle
- **THEN** the client SHALL mute the `mediaBusGain` node, silencing all background music and emitters while keeping proximity and channel voice chat fully audible.

### Requirement: Client Localization and Multilingual Interface (i18n)
The web client SHALL support full internationalization and dynamic localization across all user-facing interface elements, providing matching dictionaries for English (`en`) and Spanish (`es`), automatic locale detection with cascading fallbacks, and real-time language switching without interrupting active audio sessions.

#### Scenario: URL parameter locale initialization
- **WHEN** a player navigates to the web client with a `lang` URL query parameter specifying a supported language code (e.g., `?lang=es` or `?lang=en`)
- **THEN** the client SHALL initialize its interface in the designated language, update the current locale state, and persist the preference to local storage.

#### Scenario: User preference persistence
- **WHEN** a player explicitly selects a language through the header quick switcher or the Settings preferences tab
- **THEN** the client SHALL immediately update all rendered text strings in the UI, persist the selection to `localStorage` under `voiceengine:language`, and maintain this selection across page reloads.

#### Scenario: Browser locale automatic detection
- **WHEN** the client is loaded without a URL `lang` parameter and without an existing `localStorage` preference
- **THEN** the client SHALL evaluate `navigator.language`, selecting Spanish if the language tag begins with `es` (e.g., `es-ES`, `es-419`, `es-MX`), and defaulting to English for all other locales.

#### Scenario: Runtime fallback for missing translation keys
- **WHEN** a translation key requested by a component is missing or incomplete in the currently selected locale dictionary
- **THEN** the translation engine SHALL fall back to the corresponding key in the primary English (`en`) dictionary, avoiding blank labels or rendering errors.

#### Scenario: Dynamic variable interpolation
- **WHEN** a localized string template contains named interpolation placeholders (e.g., `{count}` for player counts or `{ms}` for latency)
- **THEN** the translation function SHALL substitute the provided parameter values into the template and return the fully formatted text.

#### Scenario: Seamless language switching during active voice call
- **WHEN** a user changes the interface language while an active WebRTC voice session and spatial audio rendering are in progress
- **THEN** the client SHALL update all visual components and labels instantly without renegotiating WebRTC peer connections, resetting AudioContext state, or disrupting voice transmission.
