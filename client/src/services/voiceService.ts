// Voice Service for Tellus: TTS (Text-to-Speech) & STT (Speech-to-Text)

export interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
  isPortuguese: boolean;
  isDefault: boolean;
}

export type VoiceProvider = 'system' | 'fish-audio';

export interface FishVoicePreset {
  id: string;
  name: string;
  description: string;
  lang: string;
}

export const FISH_VOICE_PRESETS: FishVoicePreset[] = [
  {
    id: '82d13948027e4be69892dd3d0104e681',
    name: 'Jarvis (Assistente Virtual)',
    description: 'Tom masculino inteligente, calmo, sofisticado e tecnológico (pt-BR)',
    lang: 'Multilíngue (pt-BR)'
  },
  {
    id: '2714f32ab7f8475fa45e277f840c8c23',
    name: 'Ahri Lol PT - BR',
    description: 'Voz feminina jovem, carismática, dinâmica e conversacional (pt-BR)',
    lang: 'Multilíngue (pt-BR)'
  },
  {
    id: '5161d41404314212af1254556477c17d',
    name: 'Mulher Alegre (Anime/Assistente)',
    description: 'Timbre doce, carismático e expressivo',
    lang: 'Multilíngue (pt-BR)'
  },
  {
    id: 'ec6303f4ed0c435b9f8cdf7530e590c7',
    name: 'Jovem e Animada',
    description: 'Timbre jovem, vibrante, ágil e espontâneo',
    lang: 'Multilíngue (pt-BR)'
  }
];

const STORAGE_VOICE_KEY = 'tellus_selected_voice_uri';
const STORAGE_RATE_KEY = 'tellus_speech_rate';
const STORAGE_AUTOSPEAK_KEY = 'tellus_auto_speak';
const STORAGE_PROVIDER_KEY = 'tellus_voice_provider';
const STORAGE_FISH_VOICE_KEY = 'tellus_fish_voice_id';
const STORAGE_FISH_MODEL_KEY = 'tellus_fish_model';

