## 1. Web Client Dev Proxy & Auth Resiliency

- [x] 1.1 Configure `/api` proxy in `web-client/vite.config.ts` targeting `http://localhost:3000` and verify the development server configuration.
- [x] 1.2 Update `AdminRoute.tsx` with a ref-based concurrency guard against React StrictMode duplicate requests and strip `?token` from the URL with `navigate('/admin', { replace: true })` upon successful auth.
- [x] 1.3 Add active loading feedback during manual code authentication in `AdminRoute.tsx` to prevent multiple rapid form submissions.

## 2. Voice Server Dev Token Enhancements

- [x] 2.1 Register `ADMIN1` in `TokenStore.registerDevTokens()` with `isAdmin: true` and configure `validateAndRedeemAdmin` to permit repeated redemption for development tokens.
- [x] 2.2 Add unit test coverage in `voice-server/test/ApiRoutes.test.ts` verifying that `ADMIN1` can authenticate repeatedly and that invalid/non-admin tokens are rejected.

## 3. Paper Plugin Backend Connectivity Verification

- [x] 3.1 Update `VoiceCommand.java` and `VoiceEnginePlugin.java` to verify `voiceBackendClient.isOpen()` before dispatching admin tokens and notify the player with an in-game warning if the voice backend is offline.
- [x] 3.2 Update `VoiceCommandTest.java` in `paper-plugin` to test offline backend handling when running `/voice admin`.

## 4. End-to-End Verification

- [x] 4.1 Run Vitest tests in `voice-server` and Gradle tests in `paper-plugin` and verify all tests pass.
- [x] 4.2 Run `npm run build` in `web-client` and verify the build bundle compiles without TypeScript or Vite errors.
