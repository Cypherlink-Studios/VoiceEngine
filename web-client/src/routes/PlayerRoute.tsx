import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Headphones, Sparkles, Radio, EyeOff } from 'lucide-react';
import { SpatialAudioPipeline } from '../audio/SpatialAudioPipeline.js';
import { VoiceActivityDetector } from '../audio/VoiceActivityDetector.js';
import { VoiceSignaling, ChannelMember, ModerationNotice } from '../net/VoiceSignaling.js';
import { Radar, PeerRadarInfo } from '../components/Radar.js';
import { ControlDock } from '../components/player/ControlDock.js';
import { ChannelDrawer } from '../components/player/ChannelDrawer.js';
import { SettingsModal, AudioConstraintsConfig } from '../components/player/SettingsModal.js';
import { PlayerVolumePopover } from '../components/player/PlayerVolumePopover.js';
import { QrCompanionModal } from '../components/player/QrCompanionModal.js';
import { PipOverlay } from '../components/player/PipOverlay.js';
import { soundEffects } from '../audio/SoundEffects.js';
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
  const [isDeafened, setIsDeafened] = useState(false);
  const [moderationNotice, setModerationNotice] = useState<ModerationNotice | null>(null);
  const [vadThreshold, setVadThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('voiceengine:vad_threshold');
    const val = saved ? parseFloat(saved) : 0.04;
    return isNaN(val) ? 0.04 : val;
  });
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [peers, setPeers] = useState<PeerRadarInfo[]>([]);

  const [activeChannel, setActiveChannel] = useState<string>('proximity');
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // UX & Diagnostics State
  const [isLoopbackActive, setIsLoopbackActive] = useState(false);
  const [streamerMode, setStreamerMode] = useState<boolean>(
    () => localStorage.getItem('voiceengine:streamer_mode') === 'true'
  );
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const isPipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  // Audio Device Selection & Constraints
  const [selectedInputId, setSelectedInputId] = useState<string>(
    () => localStorage.getItem('voiceengine:input_device') || ''
  );
  const [selectedOutputId, setSelectedOutputId] = useState<string>(
    () => localStorage.getItem('voiceengine:output_device') || ''
  );
  const [audioConstraints, setAudioConstraints] = useState<AudioConstraintsConfig>(() => {
    try {
      return JSON.parse(
        localStorage.getItem('voiceengine:audio_constraints') || ''
      );
    } catch {
      return { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    }
  });

  // Per-User Volumes & Local Mutes
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('voiceengine:peer_volumes') || '{}');
    } catch {
      return {};
    }
  });
  const [peerMuted, setPeerMuted] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('voiceengine:peer_muted') || '{}');
    } catch {
      return {};
    }
  });

  // QoL: Sound Effects & Network Latency
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(
    () => localStorage.getItem('voiceengine:sfx_enabled') !== 'false'
  );
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('voiceengine:sfx_volume') || '0.5');
    return isNaN(v) ? 0.5 : v;
  });
  const [pingMs, setPingMs] = useState<number | null>(null);

  // Media & Music Volume
  const [mediaVolume, setMediaVolume] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('voiceengine:media_volume') || '1.0');
    return isNaN(v) ? 1.0 : v;
  });
  const [mediaMuted, setMediaMuted] = useState<boolean>(
    () => localStorage.getItem('voiceengine:media_muted') === 'true'
  );

  const handleSetMediaVolume = (volume: number) => {
    setMediaVolume(volume);
    localStorage.setItem('voiceengine:media_volume', String(volume));
    pipelineRef.current?.setMediaVolume(volume);
  };

  const handleToggleMediaMuted = (muted: boolean) => {
    setMediaMuted(muted);
    localStorage.setItem('voiceengine:media_muted', String(muted));
    pipelineRef.current?.setMediaMuted(muted);
  };

  // Modals and Popovers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [popoverPeer, setPopoverPeer] = useState<PeerRadarInfo | null>(null);

  const signalingRef = useRef<VoiceSignaling | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const pipelineRef = useRef<SpatialAudioPipeline | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sendStreamRef = useRef<MediaStream | null>(null);
  const sendTrackRef = useRef<MediaStreamTrack | null>(null);
  const isMutedRef = useRef(false);
  const isDeafenedRef = useRef(false);
  const isSpeakingRef = useRef(false);

  const updateAudioTransmission = (speaking: boolean, muted: boolean, deafened: boolean) => {
    const canTransmit = speaking && !muted && !deafened;
    if (sendTrackRef.current) {
      sendTrackRef.current.enabled = canTransmit;
    }
    pipelineRef.current?.setLoopbackGated(canTransmit);
  };

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
      // 1. Request microphone permissions with configured device and constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedInputId ? { exact: selectedInputId } : undefined,
          echoCancellation: audioConstraints.echoCancellation,
          noiseSuppression: audioConstraints.noiseSuppression,
          autoGainControl: audioConstraints.autoGainControl,
        },
      });
      micStreamRef.current = stream;

      // Clone microphone track for WebRTC transmission so the raw track remains enabled
      // for continuous VAD detection and local visual analyser processing.
      const rawTrack = stream.getAudioTracks()[0];
      const sendTrack = rawTrack.clone();
      sendTrack.enabled = false;
      sendTrackRef.current = sendTrack;
      const sendStream = new MediaStream([sendTrack]);
      sendStreamRef.current = sendStream;

      // 2. Initialize Audio Pipeline, Analyser, Preferences & VAD
      const pipeline = new SpatialAudioPipeline();
      pipelineRef.current = pipeline;
      pipeline.setMasterVolume(masterVolume);
      pipeline.setMediaVolume(mediaVolume);
      pipeline.setMediaMuted(mediaMuted);
      pipeline.loadPreferences(peerVolumes, peerMuted);

      if (selectedOutputId) {
        await pipeline.setOutputDevice(selectedOutputId);
      }

      // Initialize procedural sound effects with pipeline audio context
      soundEffects.init(pipeline.getContext());
      soundEffects.setEnabled(sfxEnabled);
      soundEffects.setVolume(sfxVolume);

      const localAnalyser = pipeline.createLocalAnalyser(stream);
      setAnalyser(localAnalyser);

      const vad = new VoiceActivityDetector(
        stream,
        {
          onSpeakingChange: (speaking) => {
            setIsSpeaking(speaking);
            isSpeakingRef.current = speaking;
            signalingRef.current?.notifySpeaking(speaking);
            updateAudioTransmission(speaking, isMutedRef.current, isDeafenedRef.current);
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
          soundEffects.playConnect();
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
          setChannelMembers((prev) => {
            const updated = prev.map((m) => (m.uuid === peerUuid ? { ...m, isSpeaking: speaking } : m));
            const anyChannelSpeaking = updated.some((m) => m.isSpeaking);
            pipelineRef.current?.setRadioDucking(anyChannelSpeaking);
            return updated;
          });
        },
        onPingUpdated: (rtt) => {
          setPingMs(rtt);
        },
        onModerationNotice: (notice) => {
          setModerationNotice(notice);
          if (notice.action === 'mute') {
            setIsMuted(notice.active);
            isMutedRef.current = notice.active;
            updateAudioTransmission(isSpeakingRef.current, notice.active, isDeafenedRef.current);
            if (notice.active) {
              setIsSpeaking(false);
              isSpeakingRef.current = false;
              vadRef.current?.reset();
              signalingRef.current?.notifySpeaking(false);
              soundEffects.playMute();
            } else {
              soundEffects.playUnmute();
            }
          } else if (notice.action === 'deafen') {
            setIsDeafened(notice.active);
            isDeafenedRef.current = notice.active;
            pipelineRef.current?.setDeafened(notice.active);
            if (notice.active) {
              soundEffects.playDeafen();
            } else {
              soundEffects.playUndeafen();
            }
          } else if (notice.action === 'kick' || notice.action === 'ban') {
            setErrorMsg(notice.reason || `You have been ${notice.action}ed from VoiceEngine.`);
            handleDisconnect();
          }
        },
        onDisconnected: () => {
          handleDisconnect();
        },
      });

      signalingRef.current = signaling;
      await signaling.connect(sendStream);
    } catch (err: unknown) {
      console.error('[PlayerRoute] Connection failed:', err);
      const message = err instanceof Error ? err.message : 'Microphone access denied or connection failed.';
      setErrorMsg(message);
      setIsConnecting(false);
    }
  };

  const triggerHaptic = (pattern: number | number[] = 40) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const handleDisconnect = () => {
    const wasActive = !!(signalingRef.current || micStreamRef.current || pipelineRef.current);
    if (wasActive) {
      soundEffects.playDisconnect();
    }

    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }

    signalingRef.current?.disconnect();
    signalingRef.current = null;

    vadRef.current?.stop();
    vadRef.current = null;

    if (sendTrackRef.current) {
      sendTrackRef.current.stop();
      sendTrackRef.current = null;
    }

    if (sendStreamRef.current) {
      sendStreamRef.current.getTracks().forEach((t) => t.stop());
      sendStreamRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    isMutedRef.current = false;
    isDeafenedRef.current = false;
    isSpeakingRef.current = false;

    pipelineRef.current?.close();
    pipelineRef.current = null;

    setAnalyser(null);
    setIsConnected(false);
    setIsConnecting(false);
    setIsMuted(false);
    setIsDeafened(false);
    setIsLoopbackActive(false);
    setIsQrModalOpen(false);
    setIsSpeaking(false);
    setLocalPlayer(null);
    setPeers([]);
    setChannelMembers([]);
    setActiveChannel('proximity');
    setPingMs(null);
    setPopoverPeer(null);
    setModerationNotice(null);
  };

  const handleToggleMute = () => {
    if (moderationNotice?.action === 'mute' && moderationNotice.active) {
      return;
    }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    updateAudioTransmission(isSpeakingRef.current, nextMuted, isDeafenedRef.current);

    if (nextMuted) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      vadRef.current?.reset();
      signalingRef.current?.notifySpeaking(false);
      soundEffects.playMute();
      triggerHaptic(30);
    } else {
      if (isDeafened) {
        setIsDeafened(false);
        isDeafenedRef.current = false;
        pipelineRef.current?.setDeafened(false);
      }
      soundEffects.playUnmute();
      triggerHaptic(40);
    }
  };

  const handleToggleDeafen = () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    isDeafenedRef.current = nextDeafened;
    pipelineRef.current?.setDeafened(nextDeafened);

    if (nextDeafened) {
      setIsMuted(true);
      isMutedRef.current = true;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      vadRef.current?.reset();
      signalingRef.current?.notifySpeaking(false);
      updateAudioTransmission(false, true, true);
      soundEffects.playDeafen();
      triggerHaptic([30, 40, 30]);
    } else {
      setIsMuted(false);
      isMutedRef.current = false;
      updateAudioTransmission(isSpeakingRef.current, false, false);
      soundEffects.playUndeafen();
      triggerHaptic(40);
    }
  };

  const handleToggleLoopback = () => {
    if (!pipelineRef.current || !micStreamRef.current) return;
    if (isLoopbackActive) {
      pipelineRef.current.stopLoopback();
      setIsLoopbackActive(false);
    } else {
      const canTransmit = isSpeakingRef.current && !isMutedRef.current && !isDeafenedRef.current;
      pipelineRef.current.startLoopback(micStreamRef.current, 0.18, canTransmit);
      setIsLoopbackActive(true);
    }
  };

  const handleToggleStreamerMode = (enabled: boolean) => {
    setStreamerMode(enabled);
    localStorage.setItem('voiceengine:streamer_mode', String(enabled));
  };

  const handleTogglePip = async () => {
    if (!isPipSupported) return;
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    try {
      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 320,
        height: 420,
      });

      // Copy document stylesheets to floating PiP window
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = pip.document.createElement('style');
          style.textContent = cssRules;
          pip.document.head.appendChild(style);
        } catch {
          if (styleSheet.href) {
            const link = pip.document.createElement('link');
            link.rel = 'stylesheet';
            link.type = styleSheet.type;
            link.media = styleSheet.media;
            link.href = styleSheet.href;
            pip.document.head.appendChild(link);
          }
        }
      });

      pip.document.body.className = 'bg-slate-950 text-slate-100 overflow-hidden m-0 p-0 select-none';

      pip.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          handleToggleMute();
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          handleToggleDeafen();
        } else if (e.key === 'Escape') {
          pip.close();
        }
      });

      pip.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(pip);
    } catch (err) {
      console.warn('[PlayerRoute] Failed to open Document Picture-in-Picture:', err);
    }
  };

  const handleSelectInputDevice = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    localStorage.setItem('voiceengine:input_device', deviceId);
    if (isConnected) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: audioConstraints.echoCancellation,
            noiseSuppression: audioConstraints.noiseSuppression,
            autoGainControl: audioConstraints.autoGainControl,
          },
        });
        const newTrack = newStream.getAudioTracks()[0];
        if (newTrack) {
          if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((t) => t.stop());
          }
          if (sendTrackRef.current) {
            sendTrackRef.current.stop();
          }
          if (sendStreamRef.current) {
            sendStreamRef.current.getTracks().forEach((t) => t.stop());
          }
          micStreamRef.current = newStream;

          const newSendTrack = newTrack.clone();
          const canTransmit = isSpeakingRef.current && !isMutedRef.current && !isDeafenedRef.current;
          newSendTrack.enabled = canTransmit;
          sendTrackRef.current = newSendTrack;
          const newSendStream = new MediaStream([newSendTrack]);
          sendStreamRef.current = newSendStream;

          await signalingRef.current?.replaceMicrophoneTrack(newSendTrack);

          if (pipelineRef.current) {
            const newAnalyser = pipelineRef.current.createLocalAnalyser(newStream);
            setAnalyser(newAnalyser);
            if (isLoopbackActive) {
              pipelineRef.current.startLoopback(newStream, 0.18, canTransmit);
            }
          }

          if (vadRef.current) {
            vadRef.current.stop();
            const newVad = new VoiceActivityDetector(
              newStream,
              {
                onSpeakingChange: (speaking) => {
                  setIsSpeaking(speaking);
                  isSpeakingRef.current = speaking;
                  signalingRef.current?.notifySpeaking(speaking);
                  updateAudioTransmission(speaking, isMutedRef.current, isDeafenedRef.current);
                },
                onVolumeChange: () => {},
              },
              vadThreshold
            );
            vadRef.current = newVad;
          }
        }
      } catch (err) {
        console.error('[PlayerRoute] Failed to switch microphone:', err);
      }
    }
  };

  const handleSelectOutputDevice = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    localStorage.setItem('voiceengine:output_device', deviceId);
    if (pipelineRef.current) {
      await pipelineRef.current.setOutputDevice(deviceId);
    }
  };

  const handleUpdateConstraints = async (newConstraints: AudioConstraintsConfig) => {
    setAudioConstraints(newConstraints);
    localStorage.setItem('voiceengine:audio_constraints', JSON.stringify(newConstraints));
    if (isConnected) {
      await handleSelectInputDevice(selectedInputId);
    }
  };

  const handleSetPeerVolume = (uuid: string, volume: number) => {
    setPeerVolumes((prev) => {
      const next = { ...prev, [uuid]: volume };
      localStorage.setItem('voiceengine:peer_volumes', JSON.stringify(next));
      return next;
    });
    pipelineRef.current?.setPeerVolume(uuid, volume);
  };

  const handleSetPeerMuted = (uuid: string, muted: boolean) => {
    setPeerMuted((prev) => {
      const next = { ...prev, [uuid]: muted };
      localStorage.setItem('voiceengine:peer_muted', JSON.stringify(next));
      return next;
    });
    pipelineRef.current?.setPeerMuted(uuid, muted);
  };

  const handleResetAllVolumes = () => {
    setPeerVolumes({});
    setPeerMuted({});
    localStorage.removeItem('voiceengine:peer_volumes');
    localStorage.removeItem('voiceengine:peer_muted');
    if (pipelineRef.current) {
      pipelineRef.current.loadPreferences({}, {});
    }
  };

  const handleToggleSfx = (enabled: boolean) => {
    setSfxEnabled(enabled);
    localStorage.setItem('voiceengine:sfx_enabled', String(enabled));
    soundEffects.setEnabled(enabled);
  };

  const handleSetSfxVolume = (vol: number) => {
    setSfxVolume(vol);
    localStorage.setItem('voiceengine:sfx_volume', String(vol));
    soundEffects.setVolume(vol);
  };

  const handleChangeMasterVolume = (vol: number) => {
    setMasterVolume(vol);
    pipelineRef.current?.setMasterVolume(vol);
  };

  const handleChangeVadThreshold = (thresh: number) => {
    setVadThreshold(thresh);
    localStorage.setItem('voiceengine:vad_threshold', String(thresh));
    vadRef.current?.setThreshold(thresh);
  };

  const handleSelectChannel = (channelId: string) => {
    if (channelId === activeChannel) return;
    soundEffects.playChannelSwitch();
    setActiveChannel(channelId);
    signalingRef.current?.joinChannel(channelId);
  };

  // Keyboard Shortcuts (M for mute, D for deafen, Esc to close overlays)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popoverPeer) {
          setPopoverPeer(null);
          return;
        }
        if (isQrModalOpen) {
          setIsQrModalOpen(false);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
      }

      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && isConnected) {
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          handleToggleMute();
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          handleToggleDeafen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, isMuted, isDeafened, popoverPeer, isSettingsOpen, isQrModalOpen]);

  // Screen Wake Lock API for Mobile Companion Mode
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestLock = async () => {
      if ('wakeLock' in navigator && isConnected) {
        try {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.warn('[PlayerRoute] Screen Wake Lock failed:', err);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isConnected) {
        requestLock();
      }
    };

    if (isConnected) {
      requestLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
      }
    };
  }, [isConnected]);

  // Page Lifecycle Sensor: Warn on leave/close while connected & cleanly terminate voicechat session
  useEffect(() => {
    if (!isConnected) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isConnected) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    const handlePageDismiss = () => {
      // 1. Guaranteed server teardown via sendBeacon (immune to abrupt page unload)
      try {
        const sessionId = signalingRef.current?.getSessionId();
        const playerUuid = localPlayer?.uuid;
        if (sessionId || playerUuid) {
          const payload = JSON.stringify({ sessionId, playerUuid });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon?.('/api/session/disconnect', blob);
        }
      } catch {
        // beacon fallback ignore
      }

      // 2. Synchronous client cleanup: stop mic hardware tracks, close audio context, PiP and WebSocket
      handleDisconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageDismiss);
    window.addEventListener('unload', handlePageDismiss);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageDismiss);
      window.removeEventListener('unload', handlePageDismiss);

      // Clean up if component unmounts while connected (e.g. navigating to another route)
      handleDisconnect();
    };
  }, [isConnected, localPlayer]);

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
        <div className="flex items-center gap-3">
          {streamerMode && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 shadow-sm"
              title="Modo Streamer activado: tokens y datos sensibles ocultos"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modo Streamer</span>
            </div>
          )}
          {isConnected && localPlayer ? (
            <div className="flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/10 shadow-md">
              <img
                src={`https://mc-heads.net/avatar/${localPlayer.uuid}/24`}
                alt={localPlayer.username}
                className="w-6 h-6 rounded border border-white/20"
              />
              <div className="text-left">
                <div className="text-xs font-semibold text-white leading-tight">
                  {streamerMode ? 'Jugador' : localPlayer.username}
                </div>
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
        </div>
      </header>

      {/* Moderation Alert Banner */}
      {moderationNotice && moderationNotice.active && (
        <div className="relative z-20 w-full max-w-4xl mx-auto mt-4 px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider text-[10px] text-amber-400 flex items-center gap-1.5">
                <span>Acción de Moderación</span>
                <span>•</span>
                <span>{moderationNotice.action === 'mute' ? 'Silenciado' : moderationNotice.action === 'deafen' ? 'Ensordecido' : moderationNotice.action}</span>
              </div>
              <p className="text-slate-200 mt-0.5">{moderationNotice.reason || 'Sanción aplicada por el personal de moderación.'}</p>
            </div>
          </div>
          {moderationNotice.expiresAt && moderationNotice.expiresAt > 0 && (
            <div className="text-right shrink-0 ml-4">
              <span className="text-[10px] text-slate-400 uppercase block font-mono">Expira en</span>
              <span className="font-mono text-amber-400 font-bold">
                {Math.max(0, Math.ceil((moderationNotice.expiresAt - Date.now()) / 1000))}s
              </span>
            </div>
          )}
        </div>
      )}

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
                  placeholder="ENTER JOIN CODE"
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
                onPeerClick={(peer) => setPopoverPeer(peer)}
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
                onMemberClick={(member) =>
                  setPopoverPeer({
                    uuid: member.uuid,
                    username: member.username,
                    distance: 0,
                    relX: 0,
                    relY: 0,
                    relZ: 0,
                  })
                }
              />
            </div>
          </div>
        )}
      </main>

      {/* Player Volume Popover Modal */}
      {popoverPeer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setPopoverPeer(null)}
        >
          <PlayerVolumePopover
            peerUuid={popoverPeer.uuid}
            peerUsername={popoverPeer.username}
            volume={peerVolumes[popoverPeer.uuid] ?? 1.0}
            isMuted={peerMuted[popoverPeer.uuid] ?? false}
            distance={popoverPeer.distance}
            relX={popoverPeer.relX}
            relY={popoverPeer.relY}
            relZ={popoverPeer.relZ}
            streamerMode={streamerMode}
            onVolumeChange={handleSetPeerVolume}
            onMuteToggle={handleSetPeerMuted}
            onClose={() => setPopoverPeer(null)}
          />
        </div>
      )}

      {/* Floating Control Dock (When Connected) */}
      {isConnected && (
        <ControlDock
          isMuted={isMuted}
          isDeafened={isDeafened}
          isSpeaking={isSpeaking}
          masterVolume={masterVolume}
          vadThreshold={vadThreshold}
          analyser={analyser}
          pingMs={pingMs}
          isPipSupported={isPipSupported}
          isPipActive={pipWindow !== null}
          isModerationMuted={Boolean(moderationNotice?.action === 'mute' && moderationNotice.active)}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onTogglePip={handleTogglePip}
          onOpenQrCompanion={() => setIsQrModalOpen(true)}
          onChangeMasterVolume={handleChangeMasterVolume}
          onChangeVadThreshold={handleChangeVadThreshold}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* Mobile Companion QR Modal */}
      <QrCompanionModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        sessionUrl={
          typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}?token=${tokenInput.trim().toUpperCase()}`
            : ''
        }
        streamerMode={streamerMode}
      />

      {/* Document Picture-in-Picture Native Floating Overlay Portal */}
      {pipWindow &&
        createPortal(
          <PipOverlay
            localPlayer={localPlayer}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isSpeaking={isSpeaking}
            pingMs={pingMs}
            peers={activeChannel === 'proximity' ? peers : []}
            streamerMode={streamerMode}
            onToggleMute={handleToggleMute}
            onToggleDeafen={handleToggleDeafen}
            onClose={() => {
              pipWindow.close();
              setPipWindow(null);
            }}
            onPeerClick={(peer) => setPopoverPeer(peer)}
          />,
          pipWindow.document.body
        )}

      {/* Settings Modal (Devices, Volumes, Preferences) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedInputId={selectedInputId}
        selectedOutputId={selectedOutputId}
        onSelectInputDevice={handleSelectInputDevice}
        onSelectOutputDevice={handleSelectOutputDevice}
        audioConstraints={audioConstraints}
        onUpdateConstraints={handleUpdateConstraints}
        analyserNode={analyser}
        vadThreshold={vadThreshold}
        onChangeVadThreshold={handleChangeVadThreshold}
        isLoopbackActive={isLoopbackActive}
        onToggleLoopback={handleToggleLoopback}
        streamerMode={streamerMode}
        onToggleStreamerMode={handleToggleStreamerMode}
        peers={peers}
        channelMembers={channelMembers}
        peerVolumes={peerVolumes}
        peerMuted={peerMuted}
        onSetPeerVolume={handleSetPeerVolume}
        onSetPeerMuted={handleSetPeerMuted}
        onResetAllVolumes={handleResetAllVolumes}
        sfxEnabled={sfxEnabled}
        sfxVolume={sfxVolume}
        onToggleSfx={handleToggleSfx}
        onSetSfxVolume={handleSetSfxVolume}
        pingMs={pingMs}
        mediaVolume={mediaVolume}
        onSetMediaVolume={handleSetMediaVolume}
        mediaMuted={mediaMuted}
        onToggleMediaMuted={handleToggleMediaMuted}
      />
    </div>
  );
}
