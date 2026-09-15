## Purpose

Provides automated provisioning, configuration, and visualization of VoiceEngine metrics using Prometheus TSDB and Grafana dashboards.

## ADDED Requirements

### Requirement: Interactive Observability Deployment CLI
The deployment system SHALL provide an interactive command-line setup script that prompts the operator for deployment preferences, supports non-interactive CLI flags, and verifies system dependencies before provisioning Prometheus and Grafana.

#### Scenario: Interactive execution with user prompts
- **WHEN** an operator runs `scripts/prometheus_integration.sh` in an interactive terminal session
- **THEN** the script SHALL prompt for deployment mode (Docker Compose vs Native Systemd), optional Grafana inclusion, scrape interval, retention window, and access security policy before executing installation steps.

#### Scenario: Unattended execution with CLI flags
- **WHEN** the script is executed with non-interactive flags (e.g., `--mode docker --with-grafana --yes`)
- **THEN** the script SHALL bypass interactive prompts, apply the provided configuration arguments, and provision the monitoring stack without halting for user confirmation.

### Requirement: Automated Prometheus Scrape Configuration
The observability stack SHALL configure Prometheus to scrape the VoiceEngine metrics endpoint at regular intervals and persist scraped metrics with configurable data retention.

#### Scenario: Periodic metrics collection
- **WHEN** the Prometheus service initializes with the generated configuration
- **THEN** it SHALL query `GET /metrics` on the VoiceEngine host at the configured interval (e.g. 5 seconds) and store time-series samples for Event Loop Lag, worker CPU, WebRTC transports, spatial calculation durations, and WebSocket throughput.

### Requirement: Turnkey Grafana Dashboard and Datasource Provisioning
The observability stack SHALL automatically register Prometheus as the default data source and load a pre-configured VoiceEngine overview dashboard on startup without requiring manual UI configuration.

#### Scenario: Automatic dashboard registration on boot
- **WHEN** Grafana starts up within the provisioned stack
- **THEN** it SHALL automatically load the VoiceEngine overview dashboard displaying real-time KPI stat cards, Event Loop Lag percentiles, Mediasoup worker CPU usage charts, and spatial audio calculation latencies.

#### Scenario: Automatic Prometheus datasource linkage
- **WHEN** an operator opens the provisioned Grafana instance
- **THEN** the Prometheus data source SHALL be pre-configured and verified active, enabling instant rendering of dashboard panels.

### Requirement: Observability Stack Operational Guidance
The repository SHALL provide comprehensive operational documentation in `docs/observability/PROMETHEUS_GRAFANA.md` detailing architecture, installation steps, secure remote access methods, and metric reference definitions.

#### Scenario: Operator references monitoring guide
- **WHEN** an operator consults `docs/observability/PROMETHEUS_GRAFANA.md`
- **THEN** the document SHALL provide instructions for running the installation script, accessing Grafana via SSH tunneling or reverse proxy, and interpreting key voice chat performance metrics.
