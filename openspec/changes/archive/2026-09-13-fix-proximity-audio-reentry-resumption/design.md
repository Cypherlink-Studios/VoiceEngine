## Context

See `proposal.md` for motivation. In the previous change (`fix-peer-churn-pipeline-freeze`), proximity distance culling was refactored to pause consumers (`consumer.pause()`) and ramp Web Audio gains to zero instead of destroying transceivers at 10 Hz. 

While this successfully prevented client freezes and SDP renegotiation thrashing, real-world testing revealed that when players walk out of range (> 30 blocks) and return on foot (<= 30 blocks), Chromium (Chrome, Edge, Brave) flags the incoming `MediaStreamTrack` as `muted = true` due to RTP packet starvation. Upon re-entering and receiving packets, Chromium fires `track.onunmute`, but the existing `MediaStreamAudioSourceNode` fails to resume pumping audio samples into the Web Audio graph, leaving the player permanently silent.

## Goals / Non-Goals

**Goals:**
- Guarantee immediate, seamless audio playback when players return into audible proximity on foot.
- Eliminate the Chromium Web Audio `MediaStreamAudioSourceNode` mute/unmute freeze without SDP renegotiation or tearing down the expensive HRTF `PannerNode`.
- Keep the browser WebRTC audio decoding pipeline active via an inaudible persistent sink (`volume = 0.0001`).
- Maintain player names on the radar UI across proximity exits and re-entries.
- Prevent stale consumers from persisting across speaker producer recreations.

**Non-Goals:**
- Reverting to destructive consumer destruction/recreation on 10 Hz distance boundary crossings.
- Modifying Minecraft Bukkit API or plugin telemetry structures.

## Decisions

### 1. Atomic `MediaStreamAudioSourceNode` Refresh on Unpause and Unmute
- **Decision**: In `SpatialAudioPipeline.ts`, when a peer transitions from paused to unpaused (`isPaused` becomes false) or when `track.onunmute` fires:
  ```ts
  peerNode.source.disconnect();
  peerNode.source = this.audioContext.createMediaStreamSource(new MediaStream([peerNode.track]));
  peerNode.source.connect(peerNode.filter || peerNode.gain);
  ```
- **Rationale**: Instantiating a `MediaStreamAudioSourceNode` takes < 0.05ms of CPU. By refreshing only the source node, we force Chromium to establish a fresh WebRTC audio consumer buffer connected to the now-flowing track, completely bypassing Chromium's unmuted-silence stall while keeping the heavy HRTF `PannerNode` and `BiquadFilterNode` graphs intact.
- **Alternatives Considered**: 
  - Full `removePeerStream` and `addPeerStream`: Rebuilding the entire HRTF convolution panner causes audio glitches and CPU spikes.
  - Relying on Chromium to unmute automatically: Known Chromium bug (Issue 1278201 / 40608933) where `MediaStreamAudioSourceNode` remains silent indefinitely.

### 2. Active Inaudible Sink (`volume = 0.0001`)
- **Decision**: In `SpatialAudioPipeline.ts`, configure the persistent `<audio>` element with `volume = 0.0001` and `muted = false`. Re-bind the sink's `srcObject` when new tracks are registered.
- **Rationale**: When an HTML `<audio>` element is `muted = true`, Chromium's media optimization pipeline can pause decoding of muted media elements. Setting `volume = 0.0001` (-80 dB) ensures Chromium's WebRTC audio rendering engine continues decoding incoming RTP packets in the background without causing direct unspatialized audio bleed.
- **Alternatives Considered**: Keeping `muted = true` (causes Chrome to sleep decoding) or creating per-peer audio elements (causes Windows WASAPI thrashing).

### 3. Identity Preservation in `peer_spatial_update`
- **Decision**: In `ClientGateway.ts`, include `peerUsername: peer.peerUsername` in every `peer_spatial_update` payload. In `VoiceSignaling.ts`, preserve the existing username or assign the provided `peerUsername` when re-entering audible range.
- **Rationale**: When players cross the 30-block threshold, `peersInfo` is pruned to clear the radar. When re-entering, `VoiceSignaling` previously defaulted to `'Player'` because `peer_spatial_update` lacked the username field.
- **Alternatives Considered**: Retaining out-of-range players in `peersInfo` with a hidden flag. This complicates radar state filtering; including `peerUsername` in the update payload is cleaner and stateless.

### 4. Producer ID Integrity Check on Server
- **Decision**: In `ClientGateway.ts`, before reusing an existing consumer, verify `consumer.producerId === speakerSession.producer.id`. If the speaker re-created their producer, close the stale consumer and instantiate a new one.
- **Rationale**: If a speaker refreshes or changes microphones, their session gets a new producer ID. Existing consumers on other clients become defunct and cannot be resumed.

## Risks / Trade-offs

- **[Risk]** Micro-clicks during source node reconnection.
  $\rightarrow$ **Mitigation**: When unpausing, `applyPeerGain` ramps the volume up from 0 with `setTargetAtTime(targetGain, currentTime, 0.03)`. Reconnecting the source node occurs during the zero-gain window, ensuring glitch-free resumption.
- **[Risk]** `volume = 0.0001` leakage on high-gain DACs.
  $\rightarrow$ **Mitigation**: At -80 dB, output amplitude is 0.01% of full scale, well below ambient acoustic noise floor.
