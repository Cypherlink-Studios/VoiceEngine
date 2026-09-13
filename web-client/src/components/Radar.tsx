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
  localUuid?: string;
  size?: number;
  onPeerClick?: (peer: PeerRadarInfo) => void;
}

export function Radar({ peers, maxRange = 30, localUsername = 'You', localUuid, size = 320, onPeerClick }: RadarProps) {
  const center = size / 2;
  const radius = size / 2 - (size < 300 ? 18 : 24);

  return (
    <div className="relative flex flex-col items-center select-none">
      <div
        className="relative bg-slate-950/85 backdrop-blur-md rounded-full border border-white/10 shadow-[0_0_35px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {/* Radar Background Glow */}
        <div
          className="absolute inset-0 rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--brand-primary, #6366f1) 0%, transparent 70%)',
          }}
        />

        {/* Distance Rings & Grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${size} ${size}`}>
          {/* Outer ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-white/15"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* Middle ring */}
          <circle
            cx={center}
            cy={center}
            r={(radius * 2) / 3}
            fill="none"
            stroke="currentColor"
            className="text-white/10"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* Inner ring */}
          <circle
            cx={center}
            cy={center}
            r={radius / 3}
            fill="none"
            stroke="currentColor"
            className="text-white/10"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Crosshairs */}
          <line x1={center} y1={12} x2={center} y2={size - 12} stroke="currentColor" className="text-white/10" strokeWidth="1" />
          <line x1={12} y1={center} x2={size - 12} y2={center} stroke="currentColor" className="text-white/10" strokeWidth="1" />

          {/* Direction indicator (North / Forward) */}
          <text
            x={center}
            y={24}
            textAnchor="middle"
            fill="currentColor"
            className="text-white/60 text-[10px] font-bold tracking-widest"
          >
            ▲ FORWARD
          </text>
        </svg>

        {/* Local Player Center Pin */}
        <div
          className="absolute z-20 flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: center, top: center }}
          title={localUsername}
        >
          {localUuid ? (
            <img
              src={`https://mc-heads.net/avatar/${localUuid}/28`}
              alt={localUsername}
              className="w-7 h-7 rounded-md border-2 border-white shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
              style={{ backgroundColor: 'var(--brand-accent, #22c55e)' }}
            />
          )}
        </div>

        {/* Audible Nearby Peers */}
        {peers.map((peer) => {
          const normX = Math.max(-1, Math.min(1, peer.relX / maxRange));
          const normZ = Math.max(-1, Math.min(1, peer.relZ / maxRange));

          // Invert Z because forward is up on the radar
          const px = center + normX * radius;
          const py = center - normZ * radius;

          // Elevation calculation
          const elevation = Math.round(peer.relY);
          const isAbove = elevation >= 2;
          const isBelow = elevation <= -2;

          return (
            <div
              key={peer.uuid}
              onClick={() => onPeerClick?.(peer)}
              className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 ease-linear group cursor-pointer hover:scale-110 active:scale-95"
              style={{ left: px, top: py }}
              title={`Clic para ajustar volumen de ${peer.username}`}
            >
              <div className="relative flex flex-col items-center">
                {/* Speaking Glowing Ring */}
                {peer.isSpeaking && (
                  <span
                    className="absolute -inset-1 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: 'var(--brand-accent, #22c55e)' }}
                  />
                )}

                {/* Avatar Icon */}
                <div className="relative">
                  <img
                    src={`https://mc-heads.net/avatar/${peer.uuid}/28`}
                    alt={peer.username}
                    className={`w-7 h-7 rounded-md border-2 shadow-md transition-all ${
                      peer.isSpeaking
                        ? 'ring-2 ring-emerald-400 scale-105'
                        : peer.isSubmerged
                        ? 'border-cyan-400'
                        : 'border-slate-600'
                    }`}
                    style={
                      peer.isSpeaking
                        ? { borderColor: 'var(--brand-accent, #22c55e)' }
                        : {}
                    }
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" fill="%23475569"/><text x="14" y="18" font-size="12" fill="white" text-anchor="middle">?</text></svg>';
                    }}
                  />

                  {/* Elevation Indicator Badge */}
                  {isAbove && (
                    <span
                      className="absolute -top-2 -right-1 px-1 py-0.2 rounded text-[8px] font-black text-amber-300 bg-slate-900/90 border border-amber-400/50 shadow"
                      title={`Above by ${elevation}m`}
                    >
                      ▲+{elevation}
                    </span>
                  )}
                  {isBelow && (
                    <span
                      className="absolute -bottom-2 -right-1 px-1 py-0.2 rounded text-[8px] font-black text-indigo-300 bg-slate-900/90 border border-indigo-400/50 shadow"
                      title={`Below by ${Math.abs(elevation)}m`}
                    >
                      ▼{elevation}
                    </span>
                  )}

                  {/* Submerged badge */}
                  {peer.isSubmerged && (
                    <span
                      className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border border-slate-900 shadow"
                      title="Submerged"
                    />
                  )}
                </div>

                {/* Label */}
                <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-white/10 text-[10px] text-slate-200 whitespace-nowrap shadow-lg flex items-center gap-1">
                  <span className="font-medium">{peer.username}</span>
                  <span className="text-slate-400 font-mono text-[9px]">{peer.distance}m</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Radar Legend / Range Footer */}
      <div className="mt-2 text-xs text-slate-400 font-mono flex items-center gap-3">
        <span>Range: {maxRange}m</span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--brand-accent, #22c55e)' }} />
          <span>Audible: {peers.length}</span>
        </span>
      </div>
    </div>
  );
}
