// Voice Service for Tellus: TTS (Text-to-Speech) & STT (Speech-to-Text)

export interface VoiceOption {
  uri: string;
  name: string;
  lang: string;
  isPortuguese: boolean;
  isDefault: boolean;
}

const STORAGE_VOICE_KEY = 'tellus_selected_voice_uri';
const STORAGE_RATE_KEY = 'tellus_speech_rate';
const STORAGE_AUTOSPEAK_KEY = 'tellus_auto_speak';

class VoiceService {
  private voices: SpeechSynthesisVoice[] = [];
  private onVoicesLoadedCallbacks: Array<() => void> = [];

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

  public speak(
    text: string,
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

    this.stop();

    const clean = this.cleanTextForSpeech(text);
    if (!clean) {
      options?.onEnd?.();
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }

  public testVoice(voiceURI: string, onEnd?: () => void) {
    this.speak('Olá! Esta é uma demonstração da voz selecionada no Tellus.', {
      voiceURI,
      onEnd
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
