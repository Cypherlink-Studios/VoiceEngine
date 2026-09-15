# Technical Design: High-Concurrency Performance, Scale and Multi-Worker Architecture

## Context

VoiceEngine coordinates low-latency spatial audio across Paper/Velocity Minecraft servers, a Node.js signaling/SFU gateway, and browser-based WebRTC clients. As described in `proposal.md`, the backend currently operates with a single Mediasoup C++ worker on one CPU core (constrained by a 100-port RTC window), evaluates spatial proximity using an unindexed $O(N^2)$ Euclidean loop every 100ms, and dispatches individual JSON frames per peer-listener pair.

This design document outlines the technical architecture to scale the backend to hundreds of concurrent players across multiple CPU cores, minimizing CPU event-loop blocking and network overhead.

## Goals / Non-Goals

**Goals:**
- Scale voice-server WebRTC capacity to saturate all available CPU cores via Mediasoup worker pooling.
- Lower proximity evaluation algorithmic complexity from $O(N^2)$ to $O(N \cdot k)$ where $k \le 27$ grid cells.
- Reduce WebSocket frame dispatch overhead by >80% through binary batching and deadband culling.
- Provide production-grade telemetry via Prometheus `/metrics` and operational health alerting via Discord Webhooks.
- Provide a synthetic benchmarking suite capable of headless stress-testing 100–500 clients.

**Non-Goals:**
- Distributed multi-region WebRTC audio routing over WAN (Fase 4 Redis state synchronization will support node affinity, but cross-WAN RTP forwarding between separate voice-server instances is out of scope).
- Altering the Minecraft plugin telemetry contract (Paper and Velocity will continue sending existing JSON batches).

## Decisions

### 1. Spatial Partitioning: 3D Grid Hash vs. Octree / KD-Tree
- **Decision**: Implement a 3D Spatial Grid Hash with cell size $S = 32$ blocks, partitioned primarily by `${serverId}:${world}`.
- **Rationale**: Minecraft players move dynamically and frequently (teleporting, flying, walking). Rebalancing a hierarchical tree (Octree/KD-Tree) on every tick incurs substantial tree re-indexing overhead and GC allocation. A spatial hash with $O(1)$ coordinate keying (`Math.floor(x / 32)`) offers instant insert/remove and direct neighbor querying across $3 \times 3 \times 3 = 27$ adjacent cells with zero pointer dereferencing overhead.
- **Pre-filtering**: Evaluate distance as $dx^2 + dy^2 + dz^2 \le r^2$, eliminating `Math.sqrt()` and trigonometric heading calculations for non-audible players.
- **Alternatives Considered**:
  - *Linear loop (current)*: Degrades quadratically ($O(N^2)$).
  - *Dynamic Octree*: Excessive rebalancing cost in JS garbage-collected memory at 10 Hz.

### 2. Binary Transport Framing: Compact ArrayBuffer vs. Protobuf / Flat JSON
- **Decision**: Use a custom compact binary layout over WebSocket for high-frequency spatial batches, while retaining JSON for control signaling (auth, channel switching, moderation).
- **Binary Format Specification**:
  - `Header` (3 bytes): `[uint8 packetType = 0x01][uint16 peerCount]`
  - `Per-Peer Payload` (24 bytes):
    - `peerUuid` (16 bytes): UUID binary representation (2x `BigInt64` or 16 `Uint8`).
    - `relX` (int16, 2 bytes): Scaled by 100 (range $\pm 327.67$m, precision 1cm).
    - `relY` (int16, 2 bytes): Scaled by 100.
    - `relZ` (int16, 2 bytes): Scaled by 100.
    - `distance` (uint16, 2 bytes): Scaled by 100.
    - `flags` (uint8, 1 byte): Bitmask (`0x01`: isSubmerged, `0x02`: isPaused, `0x04`: isBroadcast).
- **Rationale**: An audible peer payload in JSON is ~180–220 bytes. In compact binary, it is 24 bytes (an 88% reduction in bandwidth and zero V8 string allocations).
- **Alternatives Considered**:
  - *Google Protobuf*: Adds library bundle overhead and serialization runtime cost without significant byte reduction over raw TypedArrays.
  - *Batched JSON*: Better than individual frames, but still creates significant string serialization and GC pressure at 10,000+ peer updates/sec.

