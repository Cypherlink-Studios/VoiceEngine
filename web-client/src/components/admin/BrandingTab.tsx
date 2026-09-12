import { useState } from 'react';
import { Palette, Check, Save, Sparkles } from 'lucide-react';
import { PublicBranding } from '../layout/BrandProvider.js';

interface BrandingTabProps {
  branding: PublicBranding;
  onSave: (updated: PublicBranding) => Promise<void>;
}

const PRESET_COLORS = [
  { name: 'Emerald', primary: '#059669', accent: '#10b981' },
  { name: 'Amethyst', primary: '#7c3aed', accent: '#a855f7' },
  { name: 'Redstone', primary: '#dc2626', accent: '#ef4444' },
  { name: 'Cyber Neon', primary: '#6366f1', accent: '#22c55e' },
  { name: 'Ocean Blue', primary: '#2563eb', accent: '#38bdf8' },
  { name: 'Golden Glow', primary: '#d97706', accent: '#fbbf24' },
];

export function BrandingTab({ branding, onSave }: BrandingTabProps) {
  const [form, setForm] = useState<PublicBranding>({ ...branding });
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
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8 w-full">
      {/* Left: Configuration Inputs */}
      <div className="flex-1 flex flex-col gap-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Palette className="w-5 h-5 text-indigo-400" />
            <span>Visual Branding & Theme</span>
          </div>
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fade-in">
              <Check className="w-4 h-4" /> Changes saved!
            </span>
          )}
        </div>

        {/* Server Name & Tagline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Server Name
            </label>
            <input
              type="text"
              value={form.serverName}
              onChange={(e) => setForm({ ...form, serverName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="e.g. MyServer Network"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tagline
            </label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Proximity Voice Chat"
            />
          </div>
        </div>

        {/* Logo & Background URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Logo Image URL
            </label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="https://myserver.com/logo.png"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Background Wallpaper URL
            </label>
            <input
              type="url"
              value={form.backgroundUrl}
              onChange={(e) => setForm({ ...form, backgroundUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="https://myserver.com/wallpaper.jpg"
            />
          </div>
        </div>

        {/* Color Customizer */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Preset Color Palettes
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {PRESET_COLORS.map((preset) => (
              <button
                type="button"
                key={preset.name}
                onClick={() =>
                  setForm({
                    ...form,
                    primaryColor: preset.primary,
                    accentColor: preset.accent,
                  })
                }
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-white/5 hover:border-white/20 transition-all text-left cursor-pointer"
              >
                <div className="flex -space-x-1">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: preset.accent }}
                  />
                </div>
                <span className="text-xs text-slate-300 font-medium">{preset.name}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Primary Color (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs font-mono"
                  pattern="^#[0-9a-fA-F]{6}$"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Accent Glow Color (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={form.accentColor}
                  onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs font-mono"
                  pattern="^#[0-9a-fA-F]{6}$"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Player Welcome & Instructions
          </label>
          <textarea
            rows={2}
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
            placeholder="Shown on the player onboarding card"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="mt-2 py-3 px-6 rounded-xl font-semibold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: form.primaryColor }}
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Changes...' : 'Save Branding'}</span>
        </button>
      </div>

      {/* Right: Interactive Live Preview Mockup */}
      <div className="w-full lg:w-96 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Live Player Preview</span>
        </div>

        <div className="p-6 rounded-3xl bg-slate-950 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
          {/* Simulated Background Glow */}
          <div
            className="absolute -top-10 inset-x-0 h-28 blur-3xl opacity-30 pointer-events-none"
            style={{ backgroundColor: form.primaryColor }}
          />

          {/* Logo / Icon */}
          {form.logoUrl ? (
            <img
              src={form.logoUrl}
              alt="Preview"
              className="w-12 h-12 rounded-xl object-contain mb-3 shadow-md"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black mb-3 shadow-lg"
              style={{ backgroundColor: form.primaryColor }}
            >
              VE
            </div>
          )}

          <h3 className="font-bold text-white text-sm">{form.serverName || 'Server Name'}</h3>
          <p className="text-[10px] text-slate-400 mb-4">{form.tagline || 'Proximity Voice'}</p>

          <p className="text-[11px] text-slate-300 mb-4 line-clamp-2 px-2">
            {form.welcomeMessage || 'Welcome message preview...'}
          </p>

          <div
            className="w-full py-2.5 rounded-xl font-semibold text-xs text-white shadow-md flex items-center justify-center gap-2 pointer-events-none"
            style={{ backgroundColor: form.primaryColor }}
          >
            <span>Connect Voice</span>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: form.accentColor }}
            />
            <span>Accent Glow Preview</span>
          </div>
        </div>
      </div>
    </form>
  );
}
