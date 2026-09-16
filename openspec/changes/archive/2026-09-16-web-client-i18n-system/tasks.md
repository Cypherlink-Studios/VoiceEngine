## 1. i18n Foundation & Locale Dictionaries

- [x] 1.1 Create `web-client/src/i18n/types.ts` defining `Locale`, `TranslationDictionary`, `TranslationKey` dot-paths, and interpolation interfaces; verify types compile cleanly with `tsc -b`.
- [x] 1.2 Create canonical English dictionary `web-client/src/i18n/locales/en.ts` covering `auth`, `dock`, `settings`, `channels`, `popovers`, `moderation`, and `common`; verify structure export.
- [x] 1.3 Create matching Spanish dictionary `web-client/src/i18n/locales/es.ts` typed strictly against `Translations`; verify 100% key parity with `tsc -b`.
- [x] 1.4 Implement `I18nProvider` and `useTranslation()` in `web-client/src/i18n/I18nContext.tsx` with URL param parsing, localStorage persistence, browser locale fallback, and dynamic string interpolation; verify unit behavior.
- [x] 1.5 Create `web-client/src/i18n/index.ts` re-exporting the provider, hook, and locale types; integrate `<I18nProvider>` in `web-client/src/App.tsx` and verify clean build with `npm run build`.

## 2. Language Selector Components

- [x] 2.1 Implement `LanguageSelector` component in `web-client/src/i18n/LanguageSelector.tsx` supporting `compact` (header pill) and `full` (preferences card radio) variants; verify styling with Tailwind.
- [x] 2.2 Integrate compact `LanguageSelector` in `PlayerRoute.tsx` header (visible on pre-connection join screen and connected HUD); verify interactive toggling.
- [x] 2.3 Integrate full `LanguageSelector` in `SettingsModal.tsx` under the Preferences tab; verify real-time state synchronization between both selectors.

## 3. Component Localization

- [x] 3.1 Localize `PlayerRoute.tsx` (join card, connect button states, loading messages, moderation alert banner); verify rendering in English and Spanish.
- [x] 3.2 Localize `ControlDock.tsx` (all action tooltips, aria labels, and moderation mute messages); verify reactive tooltip updates.
- [x] 3.3 Localize `SettingsModal.tsx` across Devices, Players, and Preferences tabs (sliders, labels, hints, test audio); verify that no hardcoded strings remain.
- [x] 3.4 Localize `ChannelDrawer.tsx`, `PlayerVolumePopover.tsx`, and `QrCompanionModal.tsx`; verify all channel and peer volume labels render localized text.

## 4. End-to-End Verification & Build Validation

- [x] 4.1 Verify URL query parameter detection by simulating navigation with `?lang=es` and `?lang=en`, ensuring correct initial locale.
- [x] 4.2 Verify localStorage persistence across page reloads and browser fallback when no stored preference exists.
- [x] 4.3 Run `npm run build` in `web-client` to guarantee zero TypeScript or Vite bundling errors.
