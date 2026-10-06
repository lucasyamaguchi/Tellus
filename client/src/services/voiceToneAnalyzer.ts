// Real-time Acoustic & Semantic Voice Tone Analyzer for Tellus Live Voice

export type DetectedToneType = 'whispering' | 'excited' | 'calm' | 'neutral';

export interface ToneAnalysisResult {
  type: DetectedToneType;
  label: string;
  tag: string;
  emoji: string;
  confidence: number;
  description: string;
  metrics: {
    avgRms: number;
    peakRms: number;
    zcr: number;
    sampleCount: number;
    durationMs: number;
  };
}

export class VoiceToneAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;

  // Measurement buffers
  private rmsSamples: number[] = [];
  private zcrSamples: number[] = [];
  private highFreqRatios: number[] = [];
  private peakRms = 0;
  private startTime = 0;
  private isAnalyzing = false;

  /**
   * Starts active microphone monitoring for acoustic features during speech
   */
  public async start(existingStream?: MediaStream): Promise<boolean> {
    try {
      this.reset();

      if (existingStream && existingStream.active) {
        this.mediaStream = existingStream;
      } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // Keep dynamic range to detect whispers accurately
            autoGainControl: false   // Avoid AGC inflating quiet whisper sound
          }
        });
      } else {
        return false;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyser);

      this.startTime = Date.now();
      this.isAnalyzing = true;
      this.sampleLoop();
      return true;
    } catch (err) {
      console.warn('[VoiceToneAnalyzer] Não foi possível iniciar análise acústica:', err);
      return false;
    }
  }

  private sampleLoop = () => {
    if (!this.isAnalyzing || !this.analyser) return;

    const bufferLength = this.analyser.fftSize;
    const timeData = new Float32Array(bufferLength);
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.analyser.getFloatTimeDomainData(timeData);
    this.analyser.getByteFrequencyData(freqData);

    // 1. Calculate RMS (Volume / Energy)
    let sumSquares = 0;
    let zeroCrossings = 0;
    let prevSample = timeData[0] || 0;

    for (let i = 0; i < bufferLength; i++) {
      const val = timeData[i];
      sumSquares += val * val;

      if ((prevSample < 0 && val >= 0) || (prevSample >= 0 && val < 0)) {
        zeroCrossings++;
      }
      prevSample = val;
    }

    const currentRms = Math.sqrt(sumSquares / bufferLength);
    const zcr = zeroCrossings / bufferLength;

    // Filter out ambient dead silence (< 0.003) so it doesn't skew speech statistics
    if (currentRms > 0.004) {
      this.rmsSamples.push(currentRms);
      this.zcrSamples.push(zcr);

      if (currentRms > this.peakRms) {
        this.peakRms = currentRms;
      }

      // 2. High vs Low frequency ratio (Whispers have almost no harmonic vocal fundamental below 400Hz, but friction noise above 2kHz)
      const lowBins = freqData.slice(1, 10); // ~80Hz - 400Hz
      const highBins = freqData.slice(30, 80); // ~1300Hz - 3500Hz
      const lowEnergy = lowBins.reduce((a, b) => a + b, 0) / (lowBins.length || 1);
      const highEnergy = highBins.reduce((a, b) => a + b, 0) / (highBins.length || 1);

      if (lowEnergy + highEnergy > 5) {
        const ratio = highEnergy / Math.max(lowEnergy, 1);
        this.highFreqRatios.push(ratio);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.sampleLoop);
  };

  /**
   * Stops analysis and computes final acoustic and semantic tone classification
   */
  public stopAndAnalyze(transcript?: string): ToneAnalysisResult {
    this.isAnalyzing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const durationMs = this.startTime ? Date.now() - this.startTime : 0;
    const sampleCount = this.rmsSamples.length;

    // Compute averages
    const avgRms = sampleCount > 0 ? this.rmsSamples.reduce((a, b) => a + b, 0) / sampleCount : 0.04;
    const avgZcr = this.zcrSamples.length > 0 ? this.zcrSamples.reduce((a, b) => a + b, 0) / this.zcrSamples.length : 0.08;
    const avgHighRatio = this.highFreqRatios.length > 0 ? this.highFreqRatios.reduce((a, b) => a + b, 0) / this.highFreqRatios.length : 1.0;

    // Release audio stream resources gracefully
    this.cleanup();

    // Classification Logic
    return this.classify({
      avgRms,
      peakRms: this.peakRms,
      zcr: avgZcr,
      highFreqRatio: avgHighRatio,
      sampleCount,
      durationMs,
      transcript: transcript || ''
    });
  }

  private classify(data: {
    avgRms: number;
    peakRms: number;
    zcr: number;
    highFreqRatio: number;
    sampleCount: number;
    durationMs: number;
    transcript: string;
  }): ToneAnalysisResult {
    const text = data.transcript.toLowerCase();

    // Semantic hints
    const hasWhisperKeywords = /\b(psiu|shh|segredo|baixinho|sussurr|em segredo|ninguém ouça)\b/i.test(text);
    const hasExcitedKeywords = /\b(nossa|uau|caramba|maravilha|demais|olha só|adorei|incrível|eita|show)\b/i.test(text) ||
      /(\!{1,}|\?{2,}|kkk|haha|rsrs)/i.test(text);
    const hasCalmKeywords = /\b(pensando bem|calma|devagar|tranquilo|refletir|com calma)\b/i.test(text);

    // Acoustic scoring
    // Whisper profile: very low RMS (< 0.024) or low peak (< 0.045) with higher relative air/frequency ratio
    const isAcousticWhisper = (data.avgRms < 0.025 && data.peakRms < 0.055) || (data.avgRms < 0.035 && data.highFreqRatio > 2.0);

    // Excited profile: strong energy (avgRms > 0.09 or peakRms > 0.16)
    const isAcousticExcited = data.avgRms > 0.085 || data.peakRms > 0.15;

    // Calm profile: gentle, steady volume between 0.025 and 0.065
    const isAcousticCalm = data.avgRms >= 0.025 && data.avgRms <= 0.065 && data.peakRms < 0.11;

    // 1. WHISPERING
    if (hasWhisperKeywords || (isAcousticWhisper && !hasExcitedKeywords)) {
      return {
        type: 'whispering',
        label: 'Sussurrando / Voz Baixa',
        tag: '[whispering]',
        emoji: '🤫',
        confidence: hasWhisperKeywords ? 0.95 : 0.85,
        description: 'Usuário falou em tom muito baixo ou sussurrado. Você DEVE responder sussurrando suavemente com a tag [whispering].',
        metrics: {
          avgRms: data.avgRms,
          peakRms: data.peakRms,
          zcr: data.zcr,
          sampleCount: data.sampleCount,
          durationMs: data.durationMs
        }
      };
    }

    // 2. EXCITED / HAPPY
    if (hasExcitedKeywords || (isAcousticExcited && !hasCalmKeywords)) {
      return {
        type: 'excited',
        label: 'Alegre / Entusiasmado',
        tag: '[excited]',
        emoji: '⚡',
        confidence: hasExcitedKeywords ? 0.92 : 0.82,
        description: 'Usuário falou com tom entusiasmado, energia alta e vivacidade. Responda com energia alegre e motivadora com a tag [excited] ou [happy].',
        metrics: {
          avgRms: data.avgRms,
          peakRms: data.peakRms,
          zcr: data.zcr,
          sampleCount: data.sampleCount,
          durationMs: data.durationMs
        }
      };
    }

    // 3. CALM / SOFT
    if (hasCalmKeywords || isAcousticCalm) {
      return {
        type: 'calm',
        label: 'Calmo / Tranquilo',
        tag: '[calm]',
        emoji: '🌿',
        confidence: hasCalmKeywords ? 0.88 : 0.78,
        description: 'Usuário falou em tom sereno, relaxado e ponderado. Responda em tom suave, acolhedor e claro com a tag [calm] ou [softly].',
        metrics: {
          avgRms: data.avgRms,
          peakRms: data.peakRms,
          zcr: data.zcr,
          sampleCount: data.sampleCount,
          durationMs: data.durationMs
        }
      };
    }

    // 4. NEUTRAL (Default baseline)
    return {
      type: 'neutral',
      label: 'Neutro / Focado',
      tag: '[calm]',
      emoji: '🎯',
      confidence: 0.75,
      description: 'Usuário falou em tom neutro e natural de conversa. Responda com clareza, empatia e objetividade com a tag [calm] ou [thoughtful].',
      metrics: {
        avgRms: data.avgRms,
        peakRms: data.peakRms,
        zcr: data.zcr,
        sampleCount: data.sampleCount,
        durationMs: data.durationMs
      }
    };
  }

  public stop() {
    this.cleanup();
  }

  public cleanup() {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch {}
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => track.stop());
      } catch {}
      this.mediaStream = null;
    }
    this.isAnalyzing = false;
  }

  private reset() {
    this.cleanup();
    this.rmsSamples = [];
    this.zcrSamples = [];
    this.highFreqRatios = [];
    this.peakRms = 0;
    this.startTime = 0;
  }
}

export const voiceToneAnalyzer = new VoiceToneAnalyzer();
