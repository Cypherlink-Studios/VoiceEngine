import { useState } from 'react';
import { Sliders, Save, Check } from 'lucide-react';

export interface VoiceBackendSettings {
  maxSlots: number;
  maxVoiceDistance: number;
  sneakVoiceDistance: number;
  defaultBitrate: number;
}

interface BackendTabProps {
  voiceSettings: VoiceBackendSettings;
  onSave: (updated: VoiceBackendSettings) => Promise<void>;
}

export function BackendTab({ voiceSettings, onSave }: BackendTabProps) {
  const [form, setForm] = useState<VoiceBackendSettings>({ ...voiceSettings });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave(form);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-3xl bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <span>SFU & Proximity Audio Runtime Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Settings take effect immediately without requiring a voice server restart.
          </p>
        </div>
        {savedSuccess && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fade-in">
            <Check className="w-4 h-4" /> Runtime settings updated!
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Max Slots */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5">
          <label className="block text-xs font-semibold text-white mb-1">
            Max Voice Slots
          </label>
          <p className="text-[11px] text-slate-400 mb-3">
            Maximum number of concurrent WebRTC voice clients allowed.
          </p>
          <input
            type="number"
            min="1"
            max="1000"
            value={form.maxSlots}
            onChange={(e) => setForm({ ...form, maxSlots: parseInt(e.target.value, 10) || 1 })}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-sm"
            required
          />
        </div>

        {/* Default Bitrate */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5">
          <label className="block text-xs font-semibold text-white mb-1">
            Opus Bitrate (bps)
          </label>
          <p className="text-[11px] text-slate-400 mb-3">
            Target audio bandwidth (e.g. 64000 = 64 kbps).
          </p>
          <select
            value={form.defaultBitrate}
            onChange={(e) => setForm({ ...form, defaultBitrate: parseInt(e.target.value, 10) })}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-sm"
          >
            <option value="32000">32 kbps (Low bandwidth)</option>
            <option value="64000">64 kbps (Balanced - Default)</option>
            <option value="96000">96 kbps (High Fidelity)</option>
            <option value="128000">128 kbps (Ultra Studio)</option>
          </select>
        </div>

        {/* Max Proximity Distance */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5">
          <label className="block text-xs font-semibold text-white mb-1">
            Max Normal Voice Distance (Blocks)
          </label>
          <p className="text-[11px] text-slate-400 mb-3">
            Audible radius for standing or walking players.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={form.maxVoiceDistance}
              onChange={(e) => setForm({ ...form, maxVoiceDistance: parseFloat(e.target.value) })}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-xs font-mono font-bold text-indigo-400 w-12 text-right">
              {form.maxVoiceDistance}m
            </span>
          </div>
        </div>

        {/* Sneak Voice Distance */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5">
          <label className="block text-xs font-semibold text-white mb-1">
            Sneak Whisper Distance (Blocks)
          </label>
          <p className="text-[11px] text-slate-400 mb-3">
            Audible radius when player is sneaking (Shift).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={form.sneakVoiceDistance}
              onChange={(e) => setForm({ ...form, sneakVoiceDistance: parseFloat(e.target.value) })}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs font-mono font-bold text-emerald-400 w-12 text-right">
              {form.sneakVoiceDistance}m
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="py-2.5 px-6 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Applying...' : 'Apply Runtime Settings'}</span>
        </button>
      </div>
    </form>
  );
}
