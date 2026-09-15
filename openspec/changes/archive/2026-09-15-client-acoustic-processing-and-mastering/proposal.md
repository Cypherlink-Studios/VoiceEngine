## Why

Natural acoustic perception of distance relies heavily on atmospheric air absorption, where high frequencies attenuate more rapidly than low frequencies as distance increases. Additionally, when multiple peers speak simultaneously in proximity chat or when background media/procedural sound effects are playing, their combined signals linearly accumulate and can exceed 0 dBFS, causing harsh digital clipping and distortion on players' headphones.

## What Changes

- **Atmospheric Distance Frequency Absorption**: Implement a dynamic low-pass filter curve in `SpatialAudioPipeline` that smoothly rolls off high frequencies from 20 kHz (at distance $\le 2$ blocks) down to 3.5 kHz (at maximum voice distance $\ge 30$ blocks), providing realistic depth and acoustic localization cues.
- **Submerged Underwater Acoustic Priority**: Retain and prioritize the 600 Hz muffled acoustic low-pass filter when either the speaker or listener is submerged in water.
- **Master Bus Peak Limiter & Anti-Clipping Compressor**: Insert a transparent, fast-attack `DynamicsCompressorNode` (`threshold: -1.5 dB`, `ratio: 20:1`, `attack: 2ms`, `release: 50ms`) into the master output bus before destination, preventing digital clipping and distortion when multiple voices and media streams overlap.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `web-client-spatial-audio`: Update `Binaural 3D Spatial Audio Rendering` requirement to mandate dynamic atmospheric distance absorption filtering and master bus peak limiting.

## Impact

- `web-client/src/audio/SpatialAudioPipeline.ts`: Graph topology updated to include `masterLimiter` before `deafenGain` and distance calculation in `updatePeerPosition` to modulate filter cutoff.
