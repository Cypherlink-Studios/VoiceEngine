## 1. Prometheus & Grafana Configuration Assets

- [x] 1.1 Create Prometheus scrape configuration template in `monitoring/prometheus/prometheus.yml.template` configured for VoiceEngine target on port 3000 with configurable scrape intervals and verify YAML syntax validity.
- [x] 1.2 Create Grafana data source provisioning configuration in `monitoring/grafana/datasources/prometheus-datasource.yml` targeting Prometheus, verifying YAML structure.
- [x] 1.3 Create Grafana dashboard provider configuration in `monitoring/grafana/dashboards/dashboard-provider.yml`, verifying dashboard folder mappings.
- [x] 1.4 Create the complete turnkey Grafana dashboard JSON model in `monitoring/grafana/dashboards/voiceengine-overview.json` with KPI stat cards, Event Loop Lag percentiles, Mediasoup worker CPU usage gauges, spatial calculation latencies, and WebSocket throughput, verifying valid JSON syntax.

## 2. Interactive Observability Deployment CLI

- [x] 2.1 Implement `scripts/prometheus_integration.sh` in English with command-line argument parsing for `--mode`, `--with-grafana`, `--scrape-interval`, `--retention`, `--security`, and `-y`/`--yes`.
- [x] 2.2 Implement the interactive wizard prompt flow (deployment mode, components, scrape interval, retention, and security policy) with bash color-coded logging and pre-flight dependency checks.
- [x] 2.3 Implement Docker Compose generation writing `monitoring/docker-compose.yml` with port 3001 mapping for Grafana, host gateway networking, and volume bindings.
- [x] 2.4 Implement Native Systemd provisioning flow using `apt-get install prometheus` with automated `/etc/prometheus/prometheus.yml` replacement and service reload.
- [x] 2.5 Implement `--uninstall` and cleanup routines in `scripts/prometheus_integration.sh`, and ensure execution permissions (`chmod +x`).

## 3. Documentation & Architectural References

- [x] 3.1 Create `docs/observability/PROMETHEUS_GRAFANA.md` in English with quickstart commands, SSH tunneling walkthrough, Grafana login steps, and PromQL metric glossary.
- [x] 3.2 Update `docs/architecture/ARCHITECTURE.md` to reference the observability setup script and pre-built Grafana dashboard.

## 4. Verification & Testing

- [x] 4.1 Create automated test suite in `voice-server/test/ObservabilityAutomation.test.ts` to verify YAML configurations, JSON dashboard schema, script execution flags, and port mapping rules.
- [x] 4.2 Run full test suite to verify zero regressions across existing server components.
