## Why

VoiceEngine exposes industry-standard Prometheus metrics (`/metrics`) and multi-worker SFU telemetry, but server administrators currently lack a turnkey, automated mechanism to deploy and configure the observability stack. Setting up Prometheus TSDB scrapers, Docker Compose manifests, Grafana data sources, and custom PromQL dashboard visualizations manually is error-prone and time-consuming. Providing a dedicated interactive deployment script and pre-configured Grafana dashboard delivers one-click production monitoring for voice chat infrastructure.

## What Changes

- Add interactive and unattended CLI installer script `scripts/prometheus_integration.sh` supporting both Docker Compose and Native Systemd deployment modes with configurable scrape intervals and data retention.
- Add Prometheus scrape job configuration template in `monitoring/prometheus/prometheus.yml.template` targeting VoiceEngine (`http://localhost:3000/metrics` or Docker host gateway).
- Add pre-configured Grafana dashboard JSON in `monitoring/grafana/dashboards/voiceengine-overview.json` with real-time KPI cards, event loop lag percentiles (P50/P90/P99), Mediasoup worker CPU gauges, WebSocket throughput, and spatial deadband savings.
- Add Grafana automated provisioning manifests (`prometheus-datasource.yml` and `dashboard-provider.yml`) to auto-link Prometheus and load dashboards on initial boot without manual UI configuration.
- Add operational guide `docs/observability/PROMETHEUS_GRAFANA.md` detailing deployment, SSH tunneling, Grafana navigation, and PromQL metric references.
- Ensure all script CLI prompts, terminal logs, dashboard labels, and configuration files are generated strictly in English.

## Capabilities

### New Capabilities
- `observability-stack`: Turnkey Prometheus and Grafana deployment automation, pre-configured dashboard provisioning, and operational metrics visualization for VoiceEngine.

### Modified Capabilities
<!-- None: Core voice-server and web-client behaviors are unchanged. -->

## Impact

- **File Additions**: `scripts/prometheus_integration.sh`, `monitoring/prometheus/*`, `monitoring/grafana/*`, and `docs/observability/PROMETHEUS_GRAFANA.md`.
- **System Requirements**: Optional Docker/Compose or native `prometheus`/`grafana` packages on the host machine.
- **Breaking Changes**: None. Existing server and plugin operations remain completely unaffected.
