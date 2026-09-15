export interface MicrophonePipelineCallbacks {
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  onSpeechProbabilityChange?: (probability: number) => void;
  onFallbackTriggered?: (reason: string) => void;
}

export interface MicrophonePipelineOptions {
  noiseSuppression?: boolean;
  inputGain?: number; // 0.0 to 2.0 (1.0 = 100%)
  vadSensitivity?: number; // 0.0 to 1.0 (default 0.5)
  hangoverMs?: number; // default 250ms
}

export class MicrophonePipeline {
  private audioContext: AudioContext;
  private rawStream: MediaStream;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode;
  private rnnoiseNode: AudioWorkletNode | null = null;
  private inputGainNode: GainNode;
  private gateGainNode: GainNode;
  private compressorNode: DynamicsCompressorNode;
  private destinationNode: MediaStreamAudioDestinationNode;
  private analyserNode: AnalyserNode;

  private callbacks: MicrophonePipelineCallbacks;
  private noiseSuppressionEnabled: boolean;
  private inputGain: number;
  private vadSensitivity: number;
  private hangoverMs: number;

  private isSpeaking = false;
  private isMuted = false;
  private isDeafened = false;
  private isFallbackMode = false;
  private isInitialized = false;

  private hangoverTimer: ReturnType<typeof setTimeout> | null = null;
  private animFrameId: number | null = null;
  private latestSpeechProb = 0;
  private isDestroyed = false;

  constructor(
    stream: MediaStream,
    callbacks: MicrophonePipelineCallbacks = {},
    options: MicrophonePipelineOptions = {}
  ) {
    this.rawStream = stream;
    this.callbacks = callbacks;
    this.noiseSuppressionEnabled = options.noiseSuppression ?? true;
    this.inputGain = Math.max(0.0, Math.min(2.0, options.inputGain ?? 1.0));
    this.vadSensitivity = Math.max(0.0, Math.min(1.0, options.vadSensitivity ?? 0.5));
    this.hangoverMs = options.hangoverMs ?? 250;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    // Standardize input audio graph to 48kHz interactive mode to match Opus clock rate
    this.audioContext = new AudioContextClass({
      sampleRate: 48000,
      latencyHint: 'interactive',
    });

    // 1. 80Hz High-Pass Filter: strips sub-bass rumble, desk taps, AC hum, breath pops
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.setValueAtTime(80, this.audioContext.currentTime);
    this.highPassFilter.Q.setValueAtTime(0.707, this.audioContext.currentTime);

    // 2. Input Gain Node: user calibration (0% to 200%)
    this.inputGainNode = this.audioContext.createGain();
    this.inputGainNode.gain.setValueAtTime(this.inputGain, this.audioContext.currentTime);

    // 3. Smooth Gate Gain Node: exponential attack/release ramp (~15ms)
    this.gateGainNode = this.audioContext.createGain();
    this.gateGainNode.gain.setValueAtTime(0.0, this.audioContext.currentTime);

    // 4. Soft-Knee Peak Compressor / Limiter to prevent clipping before Opus
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-6.0, this.audioContext.currentTime); // dB
    this.compressorNode.knee.setValueAtTime(12.0, this.audioContext.currentTime); // dB
    this.compressorNode.ratio.setValueAtTime(4.0, this.audioContext.currentTime);
    this.compressorNode.attack.setValueAtTime(0.005, this.audioContext.currentTime); // 5ms
    this.compressorNode.release.setValueAtTime(0.05, this.audioContext.currentTime); // 50ms

    // 5. Destination Node for WebRTC upstream track
    this.destinationNode = this.audioContext.createMediaStreamDestination();

    // 6. Local Analyser Node for reactive UI VU meter
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.2;

    // Connect downstream pipeline:
    // gateGainNode -> compressorNode -> destinationNode
    this.gateGainNode.connect(this.compressorNode);
    this.compressorNode.connect(this.destinationNode);

