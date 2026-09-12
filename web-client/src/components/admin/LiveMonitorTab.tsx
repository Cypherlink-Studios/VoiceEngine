import { useState, useEffect } from 'react';
import { Activity, Users, Radio, Server, Clock, RefreshCw } from 'lucide-react';

interface SessionItem {
  sessionId: string;
  playerUuid: string;
  username: string;
  activeChannel: string;
  isSpeaking: boolean;
}

interface MetricsData {
  connectedClients: number;
  channels: Record<string, number>;
  sessions: SessionItem[];
  pluginConnected: boolean;
  trackedPlayers: number;
  uptimeSeconds: number;
}

interface LiveMonitorTabProps {
  sessionToken: string;
}

export function LiveMonitorTab({ sessionToken }: LiveMonitorTabProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // ignore transient fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const timer = setInterval(fetchMetrics, 2000);
    return () => clearInterval(timer);
  }, [sessionToken]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading && !metrics) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Loading live statistics...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connected Voice Clients */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics?.connectedClients ?? 0}
            </div>
            <div className="text-xs text-slate-400">Connected Voice Clients</div>
          </div>
        </div>

        {/* Paper Plugin Bridge */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
              metrics?.pluginConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{metrics?.pluginConnected ? 'Connected' : 'Disconnected'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  metrics?.pluginConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
            </div>
            <div className="text-xs text-slate-400">Paper Plugin Link</div>
          </div>
        </div>

        {/* Tracked MC Players */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics?.trackedPlayers ?? 0}
            </div>
            <div className="text-xs text-slate-400">Tracked Positional Players</div>
          </div>
        </div>

        {/* Server Uptime */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-white font-mono">
              {formatUptime(metrics?.uptimeSeconds ?? 0)}
            </div>
            <div className="text-xs text-slate-400">Server Uptime</div>
          </div>
        </div>
      </div>

      {/* Active Channels Breakdown */}
      <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-lg">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Channel Distribution
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(metrics?.channels || {}).map(([channel, count]) => (
            <div
              key={channel}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-white/5 text-xs text-slate-200"
            >
              <span className="font-semibold text-white capitalize">{channel}:</span>
              <span className="font-mono text-indigo-400 font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Active Sessions Table */}
      <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-lg">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Active Sessions ({metrics?.sessions?.length ?? 0})</span>
        </h3>

        {metrics?.sessions && metrics.sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-2 font-medium">Player</th>
                  <th className="pb-2 font-medium">Active Channel</th>
                  <th className="pb-2 font-medium">Audio Status</th>
                  <th className="pb-2 font-medium">Session ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {metrics.sessions.map((s) => (
                  <tr key={s.sessionId} className="text-slate-300">
                    <td className="py-2.5 flex items-center gap-2 font-medium text-white">
                      <img
                        src={`https://mc-heads.net/avatar/${s.playerUuid}/20`}
                        alt={s.username}
                        className="w-5 h-5 rounded"
                      />
                      <span>{s.username}</span>
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-mono capitalize">
                        {s.activeChannel}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {s.isSpeaking ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Speaking
                        </span>
                      ) : (
                        <span className="text-slate-500">Idle</span>
                      )}
                    </td>
                    <td className="py-2.5 font-mono text-slate-500 text-[10px]">
                      {s.sessionId.substring(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            No active voice clients connected.
          </div>
        )}
      </div>
    </div>
  );
}