### 3. SFU Worker Pool Architecture: Least-Loaded with PipeTransports
- **Decision**: Initialize an array of `mediasoup.Worker` instances configured by `MEDIASOUP_NUM_WORKERS || os.cpus().length`. Assign each worker a non-overlapping segment of the `40000-49999` port range. Allocate new clients to the worker with the lowest active transport count. Connect producers across workers on-demand via `router.pipeToRouter()`.
- **Worker Pipe Caching**: Maintain a cache of active inter-router pipes (`Map<`${producerId}:${fromRouterId}->${toRouterId}`, PipeTransportPair>`). When a consumer in Router B needs a producer in Router A, check the cache; create the pipe only on the first request and reuse it for subsequent consumers in Router B.
- **Alternatives Considered**:
  - *Siloed Routers per World*: World affinity works well when players are dispersed, but fails during high-density spawn events (e.g. 150 players in one world overwhelm a single core). Least-Loaded with pipes dynamically balances load across all cores regardless of in-game player clustering.

### 4. Decoupling Spatial Geometry from Mediasoup Action Queue
- **Decision**: The 10 Hz proximity tick computes geometry synchronously. Consumer creations (`sfu.createConsumer`), pauses (`consumer.pause()`), and resumes (`consumer.resume()`) are pushed to an asynchronous debounced reconciliation queue.
- **Rationale**: Executing `await` IPC calls inside the spatial loop blocks subsequent calculations if Mediasoup IPC has momentary micro-stutters. Decoupling allows geometry frames to dispatch reliably at 10 Hz without jitter.

### 5. Observability Stack: Prometheus & Discord Alerts
- **Decision**: Use `prom-client` to expose `GET /metrics` and implement a rate-limited `DiscordNotifier` module.
- **Alert Conditions**:
  - `Event Loop Delay`: Trigger warning if `monitorEventLoopDelay().mean` exceeds 30ms for > 3 consecutive seconds (cooldown: 5 minutes).
  - `Worker CPU`: Trigger warning if any worker's CPU usage exceeds 85%.
- **Alternatives Considered**:
  - *Custom Dashboard only*: Does not integrate into existing server infrastructure tools (Grafana, Datadog). Exposing `/metrics` provides universal observability.

## Risks / Trade-offs

- **[Risk] Increased Loopback Network Traffic with PipeTransports**: Multiple inter-worker pipes create local UDP loopback packets between Mediasoup worker processes.
  → *Mitigation*: Workers share local memory loopback sockets; Opus audio packets are tiny (~40 kbps). Caching pipe transports per producer ensures that $M$ consumers on Worker B share a single pipe from Worker A.
- **[Risk] Binary Endianness & Browser Compatibility**: Differences in byte ordering could corrupt parsed coordinates.
  → *Mitigation*: Both server (`Buffer.writeInt16LE`) and browser (`DataView.getInt16(..., true)`) will explicitly enforce Little-Endian encoding.
- **[Risk] Deadband Client Drift**: If a client misses a packet or has numerical precision drift, deadband suppression could leave audio panner slightly offset.
  → *Mitigation*: Enforce a heartbeat refresh: if a peer has not had an update dispatched for 2 seconds (20 ticks) but remains audible, dispatch an authoritative spatial frame.

## Migration Plan

1. **Phase 1: Grid Partitioning, Deadband & Binary Signaling**:
   - Refactor `SpatialEngine.ts` to implement 3D spatial grid hashing with squared-distance pre-filter.
   - Update `ClientGateway.ts` to encode binary batch frames and `VoiceSignaling.ts` in `web-client` to decode them.
   - Verify compatibility with existing audio tests.
2. **Phase 2: Multi-Worker SFU Pool**:
   - Refactor `MediasoupManager.ts` to manage worker pools, port ranges, and router piping.
   - Update `ClientGateway.ts` to support multi-router session allocation.
3. **Phase 3: Observability & Benchmarking**:
   - Add `prom-client` and `/metrics` endpoint in `api.ts`.
   - Add `DiscordNotifier.ts` and wire health threshold monitors.
   - Implement `scripts/bench_stress_test.ts`.
4. **Rollback Strategy**:
   - All optimizations preserve existing public APIs and plugin protocols. If multi-worker issues arise on specific OS platforms, setting `MEDIASOUP_NUM_WORKERS=1` reverts behavior to a single worker router without code changes.

## Open Questions

- *None*: Core architectural decisions, thresholds, and protocols are fully defined.
