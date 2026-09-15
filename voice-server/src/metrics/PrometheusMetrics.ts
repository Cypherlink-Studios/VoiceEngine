import client from 'prom-client';
import { SpatialEngine } from '../spatial/SpatialEngine.js';
import { MediasoupManager } from '../sfu/MediasoupManager.js';
import { ClientGateway } from '../gateway/ClientGateway.js';

export const register = new client.Registry();

// Default metrics (Node process, memory, heap, event loop lag, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'voiceengine_',
});

// Custom Prometheus Gauges, Counters, and Histograms
export const eventLoopLagGauge = new client.Gauge({
  name: 'voiceengine_event_loop_lag_ms',
  help: 'Event loop delay in milliseconds measured by high-resolution timer',
  registers: [register],
});

export const sfuWorkersGauge = new client.Gauge({
  name: 'voiceengine_sfu_workers_total',
  help: 'Total number of active Mediasoup worker processes',
  registers: [register],
});

export const sfuTransportsGauge = new client.Gauge({
  name: 'voiceengine_sfu_transports_total',
  help: 'Total number of active WebRTC and Pipe transports in the SFU',
  registers: [register],
});

export const connectedClientsGauge = new client.Gauge({
  name: 'voiceengine_connected_clients_total',
  help: 'Total number of active authenticated WebSocket client sessions',
  registers: [register],
});

export const spatialTickDurationHistogram = new client.Histogram({
  name: 'voiceengine_spatial_tick_duration_seconds',
  help: 'Duration of spatial calculation ticks in seconds',
  buckets: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [register],
});

export const spatialHashActiveCellsGauge = new client.Gauge({
  name: 'voiceengine_spatial_grid_active_cells_total',
  help: 'Number of active 3D spatial hash grid cells populated with players',
  registers: [register],
});

export const spatialSuppressionRatioGauge = new client.Gauge({
  name: 'voiceengine_spatial_deadband_suppression_ratio',
  help: 'Ratio of spatial updates suppressed by deadband filter (0.0 to 1.0)',
  registers: [register],
});

export const wsMessagesCounter = new client.Counter({
  name: 'voiceengine_websocket_messages_total',
  help: 'Total WebSocket messages sent and received',
  labelNames: ['direction', 'format'] as const,
  registers: [register],
});

/**
 * Updates dynamic Prometheus gauges prior to exposition.
 */
export function updateDynamicMetrics(
  spatialEngine?: SpatialEngine,
  sfu?: MediasoupManager,
  clientGateway?: ClientGateway
): void {
  if (sfu) {
    sfuWorkersGauge.set(sfu.getWorkers().length);
    const workerStats = sfu.getWorkerStats();
    const totalTransports = workerStats.reduce((acc, w) => acc + w.activeTransports, 0);
    sfuTransportsGauge.set(totalTransports);
  }

  if (clientGateway) {
    connectedClientsGauge.set(clientGateway.getConnectedClientsCount());
  }

  if (spatialEngine) {
    spatialHashActiveCellsGauge.set(spatialEngine.getActiveCellCount());
    const stats = spatialEngine.getSuppressionStats();
    spatialSuppressionRatioGauge.set(stats.ratio);
  }
}

export async function getMetricsSnapshot(): Promise<string> {
  return register.metrics();
}

export function getMetricsContentType(): string {
  return register.contentType;
}
