import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Settings,
  Headphones,
  VolumeX,
  PictureInPicture2,
  QrCode,
  Sparkles,
  MoreHorizontal,
  Power,
  Activity,
} from 'lucide-react';
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
  onToggleAiNoiseSuppression?: (enabled: boolean) => void;
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
  onToggleAiNoiseSuppression,
  onOpenSettings,
  onDisconnect,
}: ControlDockProps) {
  const { t } = useTranslation();
  const [isAudioPopoverOpen, setIsAudioPopoverOpen] = useState(false);
  const [isActionsPopoverOpen, setIsActionsPopoverOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on click outside or on Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsAudioPopoverOpen(false);
        setIsActionsPopoverOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAudioPopoverOpen(false);
        setIsActionsPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[95vw] z-40 select-none">
      
      {/* Quick Audio Popover */}
      {isAudioPopoverOpen && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-72 p-4 rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.12)] flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-xs font-semibold text-white tracking-wide">
              {t('dock.quickAudio')}
            </span>
            {aiNoiseSuppression && (
              <span
                className="flex items-center gap-1 text-[10px] font-mono text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30"
                title={speechProbability > 0 ? t('dock.aiVoiceProbability', { percent: Math.round(speechProbability * 100) }) : undefined}
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>RNNoise {speechProbability > 0 ? `${Math.round(speechProbability * 100)}%` : t('dock.aiBadge')}</span>
              </span>
            )}
          </div>

          {/* Master Volume */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('dock.masterVolume')}</span>
              </span>
              <span className="font-mono text-slate-400 text-[11px]">
                {Math.round(masterVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={masterVolume}
              onChange={(e) => onChangeMasterVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* VAD Threshold */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('dock.vadThreshold')}</span>
              </span>
              <span className="font-mono text-emerald-400 text-[11px]">
                {Math.min(100, Math.round((vadThreshold / 0.15) * 100))}%
              </span>
            </div>
            <input
              type="range"
              min="0.005"
              max="0.15"
              step="0.005"
              value={vadThreshold}
              onChange={(e) => onChangeVadThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* AI Noise Toggle (if provided) */}
          {onToggleAiNoiseSuppression && (
            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer pt-2 border-t border-white/5">
              <span>{t('settings.devices.aiNoiseTitle')}</span>
              <input
                type="checkbox"
                checked={aiNoiseSuppression}
                onChange={(e) => onToggleAiNoiseSuppression(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-white/10 accent-indigo-500 cursor-pointer"
              />
            </label>
          )}
        </div>
      )}

      {/* Quick Actions Menu Popover */}
      {isActionsPopoverOpen && (
        <div className="absolute bottom-16 right-0 w-52 p-2 rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.12)] flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95 duration-150">
          
          {/* Latency row */}
          {pingMs !== null && (
            <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-white/5 pb-1.5 mb-0.5">
              <span>Ping</span>
              <span
                className={`font-semibold ${
                  pingMs < 70
                    ? 'text-emerald-400'
                    : pingMs < 150
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {pingMs}ms
              </span>
            </div>
          )}

          {/* Picture-in-Picture */}
          {isPipSupported && (
            <button
              onClick={() => {
                onTogglePip();
                setIsActionsPopoverOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl text-left text-slate-200 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <PictureInPicture2 className={`w-4 h-4 ${isPipActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{isPipActive ? t('dock.pipClose') : t('dock.pipOpen')}</span>
            </button>
          )}

          {/* QR Companion */}
          <button
            onClick={() => {
              onOpenQrCompanion();
              setIsActionsPopoverOpen(false);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-slate-200 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>{t('dock.qrCompanion')}</span>
          </button>

          {/* Full Settings */}
          <button
            onClick={() => {
              onOpenSettings();
              setIsActionsPopoverOpen(false);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-slate-200 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>{t('dock.settings')}</span>
          </button>

          <div className="h-px bg-white/5 my-0.5" />

          {/* Disconnect */}
          <button
            onClick={() => {
              onDisconnect();
              setIsActionsPopoverOpen(false);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-rose-300 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Power className="w-4 h-4 text-rose-400" />
            <span>{t('dock.disconnect')}</span>
          </button>
        </div>
      )}

      {/* Floating Dynamic Glass Capsule */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-full bg-slate-950/75 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.12)]">
        
        {/* Smart Mic Button */}
        <button
          onClick={onToggleMute}
          disabled={isModerationMuted}
          className={`relative flex items-center justify-center w-11 h-11 rounded-full font-semibold transition-all cursor-pointer shadow-md ${
            isModerationMuted
              ? 'bg-rose-950/40 text-rose-400 border border-rose-500/30 cursor-not-allowed opacity-80'
              : isMuted
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
              : !isMuted && isSpeaking
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400 ring-2 ring-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
              : 'bg-white/10 text-white border border-white/10 hover:bg-white/15'
          }`}
          title={
            isModerationMuted
              ? t('dock.micModerationMuted')
              : isMuted
              ? `${t('dock.micUnmute')} [M]`
              : `${t('dock.micMute')} [M]`
          }
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          
          {/* Subtle Keycap badge */}
          <span className="absolute -bottom-1 -right-0.5 px-1 py-0.2 bg-slate-950/90 text-slate-400 border border-white/10 rounded-full text-[8px] font-mono leading-none">
            M
          </span>
        </button>

        {/* Deafen Button */}
        <button
          onClick={onToggleDeafen}
          className={`relative flex items-center justify-center w-11 h-11 rounded-full font-semibold transition-all cursor-pointer shadow-md ${
            isDeafened
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
              : 'bg-white/10 text-white border border-white/10 hover:bg-white/15'
          }`}
          title={isDeafened ? `${t('dock.undeafen')} [D]` : `${t('dock.deafen')} [D]`}
        >
          {isDeafened ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Headphones className="w-4 h-4" />}
          
          {/* Subtle Keycap badge */}
          <span className="absolute -bottom-1 -right-0.5 px-1 py-0.2 bg-slate-950/90 text-slate-400 border border-white/10 rounded-full text-[8px] font-mono leading-none">
            D
          </span>
        </button>

        {/* 4-Bar Siri Voice Equalizer */}
        <div className="flex items-center px-1">
          <AudioWaveform
            analyser={isMuted ? null : analyser}
            isSpeaking={!isMuted && isSpeaking}
          />
        </div>

        {/* Subtle Glass Divider */}
        <div className="w-px h-5 bg-white/10 mx-0.5" />

        {/* Volume Popover Trigger */}
        <button
          onClick={() => {
            setIsAudioPopoverOpen((prev) => !prev);
            setIsActionsPopoverOpen(false);
          }}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer ${
            isAudioPopoverOpen
              ? 'bg-white/20 text-white'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title={`${t('dock.masterVolume')}: ${Math.round(masterVolume * 100)}%`}
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* More Actions Popover Trigger */}
        <button
          onClick={() => {
            setIsActionsPopoverOpen((prev) => !prev);
            setIsAudioPopoverOpen(false);
          }}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer ${
            isActionsPopoverOpen
              ? 'bg-white/20 text-white'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title={t('dock.settings')}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}
