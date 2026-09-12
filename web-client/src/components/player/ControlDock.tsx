import { Mic, MicOff, Volume2, Power } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform.js';

interface ControlDockProps {
  isMuted: boolean;
  isSpeaking: boolean;
  masterVolume: number;
  vadThreshold: number;
  analyser: AnalyserNode | null;
  onToggleMute: () => void;
  onChangeMasterVolume: (vol: number) => void;
  onChangeVadThreshold: (threshold: number) => void;
  onDisconnect: () => void;
}

export function ControlDock({
  isMuted,
  isSpeaking,
  masterVolume,
  vadThreshold,
  analyser,
  onToggleMute,
  onChangeMasterVolume,
  onChangeVadThreshold,
  onDisconnect,
}: ControlDockProps) {
  return (
    <div className="fixed bottom-6 inset-x-0 mx-auto w-[92%] max-w-2xl z-40">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 sm:px-6 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl">
        {/* Left: Mic toggle & Waveform */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={onToggleMute}
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl font-semibold transition-all shadow-lg cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {!isMuted && isSpeaking && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          {/* Dynamic Audio Waveform */}
          <div className="flex items-center gap-2">
            <AudioWaveform
              analyser={isMuted ? null : analyser}
              isSpeaking={!isMuted && isSpeaking}
            />
          </div>
        </div>

        {/* Center: Sliders */}
        <div className="flex items-center gap-5 w-full sm:w-auto justify-center">
          {/* Master Volume */}
          <div className="flex items-center gap-2" title={`Master Volume: ${Math.round(masterVolume * 100)}%`}>
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

          {/* VAD Sensitivity */}
          <div className="flex items-center gap-2" title={`Mic Sensitivity: ${Math.round((1 - vadThreshold) * 100)}%`}>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Sens</span>
            <input
              type="range"
              min="0.01"
              max="0.15"
              step="0.005"
              value={vadThreshold}
              onChange={(e) => onChangeVadThreshold(parseFloat(e.target.value))}
              className="w-16 accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Right: Disconnect */}
        <div className="flex items-center gap-2">
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
            title="Disconnect Voice"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </div>
    </div>
  );
}
