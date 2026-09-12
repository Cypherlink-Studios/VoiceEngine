import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, LogOut, Palette, Volume2, Sliders, Activity, Headphones, ArrowLeft } from 'lucide-react';
import { useBrand, PublicBranding, PublicFixedChannel } from '../components/layout/BrandProvider.js';
import { BrandingTab } from '../components/admin/BrandingTab.js';
import { ChannelsTab } from '../components/admin/ChannelsTab.js';
import { BackendTab, VoiceBackendSettings } from '../components/admin/BackendTab.js';
import { LiveMonitorTab } from '../components/admin/LiveMonitorTab.js';

interface AdminSessionState {
  sessionToken: string;
  username: string;
  playerUuid: string;
}

export function AdminRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshConfig } = useBrand();

  const [session, setSession] = useState<AdminSessionState | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [manualToken, setManualToken] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'branding' | 'channels' | 'backend' | 'monitor'>('branding');
  const [settings, setSettings] = useState<{
    branding: PublicBranding;
    voice: VoiceBackendSettings;
    fixedChannels: PublicFixedChannel[];
  } | null>(null);

  // Authenticate with token
  const authenticate = async (token: string) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim().toUpperCase() }),
      });

      if (res.ok) {
        const data = await res.json();
        const sessionData: AdminSessionState = {
          sessionToken: data.sessionToken,
          username: data.username,
          playerUuid: data.playerUuid,
        };
        sessionStorage.setItem('ve_admin_session', JSON.stringify(sessionData));
        setSession(sessionData);
        await loadSettings(data.sessionToken);
      } else {
        const err = await res.json();
        setAuthError(err.message || 'Invalid or expired administrative token.');
      }
    } catch {
      setAuthError('Connection error while authenticating.');
    } finally {
      setAuthChecking(false);
    }
  };

  const loadSettings = async (token: string) => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    const stored = sessionStorage.getItem('ve_admin_session');

    if (tokenFromUrl) {
      authenticate(tokenFromUrl);
    } else if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession(parsed);
        loadSettings(parsed.sessionToken).then(() => setAuthChecking(false));
      } catch {
        sessionStorage.removeItem('ve_admin_session');
        setAuthChecking(false);
      }
    } else {
      setAuthChecking(false);
    }
  }, [searchParams]);

  const handleLogout = () => {
    sessionStorage.removeItem('ve_admin_session');
    setSession(null);
    setSettings(null);
  };

  const handleSaveBranding = async (newBranding: PublicBranding) => {
    if (!session) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ branding: newBranding }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      await refreshConfig();
    }
  };

  const handleSaveChannels = async (newChannels: PublicFixedChannel[]) => {
    if (!session) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ fixedChannels: newChannels }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      await refreshConfig();
    }
  };

  const handleSaveBackend = async (newVoice: VoiceBackendSettings) => {
    if (!session) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ voice: newVoice }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      await refreshConfig();
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-xs text-slate-400">Verifying administrative access...</div>
      </div>
    );
  }

  // If unauthorized: Access-Locked Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            Admin Portal Protected
          </h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Administrative access requires permission verified by your Minecraft Paper server.
          </p>

          {authError && (
            <div className="mb-4 w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {authError}
            </div>
          )}

          {/* In-Game Instruction Box */}
          <div className="w-full p-4 rounded-xl bg-slate-950 border border-white/5 text-left mb-6">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              How to access:
            </div>
            <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5">
              <li>Log in to the Minecraft server as an Operator or Admin.</li>
              <li>Type <span className="font-mono text-amber-400 font-bold">/voice admin</span> in chat.</li>
              <li>Click the generated secure link in chat to open this panel.</li>
            </ol>
          </div>

          {/* Manual Token Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualToken) authenticate(manualToken);
            }}
            className="w-full flex gap-2"
          >
            <input
              type="text"
              placeholder="PASTE ADMIN CODE"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-center tracking-widest text-white uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Verify
            </button>
          </form>

          <button
            onClick={() => navigate('/')}
            className="mt-6 text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Voice Client</span>
          </button>
        </div>
      </div>
    );
  }

  // Authorized Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      {/* Admin Navbar */}
      <header className="w-full max-w-6xl px-6 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white flex items-center gap-2">
              <span>VoiceEngine Admin Portal</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Staff
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Manage branding, audio channels, and live server state</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <img
              src={`https://mc-heads.net/avatar/${session.playerUuid}/22`}
              alt={session.username}
              className="w-5 h-5 rounded border border-white/10"
            />
            <span className="font-semibold text-white">{session.username}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer"
            title="Log out of admin session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="w-full max-w-6xl px-6 pt-6 flex items-center gap-2 border-b border-white/5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'branding'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Branding & Visuals</span>
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'channels'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Voice Channels</span>
        </button>

        <button
          onClick={() => setActiveTab('backend')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'backend'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Backend Tuning</span>
        </button>

        <button
          onClick={() => setActiveTab('monitor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'monitor'
              ? 'border-indigo-500 text-white bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Monitor</span>
        </button>
      </nav>

      {/* Main Tab Panels */}
      <main className="w-full max-w-6xl px-6 py-8 flex-1 flex flex-col items-center">
        {settings && activeTab === 'branding' && (
          <BrandingTab branding={settings.branding} onSave={handleSaveBranding} />
        )}

        {settings && activeTab === 'channels' && (
          <ChannelsTab channels={settings.fixedChannels} onSave={handleSaveChannels} />
        )}

        {settings && activeTab === 'backend' && (
          <BackendTab voiceSettings={settings.voice} onSave={handleSaveBackend} />
        )}

        {activeTab === 'monitor' && (
          <LiveMonitorTab sessionToken={session.sessionToken} />
        )}
      </main>
    </div>
  );
}
