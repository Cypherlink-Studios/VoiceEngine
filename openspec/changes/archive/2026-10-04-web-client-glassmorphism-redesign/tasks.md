# Tasks

## 1. Dynamic Glass Capsule & Audio Visualizer

- [x] 1.1 Refactor `AudioWaveform.tsx` into a 4-bar Siri-style reactive voice equalizer using `AnalyserNode` frequency data and verify it animates during active speech.
- [x] 1.2 Refactor `ControlDock.tsx` into the floating glass capsule layout with smart microphone state indicator (speaking ring, mute ruby state), deafen toggle, and equalizers.
- [x] 1.3 Implement the Quick Sound Popover in `ControlDock.tsx` housing master volume, VAD threshold sensitivity slider, and AI noise suppression toggle, and verify dismiss on outside click or Escape.
- [x] 1.4 Implement the Quick Actions Menu (`...`) in `ControlDock.tsx` consolidating Picture-in-Picture trigger, mobile QR companion modal, full settings modal trigger, and disconnect button.

## 2. Minimalist Spatial Soundstage & Channel Switching

- [x] 2.1 Modernize `Radar.tsx` into a minimalist frosted-glass spatial soundstage with subtle concentric distance rings, orientation cues, and expanding voice pulse rings around speaking peers.
- [x] 2.2 Refactor channel navigation in `PlayerRoute.tsx` into floating segmented pill tabs (`[Proximidad] | [Canal General]`), cleanly transitioning between the 3D soundstage and fixed channel member lists without a split-screen side drawer.
- [x] 2.3 Update peer volume adjustment popover (`PlayerVolumePopover.tsx`) to render as an anchored frosted-glass card upon clicking a peer on the soundstage.

## 3. PiP Overlay & Visual Cohesion

- [x] 3.1 Refactor `PipOverlay.tsx` to inherit the new glass capsule and minimalist soundstage design for a cohesive in-game floating HUD.
- [x] 3.2 Polish background glows and welcome card in `PlayerRoute.tsx` with unified glassmorphism tokens and clean typography.
- [x] 3.3 Run `npm run build` inside `web-client` and verify TypeScript compilation and Tailwind CSS v4 build succeed without errors or warnings.
