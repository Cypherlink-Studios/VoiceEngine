import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Observability Stack Automation Suite', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const monitoringDir = path.join(repoRoot, 'monitoring');
  const scriptPath = path.join(repoRoot, 'scripts/prometheus_integration.sh');
  const docPath = path.join(repoRoot, 'docs/observability/PROMETHEUS_GRAFANA.md');

  describe('Prometheus Configuration Assets', () => {
    it('should have a valid Prometheus scrape configuration template', () => {
      const templatePath = path.join(monitoringDir, 'prometheus/prometheus.yml.template');
      expect(fs.existsSync(templatePath)).toBe(true);

      const content = fs.readFileSync(templatePath, 'utf8');
      expect(content).toContain('job_name: \'voiceengine\'');
      expect(content).toContain('metrics_path: \'/metrics\'');
      expect(content).toContain('__SCRAPE_INTERVAL__');
      expect(content).toContain('__VOICEENGINE_TARGET__');
      expect(content).toContain('job_name: \'prometheus\'');
    });
  });

  describe('Grafana Declarative Provisioning Assets', () => {
    it('should have a valid Prometheus data source provisioning manifest', () => {
      const dsPath = path.join(monitoringDir, 'grafana/datasources/prometheus-datasource.yml');
      expect(fs.existsSync(dsPath)).toBe(true);

      const content = fs.readFileSync(dsPath, 'utf8');
      expect(content).toContain('type: prometheus');
      expect(content).toContain('name: Prometheus');
      expect(content).toContain('isDefault: true');
    });

    it('should have a valid dashboard provider provisioning manifest', () => {
      const providerPath = path.join(monitoringDir, 'grafana/dashboards/dashboard-provider.yml');
      expect(fs.existsSync(providerPath)).toBe(true);

      const content = fs.readFileSync(providerPath, 'utf8');
      expect(content).toContain('name: \'VoiceEngine Dashboards\'');
      expect(content).toContain('folder: \'VoiceEngine\'');
      expect(content).toContain('type: file');
    });

    it('should have a valid and comprehensive VoiceEngine overview dashboard JSON model', () => {
      const dashboardPath = path.join(monitoringDir, 'grafana/dashboards/voiceengine-overview.json');
      expect(fs.existsSync(dashboardPath)).toBe(true);

      const content = fs.readFileSync(dashboardPath, 'utf8');
      const dashboard = JSON.parse(content);

      expect(dashboard.title).toBe('VoiceEngine Production Overview');
      expect(dashboard.uid).toBe('voiceengine-overview');
      expect(Array.isArray(dashboard.panels)).toBe(true);
      expect(dashboard.panels.length).toBeGreaterThanOrEqual(10);

      // Verify KPI metric queries exist in the dashboard targets
      const queries = dashboard.panels.flatMap((p: any) =>
        (p.targets || []).map((t: any) => t.expr || '')
      );

      expect(queries.some((q: string) => q.includes('voiceengine_connected_clients_total'))).toBe(true);
      expect(queries.some((q: string) => q.includes('voiceengine_event_loop_lag_ms'))).toBe(true);
      expect(queries.some((q: string) => q.includes('voiceengine_sfu_workers_total'))).toBe(true);
      expect(queries.some((q: string) => q.includes('voiceengine_sfu_transports_total'))).toBe(true);
      expect(queries.some((q: string) => q.includes('voiceengine_spatial_deadband_suppression_ratio'))).toBe(true);
      expect(queries.some((q: string) => q.includes('voiceengine_spatial_grid_active_cells_total'))).toBe(true);
      expect(queries.some((q: string) => q.includes('voiceengine_websocket_messages_total'))).toBe(true);
      expect(queries.some((q: string) => q.includes('voiceengine_spatial_tick_duration_seconds_bucket'))).toBe(true);
    });
  });

  describe('Observability Deployment CLI Script', () => {
    it('should exist and define mandatory CLI options and security configurations', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);

      const script = fs.readFileSync(scriptPath, 'utf8');

      // Shebang and strict error handling
      expect(script).toContain('#!/usr/bin/env bash');
      expect(script).toContain('set -euo pipefail');

      // Command-line flag parsing
      expect(script).toContain('--mode');
      expect(script).toContain('--with-grafana');
      expect(script).toContain('--no-grafana');
      expect(script).toContain('--scrape-interval');
      expect(script).toContain('--retention');
      expect(script).toContain('--security');
      expect(script).toContain('--grafana-port');
      expect(script).toContain('--uninstall');

      // Port collision prevention and conflict resolution
      expect(script).toContain('GRAFANA_PORT="3001"');
      expect(script).toContain('--voice-port');
      expect(script).toContain('is_port_in_use()');
      expect(script).toContain('get_port_process()');
      expect(script).toContain('find_next_free_port()');
      expect(script).toContain('resolve_port_conflict()');

      // Docker Compose target host mapping with dynamic VoiceEngine port
      expect(script).toContain('host.docker.internal:host-gateway');
      expect(script).toContain('host.docker.internal:${VOICE_PORT}');
    });

    it('should include port conflict detection and resolution in the install.sh deployment script', () => {
      const installScriptPath = path.join(repoRoot, 'scripts/install.sh');
      expect(fs.existsSync(installScriptPath)).toBe(true);

      const installScript = fs.readFileSync(installScriptPath, 'utf8');
      expect(installScript).toContain('is_port_in_use()');
      expect(installScript).toContain('find_next_free_port()');
      expect(installScript).toContain('resolve_port_conflict "VoiceEngine Backend" "$VOICE_PORT" VOICE_PORT');
      expect(installScript).toContain('PORT=${VOICE_PORT}');
      expect(installScript).toContain('proxy_pass http://127.0.0.1:${VOICE_PORT};');
    });
  });

  describe('Operations Documentation', () => {
    it('should provide comprehensive setup and SSH tunnel guides', () => {
      expect(fs.existsSync(docPath)).toBe(true);

      const doc = fs.readFileSync(docPath, 'utf8');
      expect(doc).toContain('Prometheus & Grafana Observability Guide');
      expect(doc).toContain('sudo bash scripts/prometheus_integration.sh');
      expect(doc).toContain('ssh -L 3001:localhost:3001');
      expect(doc).toContain('voiceengine_event_loop_lag_ms');
      expect(doc).toContain('voiceengine_spatial_deadband_suppression_ratio');
    });
  });
});
