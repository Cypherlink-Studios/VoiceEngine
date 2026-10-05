import React from 'react';
import { Mic, MicOff, Headphones, VolumeX, Activity, X } from 'lucide-react';
import { Radar, PeerRadarInfo } from '../Radar.js';

export interface PipOverlayProps {
  localPlayer: { uuid: string; username: string } | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  pingMs: number | null;
  peers: PeerRadarInfo[];
  streamerMode: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onClose: () => void;
  onPeerClick?: (peer: PeerRadarInfo) => void;
}

export const PipOverlay: React.FC<PipOverlayProps> = ({
  localPlayer,
  isMuted,
  isDeafened,
  isSpeaking,
  pingMs,
  peers,
  streamerMode,
  onToggleMute,
  onToggleDeafen,
  onClose,
  onPeerClick,
}) => {
  return (
    <div className="relative w-full h-full bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 select-none overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Mini Header */}
      <div className="relative z-10 w-full flex items-center justify-between px-1 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {localPlayer ? (
            <img
              src={`https://mc-heads.net/avatar/${localPlayer.uuid}/20`}
              alt={localPlayer.username}
              className="w-5 h-5 rounded-lg border border-white/20 shrink-0 object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
          <span className="text-xs font-semibold truncate text-slate-200">
            {streamerMode ? 'Jugador' : localPlayer?.username || 'Voice'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pingMs !== null && (
            <div
              className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                pingMs < 70
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                  : pingMs < 150
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
              }`}
            >
              <Activity className="w-2.5 h-2.5" />
              <span>{pingMs}ms</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar Overlay"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact Spatial Soundstage */}
      <div className="relative z-10 my-auto flex items-center justify-center scale-95">
        <Radar
          peers={peers}
          maxRange={30}
          localUsername={localPlayer?.username}
          localUuid={localPlayer?.uuid}
          size={210}
          onPeerClick={onPeerClick}
        />
      </div>

      {/* Floating Action Capsule */}
      <div className="relative z-10 w-full flex items-center justify-center pt-2">
        <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-lg">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            className={`relative flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all shadow-md cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : !isMuted && isSpeaking
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400 ring-2 ring-emerald-400/60'
                : 'bg-white/10 text-white border border-white/10 hover:bg-white/15'
            }`}
            title={isMuted ? 'Activar micrófono [M]' : 'Silenciar micrófono [M]'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Deafen Button */}
          <button
            onClick={onToggleDeafen}
            className={`relative flex items-center justify-center w-9 h-9 rounded-full font-semibold transition-all shadow-md cursor-pointer ${
              isDeafened
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-white/10 text-white border border-white/10 hover:bg-white/15'
            }`}
            title={isDeafened ? 'Activar audio [D]' : 'Ensordecer audio [D]'}
          >
            {isDeafened ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Headphones className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
