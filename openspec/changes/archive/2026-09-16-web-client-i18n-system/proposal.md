## Why

The VoiceEngine web client currently has a fragmented language experience: several components (such as SettingsModal tabs and ControlDock tooltips) contain hardcoded Spanish strings, while the onboarding/connection screen, AdminRoute, and status indicators contain hardcoded English strings. As VoiceEngine supports diverse Minecraft server communities, players need a consistent, localized interface that automatically detects their language preference (via Minecraft client locale URL parameter, browser locale, or manual setting) while maintaining zero external dependencies and 100% type-safe translation keys.

## What Changes

- Introduce a lightweight, zero-dependency native TypeScript internationalization architecture (`I18nProvider`, `useTranslation`) in the web client.
- Provide comprehensive, matching translation dictionaries for Spanish (`es`) and English (`en`) covering all client surfaces:
  - Connect & onboarding card (`auth`).
  - Control dock controls, buttons, and tooltips (`dock`).
  - Audio settings modal (`settings`: Devices, DSP/Noise suppression, Players volume list, Preferences).
  - Channel drawer & radar peer popovers (`channels`, `popovers`).
  - Server moderation banners and toasts (`moderation`).
  - Network latency & diagnostics badges.
- Implement an automatic language detection pipeline:
  1. URL query parameter (`?lang=es` or `?lang=en`) passed by Minecraft server commands (`/voice`).
  2. Persisted preference in `localStorage` (`voiceengine:language`).
  3. Browser language (`navigator.language`).
  4. Fallback default (`en`).
- Add language switcher UI components:
  - A discreet header quick-switch button (`LanguageSelector` compact variant) available before connecting and during live sessions.
  - A full-featured language picker inside the *Preferences* tab of `SettingsModal`.
- Guarantee compile-time key validation and runtime English fallback for any missing translation keys.

## Capabilities

### New Capabilities
<!-- No new standalone capabilities; this extends web client features. -->

### Modified Capabilities
- `web-client-spatial-audio`: Adds requirement for client localization, multilingual interface support (Spanish and English), automatic locale detection from URL/storage/browser, runtime fallback, and user language selection controls.

## Impact

- Affected Code:
  - `web-client/src/i18n/*` (new modules: `types.ts`, `locales/en.ts`, `locales/es.ts`, `I18nContext.tsx`, `LanguageSelector.tsx`, `index.ts`).
  - `web-client/src/App.tsx` (wrapped with `<I18nProvider>`).
  - `web-client/src/routes/PlayerRoute.tsx` (connect screen, header quick selector, moderation banners).
  - `web-client/src/components/player/ControlDock.tsx` (tooltips and aria labels).
  - `web-client/src/components/player/SettingsModal.tsx` (tab titles, audio controls, player list, preferences language picker).
  - `web-client/src/components/player/ChannelDrawer.tsx` (channel titles, member counts).
  - `web-client/src/components/player/PlayerVolumePopover.tsx` (volume controls, mute toggles).
- Dependencies: Zero new npm packages added (100% native React 19 + TypeScript).
