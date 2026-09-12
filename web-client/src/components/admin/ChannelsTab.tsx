import { useState } from 'react';
import { Volume2, Plus, Trash2, Shield, Save, Check } from 'lucide-react';
import { PublicFixedChannel } from '../layout/BrandProvider.js';

interface ChannelsTabProps {
  channels: PublicFixedChannel[];
  onSave: (updated: PublicFixedChannel[]) => Promise<void>;
}

export function ChannelsTab({ channels, onSave }: ChannelsTabProps) {
  const [list, setList] = useState<PublicFixedChannel[]>([...channels]);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLimit, setNewLimit] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newName.trim()) return;

    const slug = newId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (list.some((c) => c.id === slug)) {
      alert('A channel with this ID already exists.');
      return;
    }

    const added: PublicFixedChannel = {
      id: slug,
      name: newName.trim(),
      description: newDesc.trim(),
      userLimit: Math.max(0, newLimit),
      isDefault: false,
    };

    setList([...list, added]);
    setNewId('');
    setNewName('');
    setNewDesc('');
    setNewLimit(0);
  };

  const handleRemoveChannel = (id: string) => {
    setList(list.filter((c) => c.id !== id));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave(list);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-indigo-400" />
            <span>Fixed Voice Channels (Discord-Style)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Rooms where players communicate in stereo regardless of their Minecraft world or coordinates.
          </p>
        </div>
        {savedSuccess && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fade-in">
            <Check className="w-4 h-4" /> Channels saved!
          </span>
        )}
      </div>

      {/* Existing Channels List */}
      <div className="flex flex-col gap-3">
        {list.map((ch) => (
          <div
            key={ch.id}
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-white/5 shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                {ch.id.toLowerCase().includes('staff') ? (
                  <Shield className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>{ch.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">#{ch.id}</span>
                  {ch.userLimit > 0 && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                      Limit: {ch.userLimit}
                    </span>
                  )}
                </div>
                {ch.description && (
                  <div className="text-xs text-slate-400">{ch.description}</div>
                )}
              </div>
            </div>

            <button
              onClick={() => handleRemoveChannel(ch.id)}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              title="Delete channel"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {list.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-white/10">
            No fixed channels defined. Players will only have the default Proximity (3D) voice mode.
          </div>
        )}
      </div>

      {/* Add New Channel Form */}
      <form onSubmit={handleAddChannel} className="mt-2 p-4 rounded-xl bg-slate-950/50 border border-white/10 flex flex-col gap-3">
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add New Channel</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">ID (Slug)</label>
            <input
              type="text"
              placeholder="e.g. event-room"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Display Name</label>
            <input
              type="text"
              placeholder="e.g. Event Hall"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Public announcements"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">User Limit (0=∞)</label>
            <input
              type="number"
              min="0"
              max="500"
              value={newLimit}
              onChange={(e) => setNewLimit(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all cursor-pointer"
          >
            Add to List
          </button>
        </div>
      </form>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="py-2.5 px-6 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Channels...' : 'Save Channels'}</span>
        </button>
      </div>
    </div>
  );
}
