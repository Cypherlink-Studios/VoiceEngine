## Context

VoiceEngine routes audio across multiple mediasoup SFU worker routers using WebRTC. Currently, `voice-server/src/config.ts` defines `audio/opus` in `mediaCodecs` with only basic clock rate and channel count, omitting codec parameters (`parameters`) such as `useinbandfec`, `usedtx`, and bitrate bounds. In addition, the web client's `VoiceSignaling.ts` does not pass `codecOptions` when calling `sendTransport.produce()`.

See `proposal.md` for problem statement and motivation.

## Goals / Non-Goals

**Goals:**
- Enable transparent packet loss recovery through Opus In-Band Forward Error Correction (FEC) across client-to-SFU and SFU-to-client hops.
- Enable Discontinuous Transmission (DTX) to drastically cut packet transmission rates during silence intervals.
- Expose server configuration settings for Opus bitrate (`OPUS_MAX_AVERAGE_BITRATE`, default: 64000 bps) and packet framing.
- Ensure seamless interoperability with mediasoup's multi-worker `PipeTransport` routing.

**Non-Goals:**
- Video or screen-sharing codecs (strictly audio/opus).
- Client-side acoustic spatial absorption curves (deferred to Phase 3: Post-Procesado Acústico & Master Salida).

## Decisions

### 1. Mediasoup `mediaCodecs` Configuration
- **Choice**: Populate `parameters` on the `audio/opus` entry in `config.ts`:
  ```typescript
  parameters: {
    useinbandfec: 1,
    usedtx: 1,
    maxaveragebitrate: opusMaxAverageBitrate, // default 64000
    stereo: 1,
    'sprop-stereo': 1,
    ptime: 20,
    minptime: 10,
    maxptime: 60,
  }
  ```
- **Rationale**: Mediasoup includes these parameters in `router.rtpCapabilities`. When `mediasoup-client` runs `device.load({ routerRtpCapabilities })`, it constructs the local WebRTC SDP offers and RTCRtpSenders using these parameters.
- **Alternatives Considered**: Modifying SDP lines manually on the client (brittle and discouraged by mediasoup-client design).

### 2. Client Producer `codecOptions`
- **Choice**: Pass explicit `codecOptions` in `web-client/src/net/VoiceSignaling.ts`:
  ```typescript
  this.sendTransport.produce({
    track: micTrack,
    codecOptions: {
      opusFec: true,
      opusDtx: true,
      opusMaxaveragebitrate: 64000,
    },
  });
  ```
- **Rationale**: Guarantees that the browser's native WebRTC encoder activates the Opus LBRR (Low Bitrate Redundancy) engine and silence frame throttling.
- **Alternatives Considered**: Relying solely on router SDP negotiation (some Chromium versions require producer `codecOptions` to enforce DTX).

### 3. Transport Bitrate & Buffer Allocation
- **Choice**: Increase `initialAvailableOutgoingBitrate` in `config.mediasoup.webRtcTransport` to 128000 bps (supporting multiple concurrent spatial streams without initial ramp-up delay).

## Risks / Trade-offs

- **[Risk]** Slightly higher encoding CPU usage when FEC embeds redundant packets during packet loss.
  - *Mitigation*: Opus LBRR only adds ~10-15% overhead to packet payload and is natively optimized in C/assembly within browser WebRTC cores.
- **[Risk]** DTX comfort noise packets might create perceived gate cutting if VAD hangover is too short.
  - *Mitigation*: Our Phase 1 `MicrophonePipeline` already provides smooth 15ms exponential gating and 250ms hangover duration, ensuring clean transitions into DTX silence.
