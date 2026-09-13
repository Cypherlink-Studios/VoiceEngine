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
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 select-none overflow-hidden font-sans">
      {/* Mini Header */}
      <div className="w-full flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {localPlayer ? (
            <img
              src={`https://mc-heads.net/avatar/${localPlayer.uuid}/20`}
              alt={localPlayer.username}
              className="w-5 h-5 rounded-md border border-white/20 shrink-0"
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
              className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                pingMs < 70
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : pingMs < 150
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-rose-400 bg-rose-500/10'
              }`}
            >
              <Activity className="w-2.5 h-2.5" />
              <span>{pingMs}ms</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar Overlay"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mini Radar */}
      <div className="my-auto flex items-center justify-center scale-90">
        <Radar
          peers={peers}
          maxRange={30}
          localUsername={localPlayer?.username}
          localUuid={localPlayer?.uuid}
          size={240}
          onPeerClick={onPeerClick}
        />
      </div>

      {/* Floating Action Controls */}
      <div className="w-full flex items-center justify-center gap-3 mt-2 pt-2 border-t border-white/10">
        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
          title="Mutear / Desmutear [M]"
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'Mute' : 'Mic'}</span>
          {!isMuted && isSpeaking && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>

        {/* Deafen Button */}
        <button
          onClick={onToggleDeafen}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer ${
            isDeafened
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700'
          }`}
          title="Ensordecer [D]"
        >
          {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
          <span>{isDeafened ? 'Sordo' : 'Oír'}</span>
        </button>
      </div>
    </div>
  );
};
