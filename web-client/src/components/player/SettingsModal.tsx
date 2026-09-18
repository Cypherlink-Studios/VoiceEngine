import React, { useState, useEffect, useRef } from 'react';
import { Settings, Mic, Headphones, Users, Volume2, Activity, Sliders, X, Check, Eye, EyeOff, Radio, Music, Sparkles } from 'lucide-react';
import { soundEffects } from '../../audio/SoundEffects.js';
import { ChannelMember } from '../../net/VoiceSignaling.js';
import { PeerRadarInfo } from '../Radar.js';
import { useTranslation, LanguageSelector } from '../../i18n/index.js';

export interface AudioConstraintsConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInputId: string;
  selectedOutputId: string;
  onSelectInputDevice: (deviceId: string) => void;
  onSelectOutputDevice: (deviceId: string) => void;
  audioConstraints: AudioConstraintsConfig;
  onUpdateConstraints: (constraints: AudioConstraintsConfig) => void;
  analyserNode: AnalyserNode | null;
  vadThreshold: number;
  onChangeVadThreshold?: (threshold: number) => void;
  isLoopbackActive: boolean;
  onToggleLoopback: () => void;
  streamerMode: boolean;
  onToggleStreamerMode: (enabled: boolean) => void;
  // Player volumes
  peers: PeerRadarInfo[];
  channelMembers: ChannelMember[];
  peerVolumes: Record<string, number>;
  peerMuted: Record<string, boolean>;
  onSetPeerVolume: (uuid: string, volume: number) => void;
  onSetPeerMuted: (uuid: string, muted: boolean) => void;
  onResetAllVolumes: () => void;
  // Sound FX & Ping
  sfxEnabled: boolean;
  sfxVolume: number;
  onToggleSfx: (enabled: boolean) => void;
  onSetSfxVolume: (volume: number) => void;
  pingMs: number | null;
  // Media & Music
  mediaVolume?: number;
  onSetMediaVolume?: (volume: number) => void;
  mediaMuted?: boolean;
  onToggleMediaMuted?: (muted: boolean) => void;
  // AI DSP & Input Controls
  aiNoiseSuppression?: boolean;
  onToggleAiNoiseSuppression?: (enabled: boolean) => void;
  inputGain?: number;
  onChangeInputGain?: (gain: number) => void;
  vadSensitivity?: number;
  onChangeVadSensitivity?: (sensitivity: number) => void;
  speechProbability?: number;
  isFallbackMode?: boolean;
}

