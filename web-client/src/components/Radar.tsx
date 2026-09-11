export interface PeerRadarInfo {
  uuid: string;
  username: string;
  distance: number;
  relX: number;
  relY: number;
  relZ: number;
  isSpeaking?: boolean;
  isSubmerged?: boolean;
}

interface RadarProps {
  peers: PeerRadarInfo[];
  maxRange?: number;
  localUsername?: string;
}

export function Radar({ peers, maxRange = 30, localUsername = 'You' }: RadarProps) {
  const size = 300;
  const center = size / 2;
  const radius = size / 2 - 20;

  return (
    <div className="relative flex flex-col items-center select-none">
      <div className="relative w-[300px] h-[300px] bg-slate-900/90 rounded-full border-2 border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.15)] overflow-hidden">
        {/* Distance Rings */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${size} ${size}`}>
          {/* Outer ring (30m) */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="1" strokeDasharray="3 3" />
          {/* Middle ring (20m) */}
          <circle cx={center} cy={center} r={(radius * 2) / 3} fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="1" strokeDasharray="3 3" />
          {/* Inner ring (10m) */}
          <circle cx={center} cy={center} r={radius / 3} fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Crosshairs */}
          <line x1={center} y1={10} x2={center} y2={size - 10} stroke="rgba(16,185,129,0.15)" strokeWidth="1" />
          <line x1={10} y1={center} x2={size - 10} y2={center} stroke="rgba(16,185,129,0.15)" strokeWidth="1" />

          {/* Direction indicator (Forward / North) */}
          <text x={center} y={22} textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">▲ FORWARD</text>
        </svg>

        {/* Local Player Center Pin */}
        <div
          className="absolute z-20 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-md transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: center, top: center }}
          title={localUsername}
        />

        {/* Audible Nearby Peers */}
        {peers.map((peer) => {
          // Clamp normalized coordinates to radar bounds
          const normX = Math.max(-1, Math.min(1, peer.relX / maxRange));
          const normZ = Math.max(-1, Math.min(1, peer.relZ / maxRange));

          // Invert Z because forward is up on the radar
          const px = center + normX * radius;
          const py = center - normZ * radius;

          return (
            <div
              key={peer.uuid}
              className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 ease-linear group"
              style={{ left: px, top: py }}
            >
              <div className="relative flex flex-col items-center">
                {/* Speaking Glowing Ring */}
                {peer.isSpeaking && (
                  <span className="absolute -inset-1 rounded-full bg-emerald-400/50 animate-ping" />
                )}

                {/* Avatar Icon */}
                <img
                  src={`https://mc-heads.net/avatar/${peer.uuid}/28`}
                  alt={peer.username}
                  className={`w-7 h-7 rounded-md border-2 shadow-md ${
                    peer.isSpeaking
                      ? 'border-emerald-400 ring-2 ring-emerald-500/50'
                      : peer.isSubmerged
                      ? 'border-cyan-400'
                      : 'border-slate-600'
                  }`}
                  onError={(e) => {
                    // Fallback to placeholder if skin server unreachable
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" fill="%23475569"/><text x="14" y="18" font-size="12" fill="white" text-anchor="middle">?</text></svg>';
                  }}
                />

                {/* Submerged badge */}
                {peer.isSubmerged && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border border-slate-900" title="Submerged" />
                )}

                {/* Label */}
                <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-200 whitespace-nowrap">
                  {peer.username} <span className="text-slate-400">({peer.distance}m)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend & Stats */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400 font-mono">
        <span>Range: {maxRange}m</span>
        <span>Peers in voice: {peers.length}</span>
      </div>
    </div>
  );
}
