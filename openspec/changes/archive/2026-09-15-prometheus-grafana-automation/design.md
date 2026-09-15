## Context

VoiceEngine natively exposes an industry-standard Prometheus exposition endpoint at `GET /metrics` on port 3000 via `prom-client`. See `proposal.md` for background motivation. Currently, operators must manually write Prometheus scrape configurations, provision Docker Compose files, connect Grafana data sources, and compose PromQL queries from scratch. This design establishes an interactive, automated observability installation CLI and pre-configured Grafana dashboard suite.

## Goals / Non-Goals

**Goals:**
- Provide an interactive and non-interactive bash CLI installer (`scripts/prometheus_integration.sh`) supporting dual deployment modes: Docker Compose and Native Systemd.
- Automatically provision Grafana with a pre-configured, comprehensive VoiceEngine dashboard (`voiceengine-overview.json`) and Prometheus data source.
- Avoid port collisions with VoiceEngine (which listens on port 3000) by allocating Grafana to port 3001.
- Support configurable scrape intervals (default 5s) and TSDB retention periods (default 15d).
- Implement secure-by-default access policies (Localhost binding with SSH tunneling instructions or Nginx HTTP basic authentication).
- Provide complete operational and diagnostic documentation in `docs/observability/PROMETHEUS_GRAFANA.md`.
- Keep all script prompts, messages, comments, and dashboard titles strictly in English.

**Non-Goals:**
- Modifying the underlying metrics collection or HTTP endpoints inside `voice-server`.
- Deprecating or replacing the built-in TypeScript Discord watchdog alerts (`DiscordNotifier.ts`).
- Setting up external Alertmanager clusters or long-term multi-tenant metrics storage (e.g., Thanos / Cortex).

## Decisions

### 1. Dual Deployment Architecture (Docker Compose vs Native Systemd)

- **Chosen Approach**: Support Docker Compose as the recommended default (for isolated runtimes and effortless Grafana management) while providing a Native Systemd mode (using `apt-get install prometheus`) for minimal VPS hosts without Docker.
- **Rationale**: Operators have diverse server environments. Containerization ensures reproducible Grafana and Prometheus versions without polluting host packages, while Systemd accommodates low-spec virtual servers.
- **Alternatives Considered**: 
  - *Docker-only*: Would exclude operators running on lightweight VPS environments where Docker is not installed or permitted.
  - *Systemd-only*: Would make Grafana setup significantly more brittle due to external APT repository signatures and distribution differences.

### 2. Turnkey Grafana Provisioning via Declarative Manifests

- **Chosen Approach**: Supply YAML files in Grafana's provisioning directory (`provisioning/datasources/prometheus-datasource.yml` and `provisioning/dashboards/dashboard-provider.yml`).
- **Rationale**: On startup, Grafana automatically discovers and connects the Prometheus data source and loads `voiceengine-overview.json` without requiring operator interaction, manual UI clicking, or fragile API scripting.
- **Alternatives Considered**:
  - *Manual UI import*: Requires operators to copy-paste JSON and configure URLs manually.
  - *Curl API provisioning*: Requires waiting for Grafana to boot, handling admin token authentication, and managing race conditions.

### 3. Resolving Port 3000 Collisions (Port Allocation Strategy)

- **Chosen Approach**: Map Grafana to host port `3001` (or allow user customization via prompt/flags), while Prometheus listens on port `9090`.
- **Rationale**: VoiceEngine's HTTP/WebSocket server already occupies port `3000`. Grafana defaults to 3000, which causes immediate bind failures if unmapped.

### 4. Docker Host Network Bridging (`host.docker.internal`)

- **Chosen Approach**: In Docker Compose, configure `extra_hosts: ["host.docker.internal:host-gateway"]` and target `host.docker.internal:3000` in the Prometheus scrape configuration.
- **Rationale**: Allows the Prometheus container to query the host-bound VoiceEngine `/metrics` endpoint seamlessly across Linux, macOS, and Windows.

### 5. Secure-by-Default Access Policy

- **Chosen Approach**: Default to binding services to `127.0.0.1` and advise accessing the dashboard via an SSH tunnel (`ssh -L 3001:localhost:3001 user@vps`). Offer an option for Nginx reverse proxying with HTTP basic authentication (`htpasswd`).
- **Rationale**: Exposing unauthenticated Prometheus PromQL or Grafana login endpoints to the public internet creates a security risk.

## Risks / Trade-offs

- **[Port 3000 Collision]** Grafana default port matches VoiceEngine.  
  *Mitigation*: Pre-configure Docker and Systemd configs to map Grafana to port `3001`.
- **[Docker Missing on Host]** Operator selects Docker mode on a system without Docker.  
  *Mitigation*: The installer script checks for `docker` and `docker compose`. If missing, it offers to either install Docker or automatically fall back to Native Systemd mode.
- **[TSDB Disk Bloat]** Prometheus storing unbounded metrics on small VPS disks.  
  *Mitigation*: Enforce `--storage.tsdb.retention.time=15d` by default in both Docker and Systemd configurations.
- **[Scrape Target Unreachable]** VoiceEngine is not running during installer execution.  
  *Mitigation*: Script performs a pre-flight probe (`curl -s http://localhost:3000/metrics`) and outputs an informative warning if the server is offline, without aborting installation.

## Migration & Rollback

The installer script includes a `--uninstall` flag that gracefully stops containers, removes Docker volumes or systemd units, and purges generated monitoring files if an operator decides to remove the observability stack.
