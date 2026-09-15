# Proposal: High-Concurrency Performance, Scale and Multi-Worker Architecture

## Why

VoiceEngine's current implementation handles real-time proximity voice chat, synchronized media, and moderation with high fidelity, but relies on a single-core Mediasoup worker (capped at 100 RTC ports / ~50 concurrent users), an unindexed $O(N^2)$ distance evaluation loop in Node.js's main event loop, and high-frequency individual JSON WebSocket updates. 

As player populations scale to hundreds of concurrent users, this causes event loop lag, port exhaustion, and WebSocket frame flood. This change introduces multi-worker SFU load balancing, 3D spatial grid hashing, compact binary telemetry framing, deadband delta suppression, Prometheus metrics, and automated Discord operational alerts.

## What Changes

- **3D Spatial Grid Hashing**: Replace the $O(N^2)$ linear Euclidean loop with a 3D grid hash partitioned by `serverId:world`, reducing neighbor lookup to $O(1)$ constant time with squared-distance pre-filtering ($d^2 \le r^2$).
- **Compact Binary Telemetry & Spatial Batching**: Consolidate individual per-peer JSON updates into a single batched payload per tick, using compact binary framing (`ArrayBuffer` / `DataView`) for spatial coordinates while retaining JSON for signaling.
- **Configurable Deadband Filtering**: Suppress redundant spatial updates when player relative displacement and yaw fall below configurable thresholds ($\Delta < 0.08$ blocks), dropping network traffic to near zero for stationary players.
- **Decoupled Spatial & Mediasoup Loops**: Separate synchronous CPU geometry calculations from asynchronous Mediasoup IPC and consumer lifecycle management.
- **Mediasoup SFU Worker Pool**: Expand from 1 worker to a multi-worker pool configurable via `MEDIASOUP_NUM_WORKERS`, allocating distinct sub-ranges of an expanded RTC port pool (`40000-49999`) and load-balancing transports via a Least-Loaded strategy with inter-worker `PipeTransports`.
- **Prometheus Observability (`/metrics`)**: Integrate `prom-client` to expose an industry-standard `/metrics` endpoint tracking Event Loop Lag, worker CPU/memory usage, WebRTC RTP loss/RTT, and spatial tick durations.
- **Automated Discord Health Alerts**: Implement a configurable Discord Webhook dispatcher alerting operators when Event Loop Delay exceeds 30ms or worker CPU exceeds 85%.
- **Benchmarking & Stress Test Runner**: Provide a headless synthetic bot runner (`scripts/bench_stress_test.ts`) to validate 100–500 concurrent bot connections across clustered and open-world movement patterns.

## Capabilities

### Modified Capabilities
- `voice-backend-sfu`: Update requirements for multi-worker SFU management, 3D grid spatial partitioning, deadband delta suppression, binary WebSocket spatial framing, Prometheus `/metrics` exposition, and Discord operational alerts.
- `web-client-spatial-audio`: Update requirements to decode compact binary `ArrayBuffer` spatial batch frames into the `SpatialAudioPipeline` while maintaining backward compatibility with JSON signaling frames.

## Impact

- **Backend**: `voice-server` architecture refactored for multi-worker pooling (`MediasoupManager`), grid indexing (`SpatialEngine`), and binary framing (`ClientGateway`). Addition of `prom-client` dependency.
- **Web Client**: `web-client` signaling layer (`VoiceSignaling`) updated to parse binary WebSocket packets.
- **Infrastructure**: Expanded firewall/port forwarding range recommended (`UDP 40000-49999`).
- **Compatibility**: Non-breaking for Minecraft plugins (`paper-plugin` and `velocity-plugin` continue sending existing JSON telemetry batches).