    // Bind initial media stream source
    this.bindSourceStream(stream);
  }

  public async init(): Promise<void> {
    if (this.isDestroyed) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    try {
      await this.initRNNoiseWorklet();
    } catch (err) {
      console.warn('[MicrophonePipeline] Failed to initialize RNNoise AudioWorklet, falling back to native Web Audio DSP:', err);
      this.isFallbackMode = true;
      this.callbacks.onFallbackTriggered?.(
        err instanceof Error ? err.message : 'WebAssembly/AudioWorklet unavailable'
      );
      this.connectFallbackGraph();
    }

    this.isInitialized = true;
    this.startMonitoringLoop();
  }

  private async initRNNoiseWorklet(): Promise<void> {
    const isSimdSupported = async (): Promise<boolean> => {
      try {
        return WebAssembly.validate(
          new Uint8Array([
            0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
            253, 98, 11,
          ])
        );
      } catch {
        return false;
      }
    };

    const hasSimd = await isSimdSupported();
    const wasmUrl = hasSimd ? '/audio/rnnoise_simd.wasm' : '/audio/rnnoise.wasm';
    const processorUrl = '/audio/rnnoise-processor.js';

    // Register worklet processor module
    await this.audioContext.audioWorklet.addModule(processorUrl);

    // Fetch and compile WebAssembly binary
    const wasmResponse = await fetch(wasmUrl);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch RNNoise WASM binary from ${wasmUrl} (${wasmResponse.status})`);
    }
    const wasmBinary = await wasmResponse.arrayBuffer();

    // Create RNNoise AudioWorkletNode
    this.rnnoiseNode = new AudioWorkletNode(
      this.audioContext,
      '@sapphi-red/web-noise-suppressor/rnnoise',
      {
        processorOptions: {
          maxChannels: 1,
          wasmBinary,
        },
      }
    );

    // Listen for neural VAD speech probability emitted by the worklet
    this.rnnoiseNode.port.onmessage = (event) => {
      if (event.data?.type === 'vad' && typeof event.data.probability === 'number') {
        this.latestSpeechProb = event.data.probability;
        this.callbacks.onSpeechProbabilityChange?.(this.latestSpeechProb);
      }
    };

    // Apply initial bypass state
    this.rnnoiseNode.port.postMessage({
      type: 'bypass',
      value: !this.noiseSuppressionEnabled,
    });

    // Routing: highPassFilter -> rnnoiseNode -> inputGainNode -> gateGainNode
    this.highPassFilter.connect(this.rnnoiseNode);
    this.rnnoiseNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.gateGainNode);
  }

  private connectFallbackGraph(): void {
    try {
      this.highPassFilter.disconnect();
    } catch {}
    // Routing without worklet: highPassFilter -> inputGainNode -> gateGainNode
    this.highPassFilter.connect(this.inputGainNode);
    this.inputGainNode.connect(this.gateGainNode);
  }

  private bindSourceStream(stream: MediaStream): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
    }

    this.rawStream = stream;
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // Split raw audio:
    // 1. Through high-pass filter for processing
    this.sourceNode.connect(this.highPassFilter);
    // 2. Directly to local analyser for real-time VU meter monitoring
    this.sourceNode.connect(this.analyserNode);
  }

  public setInputDevice(newStream: MediaStream): void {
    this.bindSourceStream(newStream);
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getRawStream(): MediaStream {
    return this.rawStream;
  }

  public getProcessedTrack(): MediaStreamTrack {
    return this.destinationNode.stream.getAudioTracks()[0];
  }

  public getAnalyser(): AnalyserNode {
    return this.analyserNode;
  }

  public getContext(): AudioContext {
    return this.audioContext;
  }

  public isFallback(): boolean {
    return this.isFallbackMode;
  }

  public setNoiseSuppression(enabled: boolean): void {
    this.noiseSuppressionEnabled = enabled;
    if (this.rnnoiseNode) {
      this.rnnoiseNode.port.postMessage({
        type: 'bypass',
        value: !enabled,
      });
    }
  }

  public getNoiseSuppression(): boolean {
    return this.noiseSuppressionEnabled;
  }

  public setInputGain(gain: number): void {
    this.inputGain = Math.max(0.0, Math.min(2.0, gain));
    if (this.inputGainNode) {
      this.inputGainNode.gain.setTargetAtTime(this.inputGain, this.audioContext.currentTime, 0.02);
    }
  }

  public getInputGain(): number {
    return this.inputGain;
  }

  public setVadSensitivity(sensitivity: number): void {
    this.vadSensitivity = Math.max(0.0, Math.min(1.0, sensitivity));
  }

  public getVadSensitivity(): number {
    return this.vadSensitivity;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateGateGain();
  }

  public setDeafened(deafened: boolean): void {
    this.isDeafened = deafened;
    this.updateGateGain();
  }

  private startMonitoringLoop(): void {
    const buffer = new Float32Array(this.analyserNode.fftSize);

    const tick = () => {
      if (this.isDestroyed) return;

      this.analyserNode.getFloatTimeDomainData(buffer);

      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const normalizedVolume = Math.min(1.0, rms * 4.0);
      this.callbacks.onVolumeChange?.(normalizedVolume);

      // Hybrid VAD Decision:
      // When RNNoise is active and not bypassed: combine neural voice probability with minimum volume floor
      // When fallback or bypassed: use sensitivity-calibrated RMS volume threshold
      let isSpeechDetected = false;

      if (!this.isFallbackMode && this.noiseSuppressionEnabled && this.rnnoiseNode) {
        // Sensitivity maps:
        // 0.0 (aggressive noise filter) -> requires 80% voice probability and higher volume
        // 1.0 (high sensitivity) -> requires 45% voice probability and lower volume
        const requiredProb = 0.80 - this.vadSensitivity * 0.35;
        const minRmsFloor = Math.max(0.005, 0.035 - this.vadSensitivity * 0.03);
        isSpeechDetected = this.latestSpeechProb >= requiredProb && rms >= minRmsFloor;
      } else {
        // RMS threshold calibration (0.005 to 0.12)
        const rmsThreshold = 0.12 - this.vadSensitivity * 0.11;
        isSpeechDetected = rms >= rmsThreshold;
      }

      if (isSpeechDetected) {
        if (this.hangoverTimer) {
          clearTimeout(this.hangoverTimer);
          this.hangoverTimer = null;
        }

        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.callbacks.onSpeakingChange?.(true);
          this.updateGateGain();
        }
      } else if (this.isSpeaking && !this.hangoverTimer) {
        this.hangoverTimer = setTimeout(() => {
          this.isSpeaking = false;
          this.hangoverTimer = null;
          this.callbacks.onSpeakingChange?.(false);
          this.updateGateGain();
        }, this.hangoverMs);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private updateGateGain(): void {
    const shouldTransmit = this.isSpeaking && !this.isMuted && !this.isDeafened;
    const targetGain = shouldTransmit ? 1.0 : 0.0;
    const now = this.audioContext.currentTime;

    // Exponential smoothing with 15ms time constant eliminates digital waveform clicks
    this.gateGainNode.gain.cancelScheduledValues(now);
    this.gateGainNode.gain.setTargetAtTime(targetGain, now, 0.015);
  }

  public destroy(): void {
    this.isDestroyed = true;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.hangoverTimer) {
      clearTimeout(this.hangoverTimer);
      this.hangoverTimer = null;
    }

    if (this.rnnoiseNode) {
      try {
        this.rnnoiseNode.port.postMessage('destroy');
        this.rnnoiseNode.disconnect();
      } catch {}
      this.rnnoiseNode = null;
    }

    try {
      this.sourceNode?.disconnect();
      this.highPassFilter.disconnect();
      this.inputGainNode.disconnect();
      this.gateGainNode.disconnect();
      this.compressorNode.disconnect();
      this.destinationNode.disconnect();
      this.analyserNode.disconnect();
    } catch {}

    if (this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }
}
