# Proposal: Web Client Glassmorphism Redesign

## Why

The current web client interface features high visual density and clutter—with technical sliders (VAD threshold, master volume), AI badges, audio canvases, and auxiliary shortcuts permanently exposed in the floating control dock, alongside a rigid military-style radar. Players who primarily use the client in the background or inside a compact Document Picture-in-Picture (PiP) window need an unobtrusive, modern, and distraction-free HUD that provides instant situational awareness (speaking state, proximity, mute status) with zero cognitive overhead while gaming.

## What Changes

- **Dynamic Glass Capsule ControlDock**: Replace the overcrowded control dock with a unified frosted-glass capsule (`Option A`) inspired by Apple/macOS Control Center and Dynamic Island:
  - Smart Mic button with soft emerald speaking ring, neutral glass idle, and desaturated ruby mute state.
  - Deafen toggle with subtle amber indicator.
  - Discrete 4-bar Siri/Apple-style reactive voice equalizer replacing the heavy full-width canvas waveform.
  - Quick Sound Popover: A floating glass card triggered by the volume icon housing master volume, VAD sensitivity calibration, and AI noise suppression toggles.
  - Quick Actions Menu (`...`): Consolidates secondary utilities (Picture-in-Picture toggle, Mobile QR companion, Full Settings, Disconnect) out of the main dock strip.
- **Minimalist Spatial Soundstage**: Modernize `Radar.tsx` into an immersive soundstage with ultra-subtle concentric glass distance rings (10m, 20m, 30m), smooth expanding voice ripples when peers speak, and lightweight click popovers for per-user volume adjustments.
- **Segmented Pill Channel Selector**: Unify the awkward two-column split between the radar and `ChannelDrawer` into a top floating segmented control (`[Proximidad (n)] | [Canal General]`), cleanly transitioning between the 3D soundstage and room member rosters without breaking the layout.
- **Unified PiP Mini HUD**: Harmonize the Document Picture-in-Picture overlay (`PipOverlay.tsx`) with the same glassmorphism design tokens and compact capsule controls.

## Capabilities

### New Capabilities
*(None)*

### Modified Capabilities
- `web-client-spatial-audio`: Refine requirements for the control dock interface, audio visualization, channel switching layout, and radar soundstage presentation to reflect the minimalist glassmorphic design and popover interactions.

## Impact

- **Frontend Components**:
  - `web-client/src/components/player/ControlDock.tsx`: Complete redesign to dynamic glass capsule with quick sound and actions popovers.
  - `web-client/src/components/player/AudioWaveform.tsx`: Adapt to compact discrete equalizer bars.
  - `web-client/src/components/Radar.tsx`: Modernize into a minimalist spatial soundstage.
  - `web-client/src/components/player/ChannelDrawer.tsx` & `PlayerRoute.tsx`: Integrate segmented pill tabs and unified single-column layout.
  - `web-client/src/components/player/PipOverlay.tsx`: Adapt to the glass capsule design language.
- **Styles & Dependencies**: Utilizes existing Tailwind CSS v4 setup and Lucide icons without introducing heavy external UI dependencies.
- **Compatibility**: Preserves all existing WebRTC signaling, audio DSP pipelines, VAD calibrations, i18n translations, and keyboard shortcuts (`M`, `D`).
