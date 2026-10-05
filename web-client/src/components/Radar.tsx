export interface PeerRadarInfo {
  uuid: string;
  username: string;
  distance: number;
  relX: number;
  relY: number;
  relZ: number;
  isSpeaking?: boolean;
  isSubmerged?: boolean;
  isBroadcast?: boolean;
}

interface RadarProps {
  peers: PeerRadarInfo[];
  maxRange?: number;
  localUsername?: string;
  localUuid?: string;
  size?: number;
  onPeerClick?: (peer: PeerRadarInfo) => void;
}

export function Radar({
  peers,
  maxRange = 30,
  localUsername = 'Tú',
  localUuid,
  size = 320,
  onPeerClick,
}: RadarProps) {
  const center = size / 2;
  const radius = size / 2 - (size < 300 ? 18 : 26);

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Frosted Glass Soundstage Dish */}
      <div
        className="relative bg-slate-950/70 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.1)] overflow-hidden"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {/* Subtle Ambient Radial Backing */}
        <div
          className="absolute inset-0 rounded-full opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--brand-primary, #6366f1) 0%, transparent 70%)',
          }}
        />

        {/* Minimalist Concentric Distance Rings & Compass */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${size} ${size}`}>
          {/* Outer ring (maxRange) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="1"
          />
          {/* Middle ring (2/3 maxRange) */}
          <circle
            cx={center}
            cy={center}
            r={(radius * 2) / 3}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1"
          />
          {/* Inner ring (1/3 maxRange) */}
          <circle
            cx={center}
            cy={center}
            r={radius / 3}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1"
          />

          {/* Minimalist Forward Pointer */}
          <text
            x={center}
            y={20}
            textAnchor="middle"
            fill="rgba(255, 255, 255, 0.35)"
            className="text-[9px] font-mono tracking-widest uppercase"
          >
            ▲ Frente
          </text>
        </svg>

        {/* Local Player Center Pin (Tú) */}
        <div
          className="absolute z-20 flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 group cursor-default"
          style={{ left: center, top: center }}
          title={localUsername}
        >
          {localUuid ? (
            <img
              src={`https://mc-heads.net/avatar/${localUuid}/28`}
              alt={localUsername}
              className="w-8 h-8 rounded-xl border-2 border-indigo-400/80 shadow-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-7 h-7 rounded-xl border-2 border-indigo-400/80 bg-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
            >
              Tú
            </div>
          )}
          <span className="mt-1 px-1.5 py-0.2 rounded-full bg-slate-900/80 border border-white/5 text-[9px] font-medium text-slate-300">
            {localUsername}
          </span>
        </div>

        {/* Audible Nearby Peers */}
        {peers.map((peer) => {
          const normX = Math.max(-1, Math.min(1, peer.relX / maxRange));
          const normZ = Math.max(-1, Math.min(1, peer.relZ / maxRange));

          // Invert Z because forward is up on the soundstage
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
              className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-out group cursor-pointer hover:scale-110 active:scale-95"
              style={{ left: px, top: py }}
              title={`Clic para regular volumen de ${peer.username}`}
            >
              <div className="relative flex flex-col items-center">
                {/* Expanding Voice Pulse Ring when Speaking */}
                {peer.isSpeaking && (
                  <span className="absolute -inset-1.5 rounded-2xl bg-emerald-400/40 animate-ping opacity-75" />
                )}

                {/* Avatar Icon */}
                <div className="relative">
                  <img
                    src={`https://mc-heads.net/avatar/${peer.uuid}/28`}
                    alt={peer.username}
                    className={`w-7 h-7 rounded-xl border shadow-md transition-all object-cover ${
                      peer.isSpeaking
                        ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-105'
                        : peer.isSubmerged
                        ? 'border-cyan-400'
                        : 'border-white/20'
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" fill="%23475569"/><text x="14" y="18" font-size="12" fill="white" text-anchor="middle">?</text></svg>';
                    }}
                  />

                  {/* Elevation Indicator Badge */}
                  {isAbove && (
                    <span
                      className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full text-[8px] font-bold text-amber-300 bg-slate-900/90 border border-amber-400/40 shadow"
                      title={`Arriba por +${elevation}m`}
                    >
                      ▲+{elevation}
                    </span>
                  )}
                  {isBelow && (
                    <span
                      className="absolute -bottom-1.5 -right-1.5 px-1 py-0.2 rounded-full text-[8px] font-bold text-indigo-300 bg-slate-900/90 border border-indigo-400/40 shadow"
                      title={`Abajo por ${elevation}m`}
                    >
                      ▼{elevation}
                    </span>
                  )}

                  {/* Submerged acoustic filter badge */}
                  {peer.isSubmerged && (
                    <span
                      className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border border-slate-900 shadow"
                      title="Sumergido bajo agua"
                    />
                  )}

                  {/* 2D Speaker Broadcast badge */}
                  {peer.isBroadcast && (
                    <span
                      className="absolute -top-1.5 -left-1.5 px-1 py-0.2 rounded text-[8px] font-bold text-violet-300 bg-violet-950/90 border border-violet-500/50 shadow"
                      title="Megáfono 2D / Speaker Block"
                    >
                      📢
                    </span>
                  )}
                </div>

                {/* Subtle Peer Name & Distance Tag */}
                <div className="mt-1 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/10 text-[10px] text-slate-200 whitespace-nowrap shadow-lg flex items-center gap-1">
                  <span className="font-medium">{peer.username}</span>
                  <span className="text-slate-400 font-mono text-[9px]">{peer.distance}m</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Soundstage Legend Footer */}
      <div className="mt-3 px-3 py-1 rounded-full bg-white/[0.04] border border-white/5 text-[11px] text-slate-400 font-mono flex items-center gap-2.5">
        <span>{maxRange}m máx</span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{peers.length} cerca</span>
        </span>
      </div>
    </div>
  );
}
