# Implementation Tasks: High-Concurrency Performance, Scale and Multi-Worker Architecture

## 1. 3D Spatial Grid Hashing & Geometry Optimization

- [x] 1.1 Implement `SpatialGridIndex` class with $O(1)$ cell hashing (cell size 32 blocks) and adjacent 27-cell neighbor lookup, verifying with unit tests for insertion, updates, and removals.
- [x] 1.2 Refactor `SpatialEngine.ts` to isolate spatial partitions by `${serverId}:${world}` and query neighbors using squared Euclidean distance pre-filtering ($dx^2 + dy^2 + dz^2 \le r^2$), verifying with unit tests comparing accuracy against the baseline linear calculation.
- [x] 1.3 Add performance micro-benchmarks comparing `SpatialEngine` lookup times with 500 simulated players, verifying a $>5\times$ speedup over the legacy linear loop.

## 2. Compact Binary Protocol & Deadband Suppression

- [x] 2.1 Define binary packet schema utilities in `voice-server/src/spatial/BinarySpatialCodec.ts` (Little-Endian encoding of header, UUIDs, 16-bit scaled coordinates, distance, and packed bitmask flags), verifying serialization and deserialization roundtrip tests.
- [x] 2.2 Add configurable deadband delta suppression (`spatialDeadbandDistance`, `spatialDeadbandYaw`) in `SpatialEngine.ts` and `SettingsManager.ts`, verifying that stationary players suppress redundant tick updates while emitting periodic 2-second heartbeats.
- [x] 2.3 Refactor `ClientGateway.ts` proximity dispatch loop to transmit binary `ArrayBuffer` batches over WebSocket and decouple geometric calculations from Mediasoup consumer reconciliation.

## 3. Web Client Binary Telemetry Ingestion

- [x] 3.1 Implement binary packet parser in `web-client/src/net/BinarySpatialDecoder.ts` to extract peer offsets, distance, and status flags from received `ArrayBuffer` WebSocket frames.
- [x] 3.2 Update `web-client/src/net/VoiceSignaling.ts` to handle binary messages seamlessly alongside JSON control signaling and feed updates to `SpatialAudioPipeline`.
- [x] 3.3 Verify deadband retention in `SpatialAudioPipeline.ts`, ensuring PannerNodes retain position without audio interruption when frames are suppressed by the server.

## 4. Mediasoup Multi-Worker Pool & PipeTransport Routing

- [x] 4.1 Update `voice-server/src/config.ts` to support `MEDIASOUP_NUM_WORKERS` and expand `RTC_MIN_PORT` / `RTC_MAX_PORT` range to `40000-49999`.
- [x] 4.2 Refactor `MediasoupManager.ts` to initialize an array of `Worker` instances, partition the port range across workers, and track transport loads per router.
- [x] 4.3 Implement least-loaded worker transport allocation and on-demand inter-worker `PipeTransport` caching in `MediasoupManager.ts` (`pipeToRouter`), verifying cross-worker producer consumption with automated tests.
- [x] 4.4 Update `ClientGateway.ts` session management to create `sendTransport` and `recvTransport` on the allocated worker router and properly clean up pipe transports on session disconnect.

## 5. Prometheus Observability & Discord Health Alerts

- [x] 5.1 Add `prom-client` dependency to `voice-server/package.json` and register gauges/histograms for Event Loop Delay, active workers/transports/consumers, spatial tick duration, and WebSocket message rates.
- [x] 5.2 Expose `GET /metrics` in `voice-server/src/routes/api.ts`, verifying valid Prometheus text format output via automated HTTP request tests.
- [x] 5.3 Implement `DiscordNotifier.ts` with webhook dispatch and cooldown rate-limiting for Event Loop Delay ($> 30$ms) and worker CPU ($> 85\%$).
- [x] 5.4 Update `/api/admin/metrics` to include multi-worker utilization, spatial hash cell counts, and deadband suppression ratios for the admin dashboard.

## 6. Benchmarking & Synthetic Stress Test Suite

- [x] 6.1 Create `scripts/bench_stress_test.ts` capable of spawning $N$ headless virtual clients connecting via WebSocket with valid authentication tokens.
- [x] 6.2 Implement movement scenarios in the stress tester: "Spawn Cluster" (100 bots crowded in 10 blocks) and "Open World" (300 bots wandering across a $500 \times 500$ block map).
- [x] 6.3 Add automated metrics logging in the benchmark runner to report average spatial tick latency, memory usage, and packet loss under load.

## 7. Integration Verification & Documentation

- [x] 7.1 Run full end-to-end test suite across `voice-server` and `web-client`, verifying zero regressions in proximity audio, fixed channels, and speaker blocks.
- [x] 7.2 Update `docs/architecture/ARCHITECTURE.md` and configuration documentation with multi-worker environment variables and firewall port recommendations.
