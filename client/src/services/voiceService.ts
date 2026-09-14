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
    id: '5161d41404314212af1254556477c17d',
    name: '元気な女性 (Mulher Alegre)',
    description: 'Timbre doce, carismático e expressivo (estilo anime/assistente virtual)',
    lang: 'Multilíngue (pt-BR)'
  },
  {
    id: 'ec6303f4ed0c435b9f8cdf7530e590c7',
    name: '元気な若声 (Jovem e Animada)',
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

    const utterance = new SpeechSynthesisUtterance(clean);
    
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

    utterance.rate = options?.rate || this.getSpeechRate();
    utterance.pitch = 1.0;

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

  // --- Speech-to-Text (STT) ---

  public isSpeechRecognitionAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public createSpeechRecognizer(callbacks: {
    onResult: (transcript: string, isFinal: boolean) => void;
    onError?: (err: any) => void;
    onEnd?: () => void;
    onStart?: () => void;
    lang?: string;
  }) {
    if (!this.isSpeechRecognitionAvailable()) {
      throw new Error('Reconhecimento de fala não suportado neste navegador/ambiente.');
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognizer = new SpeechRec();

    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = callbacks.lang || 'pt-BR';

    recognizer.onstart = () => {
      callbacks.onStart?.();
    };

    recognizer.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      if (finalTranscript) {
        callbacks.onResult(finalTranscript, true);
      } else if (interimTranscript) {
        callbacks.onResult(interimTranscript, false);
      }
    };

    recognizer.onerror = (event: any) => {
      callbacks.onError?.(event.error);
    };

    recognizer.onend = () => {
      callbacks.onEnd?.();
    };

    return recognizer;
  }
}

export const voiceService = new VoiceService();
