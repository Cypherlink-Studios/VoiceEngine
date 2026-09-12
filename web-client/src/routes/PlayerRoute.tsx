import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Headphones, Sparkles, Radio } from 'lucide-react';
import { SpatialAudioPipeline } from '../audio/SpatialAudioPipeline.js';
import { VoiceActivityDetector } from '../audio/VoiceActivityDetector.js';
import { VoiceSignaling, ChannelMember } from '../net/VoiceSignaling.js';
import { Radar, PeerRadarInfo } from '../components/Radar.js';
import { ControlDock } from '../components/player/ControlDock.js';
import { ChannelDrawer } from '../components/player/ChannelDrawer.js';
import { useBrand } from '../components/layout/BrandProvider.js';

export function PlayerRoute() {
  const [searchParams] = useSearchParams();
  const { config } = useBrand();

  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [localPlayer, setLocalPlayer] = useState<{ uuid: string; username: string } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [vadThreshold, setVadThreshold] = useState(0.04);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [peers, setPeers] = useState<PeerRadarInfo[]>([]);

  const [activeChannel, setActiveChannel] = useState<string>('proximity');
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const signalingRef = useRef<VoiceSignaling | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const pipelineRef = useRef<SpatialAudioPipeline | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('code');
    if (token) {
      setTokenInput(token.trim().toUpperCase());
    }
  }, [searchParams]);

  const handleConnect = async () => {
    if (!tokenInput.trim()) {
      setErrorMsg('Please enter or click your /voice connection link in Minecraft.');
      return;
    }

    setErrorMsg(null);
    setIsConnecting(true);

    try {
      // 1. Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Initialize Audio Pipeline, Analyser, & VAD
      const pipeline = new SpatialAudioPipeline();
      pipelineRef.current = pipeline;
      pipeline.setMasterVolume(masterVolume);

      const localAnalyser = pipeline.createLocalAnalyser(stream);
      setAnalyser(localAnalyser);

      const vad = new VoiceActivityDetector(
        stream,
        {
          onSpeakingChange: (speaking) => {
            setIsSpeaking(speaking);
            signalingRef.current?.notifySpeaking(speaking);
          },
          onVolumeChange: () => {},
        },
        vadThreshold
      );
      vadRef.current = vad;

      // 3. Connect to Voice Server WebSocket signaling
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const defaultHost = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
      const wsUrl = `${wsProtocol}//${defaultHost}/ws/client`;

      const signaling = new VoiceSignaling(wsUrl, tokenInput.trim().toUpperCase(), pipeline, {
        onAuthenticated: (player) => {
          setLocalPlayer(player);
          setIsConnected(true);
          setIsConnecting(false);
        },
        onError: (err) => {
          setErrorMsg(err);
          handleDisconnect();
        },
        onPeersUpdated: (updatedPeers) => {
          setPeers(updatedPeers);
        },
        onChannelChanged: (channelId) => {
          setActiveChannel(channelId);
        },
        onChannelMembersUpdated: (channelId, members) => {
          if (activeChannel === channelId || channelId !== 'proximity') {
            setChannelMembers(members);
          }
        },
        onChannelPeerSpeaking: (_channelId, peerUuid, speaking) => {
          setChannelMembers((prev) =>
            prev.map((m) => (m.uuid === peerUuid ? { ...m, isSpeaking: speaking } : m))
          );
        },
        onDisconnected: () => {
          handleDisconnect();
        },
      });

      signalingRef.current = signaling;
      await signaling.connect(stream);
    } catch (err: unknown) {
      console.error('[PlayerRoute] Connection failed:', err);
      const message = err instanceof Error ? err.message : 'Microphone access denied or connection failed.';
      setErrorMsg(message);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    signalingRef.current?.disconnect();
    signalingRef.current = null;

    vadRef.current?.stop();
    vadRef.current = null;

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    pipelineRef.current?.close();
    pipelineRef.current = null;

    setAnalyser(null);
    setIsConnected(false);
    setIsConnecting(false);
    setLocalPlayer(null);
    setPeers([]);
    setChannelMembers([]);
    setActiveChannel('proximity');
  };

  const handleToggleMute = () => {
    if (!micStreamRef.current) return;
    const nextMuted = !isMuted;
    micStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
    if (nextMuted) {
      setIsSpeaking(false);
      signalingRef.current?.notifySpeaking(false);
    }
  };

  const handleChangeMasterVolume = (vol: number) => {
    setMasterVolume(vol);
    pipelineRef.current?.setMasterVolume(vol);
  };

  const handleChangeVadThreshold = (thresh: number) => {
    setVadThreshold(thresh);
    vadRef.current?.setThreshold(thresh);
  };

  const handleSelectChannel = (channelId: string) => {
    if (channelId === activeChannel) return;
    setActiveChannel(channelId);
    signalingRef.current?.joinChannel(channelId);
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center select-none overflow-x-hidden">
      {/* Dynamic Background Glows */}
      <div
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: config.branding.backgroundUrl ? `url(${config.branding.backgroundUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] pointer-events-none rounded-full blur-[140px] opacity-20"
        style={{ backgroundColor: 'var(--brand-primary, #6366f1)' }}
      />

      {/* Top Navbar */}
      <header className="relative z-20 w-full max-w-6xl px-6 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {config.branding.logoUrl ? (
            <img
              src={config.branding.logoUrl}
              alt={config.branding.serverName}
              className="w-9 h-9 rounded-lg object-contain shadow-md"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black shadow-lg"
              style={{ backgroundColor: 'var(--brand-primary, #6366f1)' }}
            >
              <Headphones className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
              <span>{config.branding.serverName}</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-white/10 text-slate-300">
                Voice
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">{config.branding.tagline}</p>
          </div>
        </div>

        {/* User Identity / Status */}
        {isConnected && localPlayer ? (
          <div className="flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/10 shadow-md">
            <img
              src={`https://mc-heads.net/avatar/${localPlayer.uuid}/24`}
              alt={localPlayer.username}
              className="w-6 h-6 rounded border border-white/20"
            />
            <div className="text-left">
              <div className="text-xs font-semibold text-white leading-tight">{localPlayer.username}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Zero-Mod Proximity Audio</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-5xl px-4 flex-1 flex flex-col items-center justify-center py-8">
        {errorMsg && (
          <div className="mb-6 w-full max-w-md p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shadow-lg animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!isConnected ? (
          /* Connect / Welcome Card */
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col items-center text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl mb-4"
              style={{ backgroundColor: 'var(--brand-primary, #6366f1)' }}
            >
              <Radio className="w-8 h-8 animate-pulse" />
            </div>

            <h2 className="text-xl font-bold text-white mb-1">
              Join Proximity Voice
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {config.branding.welcomeMessage ||
                'Type /voice in the Minecraft chat to get your direct connect link.'}
            </p>

            <div className="w-full flex flex-col gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="CODE (e.g. STEVE1)"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-center text-sm font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all uppercase"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full py-3.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--brand-primary, #6366f1)',
                  boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                }}
              >
                {isConnecting ? (
                  <span>Connecting microphone...</span>
                ) : (
                  <>
                    <Headphones className="w-4 h-4" />
                    <span>Connect Voice</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Binaural 3D Spatial Audio • Vanilla Minecraft Compatible</span>
            </div>
          </div>
        ) : (
          /* Connected Live Voice HUD */
          <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 mb-24">
            {/* Left: 3D Radar or Channel Display */}
            <div className="flex flex-col items-center gap-4">
              <Radar
                peers={activeChannel === 'proximity' ? peers : []}
                maxRange={config.voice ? config.voice.maxVoiceDistance : 30}
                localUsername={localPlayer?.username}
                localUuid={localPlayer?.uuid}
              />
            </div>

            {/* Right: Channels & Participants */}
            <div className="w-full max-w-md flex flex-col items-center">
              <ChannelDrawer
                activeChannel={activeChannel}
                fixedChannels={config.fixedChannels}
                channelMembers={channelMembers}
                proximityPeersCount={peers.length}
                onSelectChannel={handleSelectChannel}
              />
            </div>
          </div>
        )}
      </main>

      {/* Floating Control Dock (When Connected) */}
      {isConnected && (
        <ControlDock
          isMuted={isMuted}
          isSpeaking={isSpeaking}
          masterVolume={masterVolume}
          vadThreshold={vadThreshold}
          analyser={analyser}
          onToggleMute={handleToggleMute}
          onChangeMasterVolume={handleChangeMasterVolume}
          onChangeVadThreshold={handleChangeVadThreshold}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
}