type TabType = 'devices' | 'players' | 'preferences';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  selectedInputId,
  selectedOutputId,
  onSelectInputDevice,
  onSelectOutputDevice,
  audioConstraints,
  onUpdateConstraints,
  analyserNode,
  vadThreshold,
  onChangeVadThreshold,
  isLoopbackActive,
  onToggleLoopback,
  streamerMode,
  onToggleStreamerMode,
  peers,
  channelMembers,
  peerVolumes,
  peerMuted,
  onSetPeerVolume,
  onSetPeerMuted,
  onResetAllVolumes,
  sfxEnabled,
  sfxVolume,
  onToggleSfx,
  onSetSfxVolume,
  pingMs,
  mediaVolume = 1.0,
  onSetMediaVolume,
  mediaMuted = false,
  onToggleMediaMuted,
  aiNoiseSuppression = true,
  onToggleAiNoiseSuppression,
  inputGain = 1.0,
  onChangeInputGain,
  vadSensitivity = 0.5,
  onChangeVadSensitivity,
  speechProbability = 0,
  isFallbackMode = false,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('devices');
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [playerFilter, setPlayerFilter] = useState<string>('');
  const [testSoundPlaying, setTestSoundPlaying] = useState<boolean>(false);

  const animFrameRef = useRef<number | null>(null);

  // Enumerate hardware devices
  useEffect(() => {
    if (!isOpen) return;

    const loadDevices = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        setInputDevices(devices.filter((d) => d.kind === 'audioinput'));
        setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
      } catch (err) {
        console.warn('[SettingsModal] Failed to enumerate audio devices:', err);
      }
    };

    loadDevices();
    navigator.mediaDevices?.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadDevices);
    };
  }, [isOpen]);

  // Live microphone VU level meter
  useEffect(() => {
    if (!isOpen || !analyserNode || activeTab !== 'devices') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const dataArray = new Float32Array(analyserNode.fftSize || 512);
    const updateLevel = () => {
      analyserNode.getFloatTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      // Normalized to 0-100% based on max expected RMS of ~0.15
      const normalized = Math.min(100, Math.round((rms / 0.15) * 100));
      setMicLevel(normalized);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };

    animFrameRef.current = requestAnimationFrame(updateLevel);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, analyserNode, activeTab]);

  const sensitivityPercent = Math.round((vadSensitivity ?? (1.0 - (vadThreshold / 0.15))) * 100);
  const aiProbPercent = Math.round((speechProbability ?? 0) * 100);
  const isSpeechActive = aiNoiseSuppression
    ? (speechProbability ?? 0) >= (0.80 - (vadSensitivity ?? 0.5) * 0.35) && micLevel > 3
    : micLevel >= (100 - sensitivityPercent) && micLevel > 3;

  if (!isOpen) return null;

  // Deduplicate active players (from proximity radar & channel members)
  const allActivePlayersMap = new Map<string, { uuid: string; username: string; isProximity: boolean }>();
  for (const peer of peers) {
    allActivePlayersMap.set(peer.uuid, { uuid: peer.uuid, username: peer.username, isProximity: true });
  }
  for (const member of channelMembers) {
    if (!allActivePlayersMap.has(member.uuid)) {
      allActivePlayersMap.set(member.uuid, { uuid: member.uuid, username: member.username, isProximity: false });
    }
  }

  const activePlayers = Array.from(allActivePlayersMap.values()).filter((p) =>
    p.username.toLowerCase().includes(playerFilter.toLowerCase())
  );

  const handleTestOutput = () => {
    setTestSoundPlaying(true);
    soundEffects.playConnect();
    setTimeout(() => setTestSoundPlaying(false), 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{t('settings.title')}</h2>
              <p className="text-xs text-slate-400">{t('settings.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={t('settings.closeTooltip')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 px-6 bg-slate-950/20 gap-2">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${activeTab === 'devices'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Mic className="w-4 h-4" />
            <span>{t('settings.tabs.devices')}</span>
          </button>

          <button
            onClick={() => setActiveTab('players')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${activeTab === 'players'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>{t('settings.tabs.players', { count: activePlayers.length })}</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${activeTab === 'preferences'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t('settings.tabs.preferences')}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: DEVICES */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              {/* Input Device */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>{t('settings.devices.inputTitle')}</span>
                </label>
                <select
                  value={selectedInputId}
                  onChange={(e) => onSelectInputDevice(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">{t('settings.devices.defaultDevice')}</option>
                  {inputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `${t('settings.devices.selectInput')} (${d.deviceId.slice(0, 8)}...)`}
                    </option>
                  ))}
                </select>

                {/* AI Noise Suppression (RNNoise) Card */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-purple-500/20 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-200">{t('settings.devices.aiNoiseTitle')}</span>
                      {isFallbackMode && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {t('settings.devices.aiNoiseFallbackBadge')}
                        </span>
                      )}
                    </div>
                    {onToggleAiNoiseSuppression && (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiNoiseSuppression}
                          onChange={(e) => onToggleAiNoiseSuppression(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('settings.devices.aiNoiseDesc')}
                  </p>
                </div>

                {/* Input Gain Slider */}
                {onChangeInputGain && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('settings.devices.inputGainTitle')}</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-semibold">{Math.round(inputGain * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.0"
                      step="0.05"
                      value={inputGain}
                      onChange={(e) => onChangeInputGain(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{t('settings.devices.gainMute')}</span>
                      <span>{t('settings.devices.gainNormal')}</span>
                      <span>{t('settings.devices.gainBoost')}</span>
                    </div>
                  </div>
                )}

                {/* Microphone Level Visualizer & VAD Calibration */}
                <div className="pt-2 space-y-2.5 border-t border-white/10">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">{t('settings.devices.vadTitle')}</span>
                    <div className="flex items-center gap-2">
                      {aiNoiseSuppression && (
                        <span className="font-mono text-[11px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                          {t('settings.devices.voiceAi', { percent: aiProbPercent })}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${isSpeechActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-white/10'
                          }`}
                      >
                        {isSpeechActive ? t('settings.devices.transmitting') : t('settings.devices.silent')}
                      </span>
                      <span className="font-mono text-emerald-400 text-xs">{micLevel}%</span>
                    </div>
                  </div>

                  {/* Level bar */}
                  <div className="relative h-3.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${micLevel}%`,
                        backgroundColor: isSpeechActive ? '#10b981' : '#38bdf8',
                      }}
                    />
                  </div>

                  {/* Interactive VAD Sensitivity Slider */}
                  {(onChangeVadSensitivity || onChangeVadThreshold) && (
                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-medium text-slate-300">{t('settings.devices.vadSensitivityTitle')}</span>
                        <span className="font-mono text-amber-400 font-semibold">{sensitivityPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.02"
                        value={vadSensitivity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (onChangeVadSensitivity) {
                            onChangeVadSensitivity(val);
                          }
                          if (onChangeVadThreshold) {
                            onChangeVadThreshold(Math.max(0.005, (1.0 - val) * 0.15));
                          }
                        }}
                        className="w-full accent-amber-500 cursor-pointer"
                        title={`${t('settings.devices.vadSensitivityTitle')} ${sensitivityPercent}%`}
                      />
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{t('settings.devices.strictFilter')}</span>
                        <span>{t('settings.devices.whisperFilter')}</span>
                      </div>
                    </div>
                  )}

                  {/* Loopback Mic Test Button */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10 mt-1">
                    <div className="pr-3">
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('settings.devices.loopbackTitle')}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t('settings.devices.loopbackDesc')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleLoopback}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer ${isLoopbackActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                        }`}
                    >
                      {isLoopbackActive ? t('settings.devices.loopbackStop') : t('settings.devices.loopbackStart')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Output Device */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-emerald-400" />
                    <span>{t('settings.devices.outputTitle')}</span>
                  </label>
                  <button
                    onClick={handleTestOutput}
                    disabled={testSoundPlaying}
                    className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{testSoundPlaying ? t('settings.devices.testingSound') : t('settings.devices.testSoundButton')}</span>
                  </button>
                </div>
                <select
                  value={selectedOutputId}
                  onChange={(e) => onSelectOutputDevice(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">{t('settings.devices.defaultDevice')}</option>
                  {outputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `${t('settings.devices.selectOutput')} (${d.deviceId.slice(0, 8)}...)`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  {t('settings.devices.outputNote')}
                </p>
              </div>

              {/* Hardware Audio Filters */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('settings.devices.voiceFiltersTitle')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/50 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={audioConstraints.echoCancellation}
                      onChange={(e) =>
                        onUpdateConstraints({ ...audioConstraints, echoCancellation: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-white/20 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-200">{t('settings.devices.echoCancellation')}</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/50 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={audioConstraints.noiseSuppression}
                      onChange={(e) =>
                        onUpdateConstraints({ ...audioConstraints, noiseSuppression: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-white/20 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-200">{t('settings.devices.noiseSuppression')}</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/50 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={audioConstraints.autoGainControl}
                      onChange={(e) =>
                        onUpdateConstraints({ ...audioConstraints, autoGainControl: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-white/20 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-200">{t('settings.devices.autoGainControl')}</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLAYERS */}
          {activeTab === 'players' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder={t('settings.players.searchPlaceholder')}
                  value={playerFilter}
                  onChange={(e) => setPlayerFilter(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={onResetAllVolumes}
                  className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
                >
                  {t('settings.players.reset100')}
                </button>
              </div>

              {activePlayers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  {t('settings.players.emptyPlayers')}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {activePlayers.map((player) => {
                    const currentVol = peerVolumes[player.uuid] ?? 1.0;
                    const isMuted = peerMuted[player.uuid] ?? false;
                    const percent = Math.round(currentVol * 100);

                    return (
                      <div
                        key={player.uuid}
                        className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-slate-950/60 border border-white/10"
                      >
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <img
                            src={`https://mc-heads.net/avatar/${player.uuid}/32`}
                            alt={player.username}
                            className="w-8 h-8 rounded-lg border border-white/20"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/32';
                            }}
                          />
                          <div className="truncate">
                            <div className="text-sm font-medium text-slate-200">{player.username}</div>
                            <div className="text-[10px] text-slate-400">
                              {player.isProximity ? t('settings.players.proximityBadge') : t('settings.players.channelBadge')}
                            </div>
                          </div>
                        </div>

                        {/* Volume slider */}
                        <div className="flex-1 flex items-center gap-3 max-w-xs">
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={isMuted ? 0 : currentVol}
                            disabled={isMuted}
                            onChange={(e) => onSetPeerVolume(player.uuid, parseFloat(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
                          />
                          <span className="w-10 text-right font-mono text-xs text-emerald-400">
                            {isMuted ? t('settings.players.mutedIndicator') : `${percent}%`}
                          </span>
                        </div>

                        {/* Mute button */}
                        <button
                          onClick={() => onSetPeerMuted(player.uuid, !isMuted)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${isMuted
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                            }`}
                        >
                          {isMuted ? t('settings.players.unmuteButton') : t('settings.players.muteButton')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PREFERENCES & NETWORK */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Language Selection */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('settings.preferences.languageTitle')}
                </h3>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                  <p className="text-xs text-slate-400">
                    {t('settings.preferences.languageDesc')}
                  </p>
                  <LanguageSelector variant="full" />
                </div>
              </div>

              {/* Media & Music Volume Controls */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('settings.preferences.mediaSectionTitle')}
                </h3>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        <Music className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{t('settings.preferences.mediaMuteTitle')}</div>
                        <div className="text-xs text-slate-400">
                          {t('settings.preferences.mediaMuteDesc')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleMediaMuted?.(!mediaMuted)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${mediaMuted ? 'bg-rose-500' : 'bg-slate-700'
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${mediaMuted ? 'translate-x-7' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {!mediaMuted && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{t('settings.preferences.mediaVolumeTitle')}</span>
                        <span className="font-mono text-cyan-400">{Math.round((mediaVolume ?? 1.0) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={mediaVolume ?? 1.0}
                        onChange={(e) => onSetMediaVolume?.(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Sound Effects */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('settings.preferences.sfxSectionTitle')}
                </h3>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{t('settings.preferences.sfxTitle')}</div>
                      <div className="text-xs text-slate-400">
                        {t('settings.preferences.sfxDesc')}
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleSfx(!sfxEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${sfxEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${sfxEnabled ? 'translate-x-7' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {sfxEnabled && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{t('settings.preferences.sfxVolumeTitle')}</span>
                        <span className="font-mono text-emerald-400">{Math.round(sfxVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={sfxVolume}
                        onChange={(e) => onSetSfxVolume(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Streamer Mode & Privacy */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('settings.preferences.streamerSectionTitle')}
                </h3>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3 pr-4">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      {streamerMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{t('settings.preferences.streamerTitle')}</div>
                      <div className="text-xs text-slate-400">
                        {t('settings.preferences.streamerDesc')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleStreamerMode(!streamerMode)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${streamerMode ? 'bg-indigo-500' : 'bg-slate-700'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${streamerMode ? 'translate-x-7' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Keyboard shortcuts */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('settings.preferences.shortcutsTitle')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10">
                    <span className="text-sm text-slate-300">{t('settings.preferences.muteMicShortcut')}</span>
                    <kbd className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono text-xs border border-white/10">
                      M
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10">
                    <span className="text-sm text-slate-300">{t('settings.preferences.deafenShortcut')}</span>
                    <kbd className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono text-xs border border-white/10">
                      D
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10">
                    <span className="text-sm text-slate-300">{t('settings.preferences.closeMenusShortcut')}</span>
                    <kbd className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono text-xs border border-white/10">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Network Latency Stats */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('settings.preferences.diagnosticsTitle')}
                </h3>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${pingMs !== null && pingMs < 70
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : pingMs !== null && pingMs < 150
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                    >
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{t('settings.preferences.wsLatency')}</div>
                      <div className="text-xs text-slate-400">
                        {pingMs !== null && pingMs < 70
                          ? t('settings.preferences.pingExcellent')
                          : pingMs !== null && pingMs < 150
                            ? t('settings.preferences.pingStable')
                            : t('settings.preferences.pingHigh')}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-100">
                    {pingMs !== null ? `${pingMs} ms` : '...'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/40 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{t('common.ready')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