class VoiceService {
  private voices: SpeechSynthesisVoice[] = [];
  private onVoicesLoadedCallbacks: Array<() => void> = [];
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices();
    if (this.voices.length > 0) {
      this.onVoicesLoadedCallbacks.forEach(cb => cb());
    }
  }

  public onVoicesReady(cb: () => void) {
    if (this.voices.length > 0) {
      cb();
    } else {
      this.onVoicesLoadedCallbacks.push(cb);
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
    return this.voices;
  }

  public getVoiceOptions(): VoiceOption[] {
    const rawVoices = this.getVoices();
    return rawVoices.map(v => {
      const isPt = v.lang.toLowerCase().startsWith('pt');
      return {
        uri: v.voiceURI,
        name: v.name,
        lang: v.lang,
        isPortuguese: isPt,
        isDefault: v.default
      };
    }).sort((a, b) => {
      // Prioritize Portuguese voices first
      if (a.isPortuguese && !b.isPortuguese) return -1;
      if (!a.isPortuguese && b.isPortuguese) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public getPreferredVoice(): SpeechSynthesisVoice | null {
    const all = this.getVoices();
    if (all.length === 0) return null;

    const savedUri = localStorage.getItem(STORAGE_VOICE_KEY);
    if (savedUri) {
      const matched = all.find(v => v.voiceURI === savedUri);
      if (matched) return matched;
    }

    // Default to natural Brazilian Portuguese voice if available
    const ptVoices = all.filter(v => v.lang.toLowerCase().includes('pt'));
    if (ptVoices.length > 0) {
      const preferred = ptVoices.find(v => 
        v.name.includes('Francisca') || 
        v.name.includes('Google') || 
        v.name.includes('Daniel') ||
        v.name.includes('Luciana')
      );
      return preferred || ptVoices[0];
    }

    // Fallback to default
    return all.find(v => v.default) || all[0] || null;
  }

  public setPreferredVoice(uri: string) {
    localStorage.setItem(STORAGE_VOICE_KEY, uri);
  }

  public getSpeechRate(): number {
    const saved = localStorage.getItem(STORAGE_RATE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
        return parsed;
      }
    }
    return 1.0;
  }

  public setSpeechRate(rate: number) {
    localStorage.setItem(STORAGE_RATE_KEY, String(rate));
  }

  public getAutoSpeak(): boolean {
    return localStorage.getItem(STORAGE_AUTOSPEAK_KEY) === 'true';
  }

  public setAutoSpeak(enabled: boolean) {
    localStorage.setItem(STORAGE_AUTOSPEAK_KEY, enabled ? 'true' : 'false');
  }

  /**
   * Cleans Markdown syntax so that SpeechSynthesis sounds natural without reading syntax characters.
   */
  public cleanTextForSpeech(text: string): string {
    if (!text) return '';

    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' [código omitido para leitura] ')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove markdown links but keep text: [Title](url) -> Title
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove wikilinks: [[Note Title]] -> Note Title
      .replace(/\[\[(.*?)\]\]/g, '$1')
      // Remove headers: # Header -> Header
      .replace(/^#+\s+/gm, '')
      // Remove blockquotes: > quote -> quote
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove bold and italics
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Remove table rows: | col | col |
      .replace(/\|.*\|/g, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Replace multiple whitespace/newlines
      .replace(/\s+/g, ' ')
      .trim();
  }

  public getVoiceProvider(): VoiceProvider {
    return (localStorage.getItem(STORAGE_PROVIDER_KEY) as VoiceProvider) || 'fish-audio';
  }

  public setVoiceProvider(provider: VoiceProvider) {
    localStorage.setItem(STORAGE_PROVIDER_KEY, provider);
  }

  public getFishVoiceId(): string {
    return localStorage.getItem(STORAGE_FISH_VOICE_KEY) || FISH_VOICE_PRESETS[0].id;
  }

  public setFishVoiceId(id: string) {
    localStorage.setItem(STORAGE_FISH_VOICE_KEY, id.trim());
  }

  public getFishModel(): string {
    return localStorage.getItem(STORAGE_FISH_MODEL_KEY) || 's2.1-pro-free';
  }

  public setFishModel(model: string) {
    localStorage.setItem(STORAGE_FISH_MODEL_KEY, model.trim());
  }

  public async speak(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
      voiceURI?: string;
      rate?: number;
      forceProvider?: VoiceProvider;
      referenceId?: string;
    }
  ) {
    this.stop();

    const clean = this.cleanTextForSpeech(text);
    if (!clean) {
      options?.onEnd?.();
      return;
    }

    const provider = options?.forceProvider || this.getVoiceProvider();

    // 1. Fish Audio AI High-Fidelity Synthesis
    if (provider === 'fish-audio') {
      try {
        const voiceId = options?.referenceId || this.getFishVoiceId();
        const model = this.getFishModel();

        const res = await fetch('/api/voice/fish-audio/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            reference_id: voiceId,
            model
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro Fish Audio HTTP ${res.status}`);
        }

        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        this.currentAudioUrl = audioUrl;
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        audio.playbackRate = options?.rate || this.getSpeechRate();

        audio.onplay = () => {
          options?.onStart?.();
        };

        audio.onended = () => {
          if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
          }
          this.currentAudio = null;
          options?.onEnd?.();
        };

        audio.onerror = (e) => {
          console.error('[FishAudio Playback Error]', e);
          if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
          }
          this.currentAudio = null;
          this.speakWithSystem(clean, options);
        };

        await audio.play();
        return;
      } catch (err: any) {
        console.warn('[Fish Audio Error — Revertendo para voz nativa do sistema]:', err.message);
        this.speakWithSystem(clean, options);
        return;
      }
    }

    // 2. Default System Web Speech
    this.speakWithSystem(clean, options);
  }

  private speakWithSystem(
    clean: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
      voiceURI?: string;
      rate?: number;
    }
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options?.onError?.(new Error('Speech Synthesis não suportado neste ambiente.'));
      return;
    }

    const isWhispering = /\[whisper/i.test(clean);
    // Remove emotion tags in brackets for system synthesizer so it doesn't speak bracket names
    const textForSystem = clean.replace(/\[[a-zA-Z\s_-]+\]/g, '').replace(/\s+/g, ' ').trim();
    if (!textForSystem) {
      options?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textForSystem);
    
    // Choose voice
    let targetVoice = options?.voiceURI 
      ? this.getVoices().find(v => v.voiceURI === options.voiceURI) 
      : this.getPreferredVoice();

    if (targetVoice) {
      utterance.voice = targetVoice;
      utterance.lang = targetVoice.lang;
    } else {
      utterance.lang = 'pt-BR';
    }

    utterance.rate = isWhispering 
      ? (options?.rate || this.getSpeechRate()) * 0.9 
      : (options?.rate || this.getSpeechRate());
    utterance.pitch = 1.0;
    utterance.volume = isWhispering ? 0.35 : 1.0;

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') {
        options?.onEnd?.();
        return;
      }
      options?.onError?.(e);
      options?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      try {
        URL.revokeObjectURL(this.currentAudioUrl);
      } catch {}
      this.currentAudioUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    const isAudioPlaying = this.currentAudio !== null && !this.currentAudio.paused;
    const isSynthesisSpeaking = typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
    return isAudioPlaying || isSynthesisSpeaking;
  }

  public testVoice(options?: { voiceURI?: string; referenceId?: string; onEnd?: () => void }) {
    this.speak('Olá! Esta é uma demonstração da voz configurada no Tellus.', {
      voiceURI: options?.voiceURI,
      referenceId: options?.referenceId,
      onEnd: options?.onEnd
    });
  }

  // --- Speech-to-Text (STT) & Microphone Access ---

  private activeMediaStream: MediaStream | null = null;
  private activeRecognizer: any = null;

  public isElectron(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      navigator.userAgent.includes('Electron') ||
      !!(window as any).process?.versions?.electron ||
      !!(window as any).electron
    );
  }

  public async requestMicrophoneAccess(): Promise<{ granted: boolean; stream?: MediaStream; error?: string }> {
    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { 
        granted: false, 
        error: 'Captura direta de microfone via HTML5 MediaDevices não suportada.' 
      };
    }

    try {
      if (this.activeMediaStream && this.activeMediaStream.active) {
        return { granted: true, stream: this.activeMediaStream };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true
        }
      });
      this.activeMediaStream = stream;
      return { granted: true, stream };
    } catch (err: any) {
      console.warn('[VoiceService] getUserMedia permission failed:', err);
      let errorMsg = 'Permissão de microfone negada.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        if (this.isElectron()) {
          errorMsg = 'Acesso ao microfone negado no Windows. Verifique Configurações > Privacidade e Segurança > Microfone no Windows.';
        } else {
          errorMsg = 'O acesso ao microfone foi bloqueado pelo navegador. Verifique as permissões de microfone.';
        }
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'Nenhum microfone foi detectado conectado ao seu computador.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'O microfone está sendo utilizado por outro aplicativo ou processo do sistema.';
      }
      return { granted: false, error: errorMsg };
    }
  }

  public releaseMicrophone() {
    if (this.activeMediaStream) {
      try {
        this.activeMediaStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch {}
      this.activeMediaStream = null;
    }
  }

  public stopAll() {
    this.stop();
    this.releaseMicrophone();
    if (this.activeRecognizer) {
      try {
        this.activeRecognizer.abort();
      } catch {}
      this.activeRecognizer = null;
    }
  }

  public isSpeechRecognitionAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    if (!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) return true;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') return true;
    return false;
  }

  public createSpeechRecognizer(callbacks: {
    onResult: (transcript: string, isFinal: boolean) => void;
    onError?: (err: any) => void;
    onEnd?: () => void;
    onStart?: () => void;
    onProcessing?: (isProcessing: boolean) => void;
    lang?: string;
  }) {
    const hasNative = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (hasNative) {
      console.log('[VoiceService] Utilizando motor nativo de reconhecimento de fala (Web Speech API pt-BR)');
      const nativeRec = new NativeWebSpeechRecognizer(callbacks);
      this.activeRecognizer = nativeRec;
      return nativeRec;
    }

    console.log('[VoiceService] Utilizando DirectMicRecognizer via Web Audio / Backend Transcribe');
    const directRec = new DirectMicRecognizer(callbacks);
    this.activeRecognizer = directRec;
    return directRec;
  }
}

/**
 * Native Web Speech Recognizer (Chrome / Edge / Chromium)
 * Ouve e transcreve em tempo real em pt-BR diretamente pelo hardware do navegador,
 * sem requisições pesadas de upload nem dependência de chaves de API externas.
 */
class NativeWebSpeechRecognizer {
  private recognition: any = null;
  private isListening = false;
  private callbacks: any;
  public continuous = true;

  constructor(callbacks: any) {
    this.callbacks = callbacks;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = callbacks.lang || 'pt-BR';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.callbacks.onStart?.();
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const trans = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += trans;
            } else {
              interimTranscript += trans;
            }
          }

          if (finalTranscript.trim()) {
            this.callbacks.onResult(finalTranscript.trim(), true);
          } else if (interimTranscript.trim()) {
            this.callbacks.onResult(interimTranscript.trim(), false);
          }
        };

        this.recognition.onerror = (event: any) => {
          if (event.error === 'no-speech') {
            return;
          }
          console.warn('[NativeSpeechRecognizer] Erro de voz:', event.error);
          this.callbacks.onError?.(event.error);
        };

        this.recognition.onend = () => {
          if (this.isListening && this.continuous) {
            try {
              this.recognition.start();
            } catch {
              this.isListening = false;
              this.callbacks.onEnd?.();
            }
          } else {
            this.isListening = false;
            this.callbacks.onEnd?.();
          }
        };
      } catch (err) {
        console.warn('[NativeSpeechRecognizer] Falha ao inicializar motor nativo:', err);
      }
    }
  }

  public start() {
    if (this.recognition && !this.isListening) {
      try {
        this.isListening = true;
        this.recognition.start();
      } catch (e) {
        console.warn('[NativeSpeechRecognizer] Erro ao iniciar:', e);
      }
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.callbacks.onEnd?.();
  }

  public abort() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
    this.callbacks.onEnd?.();
  }
}

/**
 * Direct Microphone Recognizer
 * Captura o microfone do PC diretamente via hardware (WASAPI/CoreAudio),
 * detecta fala e silêncio (VAD) e transcreve via backend em formato WAV 16kHz.
 */
class DirectMicRecognizer {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isListening = false;
  private pcmChunks: Float32Array[] = [];
  private silenceTimer: any = null;
  private isSpeaking = false;
  private callbacks: any;
  public continuous = true;

  constructor(callbacks: any) {
    this.callbacks = callbacks;
  }

  public async start() {
    if (this.isListening) return;
    this.isListening = true;
    this.pcmChunks = [];
    this.isSpeaking = false;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true
        }
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isListening) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData.length);
        chunk.set(inputData);
        this.pcmChunks.push(chunk);

        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Sensibilidade aprimorada para vozes calmas, sussurros e microfones de PC (rms > 0.002)
        if (rms > 0.002) {
          this.isSpeaking = true;
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        } else if (this.isSpeaking) {
          if (!this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              if (this.isListening && this.isSpeaking) {
                this.commitSpeech();
              }
            }, 1400); // 1.4s de silêncio conclui a fala
          }
        }
      };

      // Nó de ganho silencioso para evitar que a própria voz do usuário saia no alto-falante gerando eco
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(silentGain);
      silentGain.connect(this.audioContext.destination);

      this.callbacks.onStart?.();
    } catch (err: any) {
      console.error('[DirectMicRecognizer] Failed to access direct microphone:', err);
      this.isListening = false;
      this.callbacks.onError?.(err?.name === 'NotAllowedError' ? 'not-allowed' : err?.message || 'mic-error');
    }
  }

  private async commitSpeech(forcedChunks?: Float32Array[], forcedSampleRate?: number) {
    const chunks = forcedChunks || this.pcmChunks;
    if (!chunks || chunks.length === 0) return;
    this.pcmChunks = [];
    this.isSpeaking = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const sampleRate = forcedSampleRate || this.audioContext?.sampleRate || 44100;
    if (totalLength < sampleRate * 0.2) {
      // Menos de 200ms, ignorar estalo momentâneo
      return;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    const wavBlob = encodeWav(merged, sampleRate);
    this.callbacks.onProcessing?.(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string)?.split(',')[1];
      if (!base64Data) {
        this.callbacks.onProcessing?.(false);
        return;
      }

      try {
        console.log(`[DirectMicRecognizer] Enviando áudio gravado (${wavBlob.size} bytes) para /api/voice/transcribe...`);
        const res = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: 'audio/wav'
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = (data.text || '').trim();
          console.log(`[DirectMicRecognizer] Resposta transcrição (${data.provider}): "${text}"`);
          if (text) {
            this.callbacks.onResult(text, true);
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[DirectMicRecognizer] Transcription error:', errData);
        }
      } catch (e) {
        console.warn('[DirectMicRecognizer] Transcription request failed:', e);
      } finally {
        this.callbacks.onProcessing?.(false);
        if (!this.continuous && this.isListening) {
          this.stop();
        }
      }
    };
    reader.readAsDataURL(wavBlob);
  }

  public stop() {
    if (!this.isListening) return;
    this.isListening = false;
    
    // Se houver dados gravados, captura antes do cleanup para enviar à transcrição
    const chunksToCommit = this.pcmChunks.length > 0 ? [...this.pcmChunks] : null;
    const sampleRate = this.audioContext?.sampleRate || 44100;
    
    this.cleanup();
    
    if (chunksToCommit && chunksToCommit.length > 0) {
      this.commitSpeech(chunksToCommit, sampleRate);
    }
    this.callbacks.onEnd?.();
  }

  public abort() {
    this.isListening = false;
    this.pcmChunks = [];
    this.isSpeaking = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.cleanup();
    this.callbacks.onEnd?.();
  }

  private cleanup() {
    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch {}
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch {}
      this.mediaStream = null;
    }
  }
}

/**
 * Converte Float32Array PCM de qualquer taxa para um WAV 16kHz mono de 16 bits
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  let targetSamples = samples;
  let targetRate = sampleRate;

  if (sampleRate !== 16000) {
    const ratio = sampleRate / 16000;
    const newLen = Math.round(samples.length / ratio);
    targetSamples = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      targetSamples[i] = samples[Math.min(Math.round(i * ratio), samples.length - 1)];
    }
    targetRate = 16000;
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = targetRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = targetSamples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint8(0, 82); view.setUint8(1, 73); view.setUint8(2, 70); view.setUint8(3, 70);
  view.setUint32(4, 36 + dataSize, true);
  // WAVE identifier
  view.setUint8(8, 87); view.setUint8(9, 65); view.setUint8(10, 86); view.setUint8(11, 69);
  // fmt chunk
  view.setUint8(12, 102); view.setUint8(13, 109); view.setUint8(14, 116); view.setUint8(15, 32);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data chunk
  view.setUint8(36, 100); view.setUint8(37, 97); view.setUint8(38, 116); view.setUint8(39, 97);
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < targetSamples.length; i++) {
    const s = Math.max(-1, Math.min(1, targetSamples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export const voiceService = new VoiceService();
