import React, { useState, useEffect, useRef } from 'react';
import { Settings, Mic, Headphones, Users, Volume2, Activity, Sliders, X, Check } from 'lucide-react';
import { soundEffects } from '../../audio/SoundEffects.js';
import { ChannelMember } from '../../net/VoiceSignaling.js';
import { PeerRadarInfo } from '../Radar.js';

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
}) => {
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

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const updateLevel = () => {
      analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (dataArray.length || 1);
      const normalized = Math.min(100, Math.round((avg / 255) * 160));
      setMicLevel(normalized);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };

    animFrameRef.current = requestAnimationFrame(updateLevel);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, analyserNode, activeTab]);

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
              <h2 className="text-lg font-semibold text-slate-100">Configuración de Audio</h2>
              <p className="text-xs text-slate-400">Dispositivos, volúmenes de jugadores y preferencias</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 px-6 bg-slate-950/20 gap-2">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'devices'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Dispositivos</span>
          </button>

          <button
            onClick={() => setActiveTab('players')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'players'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Jugadores ({activePlayers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'preferences'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Preferencias & Red</span>
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
                  <span>Dispositivo de Entrada (Micrófono)</span>
                </label>
                <select
                  value={selectedInputId}
                  onChange={(e) => onSelectInputDevice(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Predeterminado del sistema</option>
                  {inputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Micrófono (${d.deviceId.slice(0, 8)}...)`}
                    </option>
                  ))}
                </select>

                {/* Microphone Level Visualizer */}
                <div className="pt-2 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Prueba de Entrada (Habla para probar)</span>
                    <span className="font-mono text-emerald-400">{micLevel}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${micLevel}%`,
                        backgroundColor: micLevel > 80 ? '#f43f5e' : micLevel > 40 ? '#22c55e' : '#38bdf8',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Output Device */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-emerald-400" />
                    <span>Dispositivo de Salida (Auriculares / Altavoces)</span>
                  </label>
                  <button
                    onClick={handleTestOutput}
                    disabled={testSoundPlaying}
                    className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{testSoundPlaying ? 'Reproduciendo...' : 'Probar sonido'}</span>
                  </button>
                </div>
                <select
                  value={selectedOutputId}
                  onChange={(e) => onSelectOutputDevice(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Predeterminado del sistema</option>
                  {outputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Altavoz (${d.deviceId.slice(0, 8)}...)`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Nota: La selección de salida requiere compatibilidad del navegador con AudioContext.setSinkId.
                </p>
              </div>

              {/* Hardware Audio Filters */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Filtros de Procesamiento de Voz
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
                    <span className="text-xs text-slate-200">Cancelación de Eco</span>
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
                    <span className="text-xs text-slate-200">Supresión de Ruido</span>
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
                    <span className="text-xs text-slate-200">Ganancia Automática</span>
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
                  placeholder="Buscar jugador por nombre..."
                  value={playerFilter}
                  onChange={(e) => setPlayerFilter(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={onResetAllVolumes}
                  className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
                >
                  Restablecer a 100%
                </button>
              </div>

              {activePlayers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No hay jugadores activos o audibles en este momento.
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
                              {player.isProximity ? 'Proximidad 3D' : 'Canal Fijo'}
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
                            {isMuted ? 'MUTE' : `${percent}%`}
                          </span>
                        </div>

                        {/* Mute button */}
                        <button
                          onClick={() => onSetPeerMuted(player.uuid, !isMuted)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                            isMuted
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                          }`}
                        >
                          {isMuted ? 'Desmutear' : 'Silenciar'}
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
              {/* Sound Effects */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Efectos de Sonido de Interfaz (SFX)
                </h3>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Sonidos de Interfaz</div>
                      <div className="text-xs text-slate-400">
                        Chimes y beeps sutiles para conectar, desconectar y conmutar mute/canales
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleSfx(!sfxEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        sfxEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                          sfxEnabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {sfxEnabled && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Volumen de Efectos</span>
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

              {/* Keyboard shortcuts */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Atajos de Teclado
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10">
                    <span className="text-sm text-slate-300">Mutear / Desmutear</span>
                    <kbd className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono text-xs border border-white/10">
                      M
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10">
                    <span className="text-sm text-slate-300">Cerrar Menús / Modales</span>
                    <kbd className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-md font-mono text-xs border border-white/10">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Network Latency Stats */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Diagnóstico de Red y Conexión
                </h3>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        pingMs !== null && pingMs < 70
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : pingMs !== null && pingMs < 150
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">Latencia WebSocket (RTT)</div>
                      <div className="text-xs text-slate-400">
                        {pingMs !== null && pingMs < 70
                          ? 'Conexión excelente'
                          : pingMs !== null && pingMs < 150
                          ? 'Conexión estable'
                          : 'Latencia elevada o reconectando'}
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
            <span>Listo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
