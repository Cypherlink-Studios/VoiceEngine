## Context

See `proposal.md` for motivation. The web client is a React 19 application running on Vite (dev port 5173), while the backend is an Express and WebSocket server running on port 3000. In production, `voice-server` hosts the built frontend assets directly from port 3000, but in local development Vite runs separately.

## Goals / Non-Goals

**Goals:**
- Enable reliable administrative code and link authentication when running the Vite development server.
- Prevent React 18 StrictMode double-mounting in dev from burning single-use tokens and displaying premature 401 errors.
- Ensure the URL query string is cleansed of single-use tokens once exchanged so page reloads rely on active session storage.
- Provide a permanent development admin token (`ADMIN1`) in `TokenStore.ts` for quick local testing and integration harnesses without burning out after a single use.
- Give clear, immediate feedback to Minecraft server administrators if `/voice admin` is executed while the backend voice server is disconnected.

**Non-Goals:**
- Changing the production single-use token security model for real in-game players.
- Altering the session token hashing or UUID generation mechanism.
- Rewriting the admin portal state architecture or changing the tab layout.

## Decisions

### 1. Proxy `/api` in `vite.config.ts`
- **Decision**: Configure Vite's dev server proxy to route `/api` to `http://localhost:3000`, mirroring the existing `/ws` proxy rule.
- **Rationale**: Vite's fallback for unmatched routes in an SPA is `index.html`. Without this proxy rule, any HTTP fetch to `/api` receives HTML status 200, which causes JSON parsing to fail.
- **Alternatives Considered**: Using absolute URLs (`http://localhost:3000/api/...`) with CORS headers. Rejected because it introduces cross-origin complexity and diverges from production deployment topology where all traffic flows through the same origin or reverse proxy.

### 2. Guard Token Exchange & Sanitize URL in `AdminRoute.tsx`
- **Decision**: Introduce a `useRef` tracking the active token being exchanged to ignore duplicate concurrent executions from React 18 StrictMode. Once successfully authenticated, invoke `navigate('/admin', { replace: true })` to remove `?token=` from the browser address bar.
- **Rationale**: StrictMode intentionally mounts components twice in development. Because `validateAndRedeemAdmin` marks the token as redeemed on the first call, the concurrent second call receives 401. Sanitizing the address bar ensures that subsequent page refreshes rehydrate from `sessionStorage` rather than re-submitting the redeemed token.
- **Alternatives Considered**: Storing the redeemed token state globally in memory. Rejected as URL sanitization is cleaner and prevents stale credentials in user history.

### 3. Built-in Dev Admin Token & Reusability in `TokenStore.ts`
- **Decision**: Add `ADMIN1` to `registerDevTokens()` with `isAdmin: true`. In `validateAndRedeemAdmin(token)`, check if the token is a designated development token; if so, permit redemption even if `record.redeemed` was previously set to `true`.
- **Rationale**: Developers and automated tests need to log into the admin dashboard repeatedly without restarting the Node.js process or regenerating tokens in Minecraft.
- **Alternatives Considered**: Generating a new mock token on every test. Rejected because having a known static token (`ADMIN1`) drastically speeds up manual UI validation.

### 4. Connection Pre-Check in `VoiceCommand.java`
- **Decision**: Verify `voiceBackendClient != null && voiceBackendClient.isOpen()` before generating an admin token. If the socket is not ready, display a red message to the administrator indicating the voice server is unreachable.
- **Rationale**: Displaying a token to an admin that was never transmitted to the voice backend causes confusion and unhelpful "invalid token" errors on the web portal.
- **Alternatives Considered**: Queuing the token locally in the plugin until reconnection. Rejected because admin tokens have a 5-minute TTL and immediate failure feedback is clearer.

## Risks / Trade-offs

- **[Risk] Dev tokens available in production** → *Mitigation*: Dev tokens are only registered on server initialization and have well-known prefixes; production deployments can disable them via configuration if desired.
- **[Risk] Removing `?token` disables link sharing** → *Mitigation*: Admin tokens are single-use by design. Sharing a used token URL is invalid regardless, so cleansing the URL avoids confusion.
