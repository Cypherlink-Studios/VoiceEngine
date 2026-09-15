# Prometheus & Grafana Observability Guide

> **VoiceEngine**: Automated metrics collection, TSDB storage, and real-time Grafana visualization for spatial voice chat infrastructure.

This guide details how to deploy, configure, and operate the VoiceEngine observability stack using the interactive setup script `scripts/prometheus_integration.sh`.

---

## 1. Overview & Architecture

VoiceEngine's backend (`voice-server`) exposes an industry-standard Prometheus metrics endpoint at `GET /metrics` on port 3000. The observability stack continuously scrapes this endpoint, stores time-series samples in Prometheus, and visualizes them on a turnkey Grafana dashboard.

```
┌─────────────────────────────────────────────────────────────┐
│                    HOST SERVER (UBUNTU)                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ VoiceEngine Server (:3000)                            │  │
│  │  - GET /metrics (prom-client)                         │  │
│  │  - Mediasoup SFU Multi-Worker Pool                    │  │
│  │  - 3D Spatial Grid & Deadband Telemetry               │  │
│  └───────────────────────────▲───────────────────────────┘  │
│                              │                              │
│                              │ HTTP GET /metrics (every 5s) │
│                              │                              │
│  ┌───────────────────────────┴───────────────────────────┐  │
│  │ Prometheus TSDB (:9090)                               │  │
│  │  - Time-series database storage                       │  │
│  │  - Retention: 15 days (configurable)                  │  │
│  └───────────────────────────▲───────────────────────────┘  │
│                              │                              │
│                              │ PromQL Data Source           │
│                              │                              │
│  ┌───────────────────────────┴───────────────────────────┐  │
│  │ Grafana Dashboard (:3001)                             │  │
│  │  - VoiceEngine Production Overview Dashboard          │  │
│  │  - Auto-provisioned datasources & dashboards          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Quickstart Deployment

Run the interactive setup wizard with root/sudo privileges:

```bash
cd /opt/VoiceEngine  # Or your repository root
sudo bash scripts/prometheus_integration.sh
```

### Interactive Wizard Prompts

The wizard will guide you through 5 simple configuration choices:

1. **Deployment Architecture**:
   - `1) Docker Compose (Recommended)`: Runs Prometheus and Grafana in isolated containers with automated volume management.
   - `2) Native Systemd`: Installs system packages via `apt-get` for minimal memory footprints.
2. **Components**:
   - `1) Prometheus + Grafana (Recommended)`: Complete visualization suite with pre-built dashboard.
   - `2) Prometheus Only`: Lightweight TSDB with PromQL web interface on `:9090`.
3. **Metric Collection Interval**: `[5s]` (default: 5 seconds; options: `2s`, `5s`, `15s`).
4. **Data Retention Window**: `[15d]` (default: 15 days; options: `7d`, `15d`, `30d`).
5. **Security Policy**:
   - `1) Localhost Only (Recommended)`: Services bind to `127.0.0.1` for maximum security via SSH tunneling.
   - `2) Reverse Proxy`: Configures Nginx with HTTP Basic Auth.
   - `3) Open Port`: Binds to `0.0.0.0` (development environments only).

---

## 3. Unattended / Automated Execution (CI / Headless)

For scripted installations or infrastructure automation, pass non-interactive flags:

```bash
# Full stack deployment with Docker Compose
sudo bash scripts/prometheus_integration.sh \
    --mode docker \
    --with-grafana \
    --scrape-interval 5s \
    --retention 15d \
    --security localhost \
    -y

# Native Systemd deployment (Prometheus only)
sudo bash scripts/prometheus_integration.sh \
    --mode systemd \
    --no-grafana \
    --scrape-interval 10s \
    -y
