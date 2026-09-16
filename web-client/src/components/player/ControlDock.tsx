import { Mic, MicOff, Volume2, Power, Settings, Headphones, VolumeX, PictureInPicture2, QrCode, Sparkles } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform.js';
import { useTranslation } from '../../i18n/index.js';

interface ControlDockProps {
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  masterVolume: number;
  vadThreshold: number;
  analyser: AnalyserNode | null;
  pingMs: number | null;
  isPipSupported: boolean;
  isPipActive: boolean;
  isModerationMuted?: boolean;
  aiNoiseSuppression?: boolean;
  speechProbability?: number;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onTogglePip: () => void;
  onOpenQrCompanion: () => void;
  onChangeMasterVolume: (vol: number) => void;
  onChangeVadThreshold: (threshold: number) => void;
  onOpenSettings: () => void;
  onDisconnect: () => void;
}

export function ControlDock({
  isMuted,
  isDeafened,
  isSpeaking,
  masterVolume,
  vadThreshold,
  analyser,
  pingMs,
  isPipSupported,
  isPipActive,
  isModerationMuted,
  aiNoiseSuppression = true,
  speechProbability = 0,
  onToggleMute,
  onToggleDeafen,
  onTogglePip,
  onOpenQrCompanion,
  onChangeMasterVolume,
  onChangeVadThreshold,
  onOpenSettings,
  onDisconnect,
}: ControlDockProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[95vw] z-40">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-3 sm:px-5 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl">
        {/* Left: Mic toggle, Deafen toggle & Waveform */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start shrink-0">
          {/* Mic Toggle */}
          <button
            onClick={onToggleMute}
            disabled={isModerationMuted}
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl font-semibold transition-all shadow-lg cursor-pointer ${
              isModerationMuted
                ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30 cursor-not-allowed opacity-80'
                : isMuted
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                : isSpeaking
                ? 'bg-emerald-500 text-slate-950 border border-emerald-400 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : 'bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 hover:text-white'
            }`}
            title={
              isModerationMuted
                ? t('dock.micModerationMuted')
                : isMuted
                ? `${t('dock.micUnmute')} [M]`
                : `${t('dock.micMute')} [M]`
            }
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {!isMuted && isSpeaking && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            )}
            <span className="absolute -bottom-1.5 -right-1 px-1 py-0.2 bg-slate-900/90 text-slate-400 border border-white/10 rounded text-[9px] font-mono leading-none">
              M
            </span>
          </button>

          {/* Deafen Toggle */}
          <button
            onClick={onToggleDeafen}
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl font-semibold transition-all shadow-lg cursor-pointer ${
              isDeafened
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 hover:text-white'
            }`}
            title={isDeafened ? `${t('dock.undeafen')} [D]` : `${t('dock.deafen')} [D]`}
          >
            {isDeafened ? <VolumeX className="w-5 h-5 text-amber-400" /> : <Headphones className="w-5 h-5" />}
            <span className="absolute -bottom-1.5 -right-1 px-1 py-0.2 bg-slate-900/90 text-slate-400 border border-white/10 rounded text-[9px] font-mono leading-none">
              D
            </span>
          </button>

          {/* Dynamic Audio Waveform & AI Badge */}
          <div className="flex items-center gap-2">
            <AudioWaveform
              analyser={isMuted ? null : analyser}
              isSpeaking={!isMuted && isSpeaking}
            />
            {aiNoiseSuppression && (
              <span
                className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                  !isMuted && isSpeaking
                    ? 'bg-purple-500/25 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.35)]'
                    : 'bg-slate-900/60 text-slate-400 border-white/10'
                }`}
                title={`${aiNoiseSuppression ? t('dock.aiNoiseActive') : t('dock.aiNoiseFallback')}${speechProbability > 0 ? ` (${Math.round(speechProbability * 100)}%)` : ''}`}
              >
                <Sparkles className={`w-3 h-3 ${!isMuted && isSpeaking ? 'text-purple-300 animate-pulse' : 'text-purple-400'}`} />
                <span>IA</span>
              </span>
            )}
          </div>
        </div>

        {/* Center: Sliders */}
        <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto justify-center shrink-0">
          {/* Master Volume */}
          <div className="flex items-center gap-2" title={`${t('dock.masterVolume')}: ${Math.round(masterVolume * 100)}%`}>
            <Volume2 className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={masterVolume}
              onChange={(e) => onChangeMasterVolume(parseFloat(e.target.value))}
              className="w-20 accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* VAD Threshold */}
          <div
            className="flex items-center gap-2"
            title={`${t('dock.vadThreshold')}: ${Math.min(100, Math.round((vadThreshold / 0.15) * 100))}%`}
          >
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">VAD</span>
            <input
              type="range"
              min="0.005"
              max="0.15"
              step="0.005"
              value={vadThreshold}
              onChange={(e) => onChangeVadThreshold(parseFloat(e.target.value))}
              className="w-16 accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Right: Ping, Settings & Disconnect */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {pingMs !== null && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-semibold border ${
                pingMs < 70
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : pingMs < 150
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
              }`}
              title={t('settings.preferences.latencyMs', { ms: pingMs })}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>{pingMs}ms</span>
            </div>
          )}

          {/* Mobile Companion QR */}
          <button
            onClick={onOpenQrCompanion}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-white/10 hover:text-white transition-all cursor-pointer shadow-sm"
            title={t('dock.qrCompanion')}
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Document PiP Overlay (if supported) */}
          {isPipSupported && (
            <button
              onClick={onTogglePip}
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all cursor-pointer shadow-sm ${
                isPipActive
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                  : 'text-slate-300 bg-slate-800/80 hover:bg-slate-700 border-white/10 hover:text-white'
              }`}
              title={isPipActive ? t('dock.pipClose') : t('dock.pipOpen')}
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-white/10 hover:text-white transition-all cursor-pointer shadow-sm"
            title={t('dock.settings')}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer shadow-sm"
            title={t('dock.disconnect')}
          >
            <Power className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('common.close')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
