## Why

Currently, attempting to log in to the VoiceEngine administrative management portal (`/admin`) fails when entering a code manually or clicking the in-game link during development. The Vite development server only proxies WebSocket connections (`/ws`) to the backend and lacks a proxy for `/api`, causing REST authentication requests to return `index.html` and trigger JSON parse errors. Furthermore, React 18 StrictMode double-invokes component mounting in development, immediately burning single-use administrative tokens and returning 401 Unauthorized errors on subsequent renders. Additionally, `TokenStore` lacks a permanent development admin token for local testing without Minecraft, and the Paper plugin does not notify admins if the voice backend is offline when `/voice admin` is executed.

## What Changes

- **Vite API Proxy**: Configure `web-client/vite.config.ts` to proxy `/api` requests to `http://localhost:3000` alongside existing `/ws` proxying.
- **Admin Auth Resiliency & URL Cleanup**: In `AdminRoute.tsx`, guard against duplicate token exchange requests caused by React StrictMode double-mounting, and clear the `?token` search parameter from the URL upon successful authentication to prevent re-redemption on page refreshes.
- **Permanent Dev Admin Token**: Register `ADMIN1` as a built-in development admin token (`isAdmin: true`) in `TokenStore.ts`, and ensure built-in development tokens can be reused without being permanently invalidated by `validateAndRedeemAdmin`.
- **Backend Offline Feedback in Paper Plugin**: Update `VoiceCommand.java` to check if `voiceBackendClient` is connected and open before issuing tokens, displaying a clear in-game warning if the voice backend is unreachable.

## Capabilities

### Modified Capabilities
- `admin-portal-and-customization`: Adds requirements for local development API proxying, idempotent/resilient single-use admin token redemption in React, and built-in development administrator token support.
- `paper-voice-bridge`: Adds requirement to verify voice backend connectivity when executing `/voice admin` and notify administrators if the backend is unreachable.

## Impact

- **Web Client**:
  - `web-client/vite.config.ts`: Added `/api` proxy definition targeting `http://localhost:3000`.
  - `web-client/src/routes/AdminRoute.tsx`: Added concurrency guard for token exchange and URL sanitization.
- **Voice Server**:
  - `voice-server/src/auth/TokenStore.ts`: Added `ADMIN1` dev token and reusable dev token bypass in `validateAndRedeemAdmin`.
- **Paper Plugin**:
  - `paper-plugin/src/main/java/com/voiceengine/command/VoiceCommand.java`: Added backend connectivity verification on admin token dispatch.
