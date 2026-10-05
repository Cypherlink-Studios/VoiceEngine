import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { X, Volume2, VolumeX } from 'lucide-react';

export interface PlayerVolumePopoverProps {
  peerUuid: string;
  peerUsername: string;
  volume: number; // 0.0 - 2.0
  isMuted: boolean;
  distance?: number;
  relX?: number;
  relY?: number;
  relZ?: number;
  streamerMode?: boolean;
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
  distance,
  relX,
  relY,
  relZ,
  streamerMode = false,
  onVolumeChange,
  onMuteToggle,
  onClose,
  className = '',
}) => {
  const { t } = useTranslation();
  const percent = Math.round(volume * 100);

  return (
    <div
      className={`bg-slate-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.12)] text-white min-w-[260px] z-50 animate-in fade-in zoom-in-95 duration-150 select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={`https://mc-heads.net/avatar/${peerUuid}/28`}
            alt={peerUsername}
            className="w-8 h-8 rounded-xl border border-white/15 shrink-0 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/28';
            }}
          />
          <div className="min-w-0">
            <div className="truncate font-semibold text-xs text-slate-100">{peerUsername}</div>
            {distance !== undefined && (
              <div className="text-[10px] font-mono text-slate-400">
                {streamerMode
                  ? `~${Math.round(distance)}m • ${t('popovers.hiddenCoords')}`
                  : `${Math.round(distance)}m (${relX?.toFixed(0)}, ${relY?.toFixed(0)}, ${relZ?.toFixed(0)})`}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Volume slider */}
      <div className="mt-3 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" />
            <span>{t('popovers.volume')}</span>
          </span>
          <span className="font-semibold font-mono text-emerald-400 text-[11px]">
            {isMuted ? `0% (${t('popovers.mutedStatus')})` : `${percent}%`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={isMuted ? 0 : volume}
          disabled={isMuted}
          onChange={(e) => onVolumeChange(peerUuid, parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0%</span>
          <button
            onClick={() => onVolumeChange(peerUuid, 1.0)}
            className="hover:text-slate-300 transition-colors underline cursor-pointer"
          >
            100%
          </button>
          <span>200%</span>
        </div>
      </div>

      {/* Mute action */}
      <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-slate-400">{t('popovers.muteForMe')}</span>
        <button
          onClick={() => onMuteToggle(peerUuid, !isMuted)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
          }`}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>{t('popovers.unmute')}</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>{t('popovers.mute')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
