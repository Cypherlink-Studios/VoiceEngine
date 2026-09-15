# VoiceEngine Architecture, Scalability & Multi-Worker Design

This document details the high-concurrency architecture, algorithmic optimizations, and multi-worker design of **VoiceEngine**.

---

## 1. High-Level System Architecture

VoiceEngine is composed of three interconnected sub-systems:

```
┌──────────────────────────────────────┐       JSON Telemetry / Tokens
│   Minecraft Servers (Paper / Spigot) │───────────────────────────────┐
│     velocity-plugin / paper-plugin   │ (WebSocket :3000/ws/plugin)   │
└──────────────────────────────────────┘                               │
                                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VoiceEngine SFU Backend (voice-server)                   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        Plugin Gateway Router                        │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │    3D Spatial Grid Engine (O(N·k) 32-block Hashing & Deadband)      │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │   Client Gateway (Binary ArrayBuffer Telemetry & Decoupled SFU)     │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │           Mediasoup SFU Multi-Worker Pool (Ports 40000-49999)       │   │
│   │   Worker 0 (Router 0) ───[PipeTransports]─── Worker 1 (Router 1)    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                     WebRTC Audio (Opus) / Binary WebSocket
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Web Browser Client (web-client)                       │
│     React 19 + Web Audio API (PannerNode HRTF + Lowpass Underwater Filter)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 3D Spatial Grid Hashing & Geometric Optimization

In spatial proximity voice chat, computing pairwise Euclidean distances naively scales as $O(N^2)$, which degrades severely beyond 200 concurrent players.

### 2.1 Spatial Partitioning
1. **Multi-World Isolation**:
   Players are partitioned by partition key `${serverId}:${world}`. Players in different worlds (e.g., `nether` vs `overworld`) or distinct backend servers are isolated into separate spatial hash indices. Empty world partitions are pruned automatically.
2. **Integer Spatial Cell Hashing ($O(1)$)**:
   Worlds are divided into 3D cubic cells with a grid size of 32 blocks ($32 \times 32 \times 32$). The integer cell coordinates $(c_x, c_y, c_z)$ are converted to numeric hash keys with zero string heap allocations:
   $$\text{CellKey} = (c_x + 1048576) \cdot 2^{31} + (c_y + 512) \cdot 2^{21} + (c_z + 1048576)$$
3. **27-Cell Neighbor Search ($O(N \cdot k)$)**:
   For any listener at $(x, y, z)$, the query examines only the listener's cell and its 26 immediate neighboring cells. Across 800 players, this achieves a **$6.8\times$ computational speedup** (down to 1.00 ms per tick).
4. **Squared Euclidean Distance & Lazy Trigonometry**:
   Candidate peers are pre-filtered using squared Euclidean distance ($dx^2 + dy^2 + dz^2 \le r^2$), completely avoiding `Math.sqrt` for non-audible candidates. Heading yaw trigonometry (`Math.sin`, `Math.cos`) is evaluated lazily only when at least one candidate passes the squared-distance threshold.

---

## 3. Compact Binary Protocol & Deadband Suppression

High-frequency spatial coordinate streaming at 10 Hz over JSON consumes excessive bandwidth and V8 JSON serialization CPU cycles.

### 3.1 Binary ArrayBuffer Packet Format
Clients negotiating `supportsBinary: true` receive spatial updates encoded in a compact Little-Endian binary layout:

| Offset | Type | Field | Description |
|---|---|---|---|
| `0x00` | `uint8` | `packetType` | `0x01` (Spatial Telemetry Batch) |
| `0x01` | `uint16 LE` | `peerCount` | Number of peer entries in this batch |
| **Peer Entry (25 bytes each)** | | | |
| `+00` | `16 bytes` | `peerUuid` | Raw 128-bit UUID (lossless canonical conversion) |
| `+16` | `int16 LE` | `relX` | Local relative X in centimeters ($-327.68\text{m} \dots +327.67\text{m}$) |
| `+18` | `int16 LE` | `relY` | Local relative Y in centimeters ($-327.68\text{m} \dots +327.67\text{m}$) |
| `+20` | `int16 LE` | `relZ` | Local relative Z in centimeters ($-327.68\text{m} \dots +327.67\text{m}$) |
| `+22` | `uint16 LE` | `distance` | Euclidean distance in centimeters ($0 \dots 655.35\text{m}$) |
| `+24` | `uint8` | `flags` | Bitmask: `0x01` Submerged, `0x02` Paused, `0x04` Broadcast |

A frame with 10 audible peers drops from **~1,200 bytes of JSON down to 253 bytes of binary**, representing a **~79% network bandwidth reduction**.

### 3.2 Deadband Suppression & Asynchronous Reconciliation
- **Distance & Heading Deadbands**: If a player moves $< 0.08\text{m}$ and rotates $< 2.0^\circ$, coordinate updates to remote listeners are suppressed.
- **2-Second Forced Heartbeat**: Stationary players receive a forced spatial update every 2,000 ms to refresh PannerNode states and prevent drift.
- **Decoupled Event Loop**: The 10 Hz proximity tick performs purely synchronous CPU geometric calculations. Heavy Mediasoup C++ IPC calls (`createConsumer`, `pause`, `resume`) are enqueued and processed asynchronously via `triggerConsumerReconciliation()`, eliminating event-loop lag spikes.

---

## 4. Mediasoup Multi-Worker SFU Pool

By default, Node.js single-threaded event loop and a single Mediasoup C++ worker can become bottlenecked when handling hundreds of WebRTC tracks.

### 4.1 Worker Pool Allocation
- **Configuration**: Set `MEDIASOUP_NUM_WORKERS` to the desired number of CPU worker processes (e.g. `2`, `4`, or `8`).
- **RTC Port Partitioning**: The RTC port range (`RTC_MIN_PORT=40000` to `RTC_MAX_PORT=49999`, 10,000 UDP/TCP ports) is evenly partitioned across all active workers.
- **Least-Loaded Load Balancing**: When a client authenticates, `MediasoupManager.getLeastLoadedRouter()` assigns both `sendTransport` and `recvTransport` to the router with the lowest active transport count.

### 4.2 Dynamic Cross-Worker PipeTransports
When a listener on Router A consumes audio from a speaker on Router B:
1. `MediasoupManager.createConsumer()` detects `sourceRouter.id !== targetRouter.id`.
2. Automatically calls `sourceRouter.pipeToRouter({ producerId, router: targetRouter })`.
3. Caches the active pipe so subsequent listeners on Router A reuse the existing `PipeTransport` pair without re-allocating sockets.
4. When the speaker's producer closes, all associated pipe consumers and producers are destroyed automatically.

---

## 5. Observability, Metrics & Alerts

### 5.1 Prometheus Endpoint & Turnkey Grafana Stack
- **URL**: `GET /metrics` and `GET /api/metrics`
- **Format**: Standard Prometheus text format (compatible with Prometheus, Grafana, Datadog, and VictoriaMetrics).
- **Automated Deployment Script**: Run `sudo bash scripts/prometheus_integration.sh` to interactively deploy Prometheus TSDB and Grafana via Docker Compose or native Systemd.
- **Pre-built Dashboard**: `monitoring/grafana/dashboards/voiceengine-overview.json` is auto-provisioned, featuring real-time KPI stat cards, P99 event loop lag curves, worker CPU gauges, spatial calculation latencies, and WebSocket message throughput. See [PROMETHEUS_GRAFANA.md](../observability/PROMETHEUS_GRAFANA.md).
- **Core Metrics**:
  - `voiceengine_event_loop_lag_ms`: Real-time event loop lag measured at high resolution.
  - `voiceengine_sfu_workers_total`: Count of active Mediasoup worker instances.
  - `voiceengine_sfu_transports_total`: Count of active WebRTC and Pipe transports.
  - `voiceengine_connected_clients_total`: Authenticated WebSocket clients.
  - `voiceengine_spatial_grid_active_cells_total`: Populated 3D spatial cells.
  - `voiceengine_spatial_deadband_suppression_ratio`: Deadband efficiency ratio ($0.0 \dots 1.0$).
  - `voiceengine_spatial_tick_duration_seconds`: Histogram of proximity tick duration.

### 5.2 Discord Operational Health Webhook
- Configure `DISCORD_WEBHOOK_URL` in `.env`.
- Automated alerts are dispatched with 60-second rate-limiting cooldown:
  - **High Event Loop Delay**: Triggered if event loop lag exceeds `30 ms`.
  - **Worker High CPU**: Triggered if worker process CPU utilization exceeds `85%`.

---

## 6. Firewall & Production Deployment

For production deployments (Docker, Kubernetes, or Bare Metal Linux):

| Port / Protocol | Purpose | Access |
|---|---|---|
| `3000 TCP` | HTTP API, Static Web Client, WebSocket Signaling | Public / Reverse Proxy (Nginx/Cloudflare) |
| `40000 - 49999 UDP` | WebRTC Media Streams (RTP / RTCP) | **Direct Public Internet (UDP REQUIRED)** |
| `40000 - 49999 TCP` | WebRTC ICE TCP Fallback | Public (Optional, for restrictive firewalls) |

> [!IMPORTANT]
> Do NOT place a standard HTTP reverse proxy in front of ports `40000-49999 UDP`. WebRTC requires direct UDP access to achieve sub-50ms peer latency. Set `ANNOUNCED_IP` to your server's public IPv4 address.
