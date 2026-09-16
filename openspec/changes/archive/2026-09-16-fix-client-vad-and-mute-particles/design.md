# Technical Design: Web Client Background VAD & Muted Particle Suppression

## Context
See `proposal.md` for motivation and background.

In the current implementation:
1. `MicrophonePipeline` schedules its audio analysis and VAD monitoring loop exclusively via `requestAnimationFrame(tick)`. Per HTML5 and browser power-management specifications, browsers suspend `requestAnimationFrame` entirely (0 Hz) when a tab is minimized or hidden, unless a Document Picture-in-Picture window is open. This causes VAD to freeze, gate gain to stay at 0.0, and the WebRTC audio track to remain disabled.
2. `PlayerRoute.tsx` invokes `signalingRef.current?.notifySpeaking(speaking)` directly from `onSpeakingChange`, transmitting `{ type: 'speaking', speaking: true }` over WebSocket to the voice server even when `isMutedRef.current` or `isDeafenedRef.current` is true.
3. In `voice-server/src/gateway/ClientGateway.ts`, the `case 'speaking':` handler sets `session.isSpeaking = !!msg.speaking` and dispatches `pluginGateway.notifySpeechStatus(session.playerUuid, session.isSpeaking)` to Paper without verifying if `session.isMuted` (e.g. server moderation mute) is active.

## Goals / Non-Goals

**Goals:**
- Provide uninterrupted microphone audio capture, VAD evaluation, and WebRTC audio transmission when the web client tab is minimized or running in the background without an active Picture-in-Picture window.
- Ensure that speaking notifications (`type: 'speaking'`) and in-game particle indicators (`speech_status`) are strictly suppressed whenever a player is muted (self-mute or moderation) or deafened.
- Provide defense-in-depth on the voice server so muted sessions never emit speaking state to Paper or radio channel peers.
- Guarantee clean fallback if Web Workers or Blob URLs are restricted by environment policies.

**Non-Goals:**
- Modifying the RNNoise C/WASM library or neural network weights.
- Altering the Paper plugin particle rendering implementation (which correctly responds to `speech_status` packets).
- Modifying the binary spatial telemetry protocol.

## Decisions

### 1. Dedicated Worker Ticker with AudioWorklet Coupling for MicrophonePipeline
- **Choice**: Implement a lightweight inline Web Worker ticker that emits a `tick` message at 25ms intervals (~40 Hz). Additionally, trigger immediate VAD evaluations whenever the active RNNoise `AudioWorkletNode` emits a `vad` probability message over its message port.
- **Rationale**: Web Workers execute in an isolated background thread that is exempt from browser window repaint pausing and aggressive timer throttling. AudioWorklet runs on the dedicated real-time audio thread (48kHz) and continuously processes audio frames regardless of document visibility. Combining both ensures the pipeline evaluates VAD with zero latency while retaining 100% reliability even if RNNoise is bypassed or in fallback mode.
- **Alternatives considered**:
  - *Window `setInterval` alone*: Throttled to 1000ms (1 Hz) by Chromium in background tabs after 5 minutes of inactivity, causing severe audio cutoffs.
  - *AudioWorklet alone*: Would not drive VAD when RNNoise is bypassed (user disabled AI noise suppression) or when running in Web Audio fallback mode.
  - *Pure `requestAnimationFrame`*: Stops completely on tab minimization.

### 2. Timestamp-Based Hangover Calculation
- **Choice**: Replace `this.hangoverTimer = setTimeout(...)` with monotonic timestamp tracking:
  ```typescript
  if (isSpeechDetected) {
    this.lastSpeechTime = performance.now();
    if (!this.isSpeaking) {
      this.isSpeaking = true;
      this.callbacks.onSpeakingChange?.(true);
      this.updateGateGain();
    }
  } else if (this.isSpeaking) {
    if (performance.now() - this.lastSpeechTime >= this.hangoverMs) {
      this.isSpeaking = false;
      this.callbacks.onSpeakingChange?.(false);
      this.updateGateGain();
    }
  }
  ```
- **Rationale**: `performance.now()` is immune to timer drift, throttling, or clearing race conditions. Every tick deterministically checks elapsed silence time.
- **Alternatives considered**: Retaining `setTimeout` with a Web Worker timer (adds unnecessary message passing overhead for a simple threshold comparison).

### 3. Centralized Audio Transmission & Speaking Synchronization in PlayerRoute
- **Choice**: Unify transmission gating and speaking notifications in `updateAudioTransmission`:
  ```typescript
  const updateAudioTransmission = (speaking: boolean, muted: boolean, deafened: boolean) => {
    const canTransmit = speaking && !muted && !deafened;
    if (sendTrackRef.current) {
      sendTrackRef.current.enabled = canTransmit;
    }
    signalingRef.current?.notifySpeaking(canTransmit);
    micPipelineRef.current?.setMuted(muted);
    micPipelineRef.current?.setDeafened(deafened);
    pipelineRef.current?.setLoopbackGated(canTransmit);
  };
  ```
  In `onSpeakingChange(speaking)`:
  ```typescript
  onSpeakingChange: (speaking) => {
    isSpeakingRef.current = speaking;
    setIsSpeaking(speaking && !isMutedRef.current && !isDeafenedRef.current);
    updateAudioTransmission(speaking, isMutedRef.current, isDeafenedRef.current);
  }
  ```
- **Rationale**: Eliminates multiple disjointed calls to `notifySpeaking` across `handleToggleMute`, `handleToggleDeafen`, `onModerationNotice`, and `onSpeakingChange`. Whenever any state variable changes, both the WebRTC track enablement and the WebSocket speaking notification are updated atomically.
- **Alternatives considered**: Retaining manual `notifySpeaking(false)` in mute handlers and filtering only in `onSpeakingChange` (leaves race conditions when unmuting while actively speaking).

### 4. Backend Guard in ClientGateway
- **Choice**: In `voice-server/src/gateway/ClientGateway.ts`:
  ```typescript
  case 'speaking': {
    if (!session) return;
    if (session.isMuted) {
      session.isSpeaking = false;
      return;
    }
    session.isSpeaking = !!msg.speaking;
    if (!session.activeChannel || session.activeChannel === 'proximity') {
      this.pluginGateway.notifySpeechStatus(session.playerUuid, session.isSpeaking);
    } else {
      this.broadcastChannelSpeaking(session);
    }
    break;
  }
  ```
- **Rationale**: Guarantees that even if an outdated or modified client sends `{ type: 'speaking', speaking: true }` while server-muted, the backend drops the state and never triggers particles in Minecraft or indicators in radio channels.

## Risks / Trade-offs

- **[Risk: Strict CSP blocking Blob Workers]**
  - *Mitigation*: Wrap Worker instantiation in a `try/catch` block. If `new Worker(blobUrl)` throws a `SecurityError` due to restrictive `worker-src` CSP directives, fall back gracefully to a standard `setInterval(..., 25)` ticker.
- **[Risk: AudioContext suspension in background tabs]**
  - *Mitigation*: Attach an `onstatechange` listener to `AudioContext` in `MicrophonePipeline` and `SpatialAudioPipeline` that automatically calls `resume()` if the browser attempts to suspend an active audio context.