```

### Supported CLI Flags

| Flag | Argument | Default | Description |
| :--- | :--- | :--- | :--- |
| `--mode` | `docker` or `systemd` | `docker` | Deployment architecture method |
| `--with-grafana` | None | `true` | Include Grafana and pre-built dashboard |
| `--no-grafana` | None | `false` | Install Prometheus TSDB only |
| `--scrape-interval` | Interval string | `5s` | Scrape frequency (e.g. `2s`, `5s`, `15s`) |
| `--retention` | Time string | `15d` | TSDB storage retention (e.g. `7d`, `15d`, `30d`) |
| `--security` | `localhost`, `nginx`, `open` | `localhost` | Network binding and firewall policy |
| `--grafana-port` | Integer port | `3001` | Host port mapped to Grafana |
| `--prometheus-port` | Integer port | `9090` | Host port mapped to Prometheus |
| `--voice-port` | Integer port | `3000` | Port where VoiceEngine is running (auto-detected from `.env`) |
| `-y`, `--yes` | None | `false` | Non-interactive mode using defaults |
| `--uninstall` | None | `false` | Stop and remove monitoring stack |
| `-h`, `--help` | None | - | Display help and argument reference |

---

## 4. Port Conflict Resolution (Pterodactyl & Multi-Tenant VPSs)

VPS environments hosting game control panels (such as **Pterodactyl Wings / Panel**), existing Docker containers, or auxiliary monitoring stacks often have common ports already occupied (e.g., `3000` used by Node apps or web panels, `3001` used by other frontends, or `9090` used by system metrics daemons).

The VoiceEngine deployment scripts (`scripts/prometheus_integration.sh` and `scripts/install.sh`) feature intelligent port inspection and conflict handling:

1. **Multi-Tool Detection**: Inspects socket bindings using `ss`, `lsof`, `netstat`, and `/dev/tcp` socket probing.
2. **Process Identification**: Identifies the exact process name and PID occupying the port (e.g. `wings (PID: 1234)` or `docker-proxy (PID: 5678)`).
3. **Interactive Reallocation**: In interactive mode, the wizard warns the operator, suggests the next available free port (e.g., `9091` or `3002`), and allows accepting or specifying a custom port.
4. **Unattended Auto-Resolution (`-y`)**: When running non-interactively, collisions are automatically resolved to the next free port without failing or aborting the deployment.
5. **Dynamic Target Scrapes**: Prometheus automatically scrapes the exact VoiceEngine port (`--voice-port` or auto-detected from `voice-server/.env`).

---

## 5. Secure Access via SSH Tunneling

By default, Prometheus and Grafana are bound to `127.0.0.1` to protect sensitive operational metrics from public exposure.

To access the dashboards securely from your local workstation:

```bash
# Forward Grafana (3001) and Prometheus (9090) over SSH
ssh -L 3001:localhost:3001 -L 9090:localhost:9090 user@your-server-ip
```

Once the SSH session is established, navigate in your local browser to:
- **Grafana Dashboard**: [http://localhost:3001](http://localhost:3001)
  - **Default Username**: `admin`
  - **Default Password**: `admin`
- **Prometheus PromQL Console**: [http://localhost:9090](http://localhost:9090)

---

## 5. Turnkey Dashboard Features (`voiceengine-overview.json`)

The pre-built dashboard is auto-loaded in Grafana under the `VoiceEngine` folder and contains:

1. **High-Level Status KPI Cards**:
   - **Connected Clients**: Real-time count of authenticated player WebRTC sessions.
   - **Event Loop Lag**: Current Node.js lag in milliseconds (Green: $<15$ms, Yellow: $15-30$ms, Red: $>30$ms).
   - **Mediasoup SFU Workers**: Active C++ worker processes.
   - **Active SFU Transports**: Total WebRTC and inter-worker PipeTransports.
   - **Deadband Bandwidth Saved**: Percentage of redundant spatial frames suppressed by deadband filter.
   - **Active 3D Grid Cells**: Number of populated spatial hash cells in the game world.
2. **Node.js Runtime & Health Watchdog**:
   - Historical time-series graph of Event Loop Lag with a red 30ms alert threshold line.
   - Process memory distribution (Heap Used, Heap Total, and Resident Set Size).
3. **Spatial Engine & Network Throughput**:
   - Spatial calculation duration percentiles (P50 and P95 latency in ms).
   - WebSocket message rate partitioned by direction (`sent` / `received`) and format (`binary` / `json`).

---

## 6. Complete Prometheus Metric Reference

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `voiceengine_connected_clients_total` | Gauge | Active authenticated browser WebSocket sessions |
| `voiceengine_event_loop_lag_ms` | Gauge | Node.js Event Loop delay in milliseconds |
| `voiceengine_sfu_workers_total` | Gauge | Number of active Mediasoup worker processes |
| `voiceengine_sfu_transports_total` | Gauge | Active WebRTC and inter-worker pipe transports |
| `voiceengine_spatial_grid_active_cells_total` | Gauge | Active 3D spatial grid cells with player presence |
| `voiceengine_spatial_deadband_suppression_ratio`| Gauge | Deadband suppression ratio (0.0 to 1.0) |
| `voiceengine_spatial_tick_duration_seconds` | Histogram | Spatial evaluation cycle calculation duration |
| `voiceengine_websocket_messages_total` | Counter | Total WebSocket packets labeled by direction and format |
| `voiceengine_process_cpu_user_seconds_total` | Counter | Total user CPU time spent by VoiceEngine process |
| `voiceengine_nodejs_heap_size_used_bytes` | Gauge | Node.js V8 heap memory consumed |

---

## 7. Teardown and Uninstallation

To cleanly stop containers, remove volumes, and purge generated configurations:

```bash
sudo bash scripts/prometheus_integration.sh --uninstall
```
