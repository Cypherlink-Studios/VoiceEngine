import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, ShieldCheck, Radio, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SpatialAudioPipeline } from './audio/SpatialAudioPipeline.js';
import { VoiceActivityDetector } from './audio/VoiceActivityDetector.js';
import { VoiceSignaling } from './net/VoiceSignaling.js';
import { Radar, PeerRadarInfo } from './components/Radar.js';

export default function App() {
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [localPlayer, setLocalPlayer] = useState<{ uuid: string; username: string } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [vadThreshold, setVadThreshold] = useState(0.04);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [peers, setPeers] = useState<PeerRadarInfo[]>([]);

  const signalingRef = useRef<VoiceSignaling | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const pipelineRef = useRef<SpatialAudioPipeline | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Read token from URL query params (e.g. ?token=ABCD12)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('code');
    if (token) {
      setTokenInput(token.trim().toUpperCase());
    }
  }, []);

  const handleConnect = async () => {
    if (!tokenInput.trim()) {
      setErrorMsg('Please enter or provide a connection code.');
      return;
    }

    setErrorMsg(null);
    setIsConnecting(true);

    try {
      // 1. Request microphone permissions with noise suppression & echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Initialize Audio Pipeline & VAD
      const pipeline = new SpatialAudioPipeline();
      pipelineRef.current = pipeline;
      pipeline.setMasterVolume(masterVolume);

      const vad = new VoiceActivityDetector(
        stream,
        {
          onSpeakingChange: (speaking) => {
            setIsSpeaking(speaking);
            signalingRef.current?.notifySpeaking(speaking);
          },
          onVolumeChange: (vol) => {
            setMicVolume(vol);
          },
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
        onDisconnected: () => {
          handleDisconnect();
        },
      });

      signalingRef.current = signaling;
      await signaling.connect(stream);
    } catch (err: unknown) {
      console.error('[App] Connection failed:', err);
      const message = err instanceof Error ? err.message : 'Microphone access denied or connection failed.';
      setErrorMsg(message);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (signalingRef.current) {
      const sig = signalingRef.current;
      signalingRef.current = null;
      sig.disconnect();
    }

    if (vadRef.current) {
      const vad = vadRef.current;
      vadRef.current = null;
      vad.stop();
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (pipelineRef.current) {
      const pipe = pipelineRef.current;
      pipelineRef.current = null;
      pipe.close();
    }

    setIsConnected(false);
    setIsConnecting(false);
    setLocalPlayer(null);
    setPeers([]);
    setIsSpeaking(false);
    setMicVolume(0);
  };

  const handleThresholdChange = (val: number) => {
    setVadThreshold(val);
    vadRef.current?.setThreshold(val);
  };

  const handleVolumeChange = (val: number) => {
    setMasterVolume(val);
    pipelineRef.current?.setMasterVolume(val);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <header className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Zero-Mod Proximity Voice</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">VoiceEngine</h1>
        <p className="text-slate-400 text-sm mt-1">Spatial 3D Audio for Minecraft Servers</p>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Connection Error</p>
              <p className="text-xs text-rose-400/90 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {!isConnected ? (
          /* Pre-Connect Onboarding View */
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 mb-6 shadow-inner">
              <Mic className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-semibold text-white mb-1">Click & Connect</h2>
            <p className="text-slate-400 text-xs text-center mb-6 max-w-xs">
              Type <code className="text-amber-400 bg-slate-800 px-1 py-0.5 rounded">/voice</code> in-game or paste your 6-character code below to connect your microphone.
            </p>

            <div className="w-full space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Connection Code
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="e.g. 98B2A4"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting || !tokenInput.trim()}
                className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Connecting Voice...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Connect Voice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Active Voice Session & Radar View */
          <div className="flex flex-col items-center">
            {/* Player Info Card */}
            <div className="w-full flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <img
                  src={`https://mc-heads.net/avatar/${localPlayer?.uuid}/44`}
                  alt={localPlayer?.username}
                  className="w-11 h-11 rounded-xl border border-slate-700 bg-slate-800"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{localPlayer?.username}</span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Online
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    {isSpeaking ? (
                      <span className="text-emerald-400 font-medium animate-pulse">● Speaking</span>
                    ) : (
                      <span>Microphone Ready</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mic Level Visualizer */}
              <div className="flex flex-col items-end gap-1">
                <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      isSpeaking ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                    style={{ width: `${Math.min(100, micVolume * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-mono">VAD Level</span>
              </div>
            </div>

            {/* Proximity 3D Radar */}
            <div className="my-2">
              <Radar peers={peers} maxRange={30} localUsername={localPlayer?.username} />
            </div>

            {/* Audio Settings Controls */}
            <div className="w-full mt-6 space-y-4 pt-4 border-t border-slate-800">
              {/* VAD Sensitivity Slider */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    {isSpeaking ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
                    VAD Sensitivity
                  </span>
                  <span className="font-mono text-slate-400">{Math.round((1 - vadThreshold / 0.1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.10"
                  step="0.005"
                  value={vadThreshold}
                  onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Master Volume Slider */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                    Spatial Audio Volume
                  </span>
                  <span className="font-mono text-slate-400">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={masterVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Disconnect Button */}
              <button
                onClick={handleDisconnect}
                className="w-full mt-2 py-2.5 px-4 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Disconnect Voice
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Notes */}
      <footer className="mt-8 text-center text-xs text-slate-500 font-mono">
        Keep this tab open or minimized while playing Minecraft.
      </footer>
    </div>
  );
}
