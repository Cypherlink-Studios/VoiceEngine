## MODIFIED Requirements

### Requirement: Voice Activity Detection (VAD) and Input Management
The client SHALL process local microphone input using a dedicated client-side audio DSP pipeline at 48kHz, integrating subsonic high-pass filtering, neural noise suppression, hybrid voice activity detection combining neural speech probability with volume thresholds, smooth envelope gating, input gain calibration, and automatic fallback.

#### Scenario: Voice activation threshold exceeded
- **WHEN** incoming microphone audio contains human speech where the neural speech probability exceeds the calibrated threshold (e.g., $P_{voice} \ge 0.65$) and exceeds minimum background volume
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
