import React from 'react';

export interface PlayerVolumePopoverProps {
  peerUuid: string;
  peerUsername: string;
  volume: number; // 0.0 - 2.0
  isMuted: boolean;
  onVolumeChange: (peerUuid: string, volume: number) => void;
  onMuteToggle: (peerUuid: string, isMuted: boolean) => void;
  onClose: () => void;
  className?: string;
}

export const PlayerVolumePopover: React.FC<PlayerVolumePopoverProps> = ({
  peerUuid,
  peerUsername,
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  onClose,
  className = '',
}) => {
  const percent = Math.round(volume * 100);

  return (
    <div
      className={`bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl text-white min-w-[240px] z-50 animate-in fade-in zoom-in-95 duration-150 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={`https://mc-heads.net/avatar/${peerUuid}/28`}
            alt={peerUsername}
            className="w-7 h-7 rounded-md border border-white/20 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/28';
            }}
          />
          <div className="truncate font-medium text-sm text-slate-100">{peerUsername}</div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          title="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Volume slider */}
      <div className="mt-3 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Volumen Local</span>
          <span className="font-semibold font-mono text-emerald-400">{isMuted ? '0% (Silenciado)' : `${percent}%`}</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={isMuted ? 0 : volume}
          disabled={isMuted}
          onChange={(e) => onVolumeChange(peerUuid, parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>0%</span>
          <button
            onClick={() => onVolumeChange(peerUuid, 1.0)}
            className="hover:text-slate-300 transition-colors underline"
          >
            100%
          </button>
          <span>200%</span>
        </div>
      </div>

      {/* Mute action */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-slate-400">Silenciar para mí</span>
        <button
          onClick={() => onMuteToggle(peerUuid, !isMuted)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
          }`}
        >
          {isMuted ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              <span>Desmutear</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span>Silenciar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
