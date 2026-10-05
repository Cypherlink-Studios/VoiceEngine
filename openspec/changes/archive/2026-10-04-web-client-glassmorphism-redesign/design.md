# Technical Design: Web Client Glassmorphism Redesign

## Context

The `web-client` frontend is built with React 19, TypeScript, Vite, and Tailwind CSS v4, utilizing Lucide icons for UI symbolism. Currently, the player route (`PlayerRoute.tsx`) renders a dense visual layout: an unconstrained canvas-based waveform, exposed sliders for master volume and VAD calibration, a military-style radar display (`Radar.tsx`), and a separate rectangular channel drawer (`ChannelDrawer.tsx`).

See `proposal.md` for user problem and motivation, and `specs/web-client-spatial-audio/spec.md` for normative requirements.

## Goals / Non-Goals

**Goals:**
- Implement an Apple/macOS-inspired glassmorphism visual language (`backdrop-blur-2xl`, translucent slate surfaces `bg-slate-950/70`, refined 1px border highlights, soft ambient drop shadows).
- Condense `ControlDock.tsx` into a dynamic floating capsule (Option A) with smart mic state, deafen button, Siri-style 4-bar equalizer, quick audio popover, and utility actions menu.
- Modernize `Radar.tsx` into an elegant spatial soundstage with subtle concentric distance rings, clean circular avatar tokens, and animated breathing speech ripples.
- Unify channel switching with floating segmented pill tabs (`[Proximidad] | [Canal General]`) directly above the soundstage.
- Align `PipOverlay.tsx` with identical design tokens to deliver a distraction-free in-game HUD.

**Non-Goals:**
- Modifying WebRTC signaling protocols (`VoiceSignaling.ts`) or Mediasoup transport architecture.
- Altering the audio DSP pipeline (`MicrophonePipeline.ts`, `SpatialAudioPipeline.ts`, RNNoise worklets).
- Introducing third-party UI component libraries (e.g., Radix, shadcn, Mantine); all interactions remain pure React with Tailwind CSS v4.

## Decisions

### Decision 1: Dynamic Glass Capsule vs. Persistent Multi-Control Dock
- **Chosen Option**: A floating capsule pill (`rounded-full`, `backdrop-blur-2xl`) housing only primary game actions (Mic, Deafen, Equalizer, Quick Sound, More).
- **Rationale**: Players rarely adjust VAD thresholds or master volumes mid-gameplay. Moving secondary settings into popovers clears 60% of horizontal dock footprint and prevents visual crowding on laptops and narrow viewports.
- **Alternatives Considered**:
  - *Option B (Segmented Bar)*: Keeping master volume slider visible. Rejected because it still clutters the interface and breaks symmetry in compact PiP views.

### Decision 2: 4-Bar Equalizer vs. Full-Width Canvas Waveform
- **Chosen Option**: A compact 4-bar reactive equalizer (`AudioWaveform.tsx`) that animates smoothly based on the `AnalyserNode` frequency/time-domain data when speaking, resting at a 4px baseline in silence.
- **Rationale**: Full-width HTML canvas was visually noisy and consumed unnecessary GPU draw cycles in the background. The 4-bar equalizer provides immediate feedback that the mic is picking up sound without dominating the screen.

### Decision 3: Segmented Pill Channel Selector vs. Two-Column Drawer
- **Chosen Option**: Floating segmented tabs atop the main soundstage container. Selecting a fixed room smoothly transitions the central container into a clean member list; selecting proximity returns to the 3D soundstage.
- **Rationale**: Eliminates the awkward side-by-side imbalance where the round radar competed with a square channel drawer.

### Decision 4: Self-Contained Popovers with Outside Click Handling
- **Chosen Option**: React `useRef` + document click listeners to manage visibility for the Quick Audio Popover, Actions Menu, and Peer Volume Card.
- **Rationale**: Lightweight, zero external dependencies, robust keyboard `Escape` dismissal, and straightforward integration into both main view and PiP portal.

## Risks / Trade-offs

- **[Backdrop blur rendering cost]** → Use moderate blur levels (`backdrop-blur-xl` / `backdrop-blur-md`) with high-opacity fallback backgrounds (`rgba(15, 23, 42, 0.85)`) to maintain 60fps even on low-spec integrated graphics.
- **[Popover overflow in compact PiP windows]** → In PiP mode, popovers render anchored to the capsule with compact dimensions (`max-w-[280px]`) and auto-close upon selecting an action.
- **[Touch device hit targets]** → Maintain minimum 44x44px touch targets on all interactive capsule buttons.
