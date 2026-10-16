import { Users, Volume2, VolumeX, ShieldAlert, Waves } from 'lucide-react';
import { PeerRadarInfo } from '../Radar.js';
import { useTranslation } from '../../i18n/index.js';

export interface ProximityRosterProps {
  peers: PeerRadarInfo[];
  peerVolumes: Record<string, number>;
  peerMuted: Record<string, boolean>;
  onSetPeerVolume: (peerUuid: string, volume: number) => void;
  onSetPeerMuted: (peerUuid: string, muted: boolean) => void;
  onPeerClick?: (peer: PeerRadarInfo) => void;
}

export function ProximityRoster({
  peers,
  peerVolumes,
  peerMuted,
  onSetPeerVolume,
  onSetPeerMuted,
  onPeerClick,
}: ProximityRosterProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-xl p-6 rounded-3xl bg-slate-950/70 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.1)] flex flex-col items-center select-none">
      {/* Header */}
      <div className="w-full flex items-center justify-between pb-3.5 border-b border-white/10 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>{t('roster.proximityTitle')}</span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>{t('roster.radarRestricted')}</span>
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('roster.proximitySubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs text-slate-300 font-mono">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{peers.length}</span>
        </div>
      </div>

      {/* Roster List / Empty State */}
      {peers.length === 0 ? (
        <div className="w-full py-12 flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-center mb-3 text-slate-500">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300 mb-1">
            {t('roster.emptyTitle')}
          </p>
          <p className="text-xs text-slate-500 max-w-xs">
            {t('roster.emptyDesc')}
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {peers.map((peer) => {
            const currentVol = peerVolumes[peer.uuid] ?? 1.0;
            const isMuted = peerMuted[peer.uuid] ?? false;
            const percent = Math.round(currentVol * 100);
            const isSpeaking = Boolean(peer.isSpeaking);

            return (
              <div
                key={peer.uuid}
                onClick={() => onPeerClick?.(peer)}
                className={`flex items-center justify-between gap-3.5 p-3 rounded-2xl bg-slate-900/60 border transition-all ${
                  isSpeaking
                    ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                {/* Player Avatar and Name */}
                <div className="flex items-center gap-3 min-w-[130px] shrink-0">
                  <div className="relative">
                    <img
                      src={`https://mc-heads.net/avatar/${peer.uuid}/40`}
                      alt={peer.username}
                      className={`w-9 h-9 rounded-xl border object-cover transition-all ${
                        isSpeaking
                          ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-105'
                          : 'border-white/15'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://mc-heads.net/avatar/MHF_Steve/40';
                      }}
                    />
                    {isSpeaking && (
                      <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                      <span className="truncate">{peer.username}</span>
                      {peer.isSubmerged && (
                        <span title={t('soundstage.submerged')}>
                          <Waves className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] font-mono ${
                        isSpeaking ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {isSpeaking ? t('roster.speaking') : t('roster.idle')}
                    </div>
                  </div>
                </div>

                {/* Per-Player Volume Slider */}
                <div
                  className="flex-1 flex items-center gap-2.5 max-w-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={isMuted ? 0 : currentVol}
                    disabled={isMuted}
                    onChange={(e) =>
                      onSetPeerVolume(peer.uuid, parseFloat(e.target.value))
                    }
                    className="flex-1 h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                    title={`${peer.username}: ${percent}%`}
                  />
                  <span className="w-9 text-right font-mono text-xs text-indigo-400 shrink-0">
                    {isMuted ? t('settings.players.mutedIndicator') : `${percent}%`}
                  </span>
                </div>

                {/* Local Mute Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPeerMuted(peer.uuid, !isMuted);
                  }}
                  className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                    isMuted
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-white/10 hover:text-white'
                  }`}
                  title={isMuted ? t('settings.players.unmuteButton') : t('settings.players.muteButton')}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
