import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Square, 
  X, 
  Sparkles, 
  Save, 
  MessageSquare, 
  Radio, 
  Sliders, 
  GraduationCap,
  BookMarked,
  ExternalLink,
  CheckCircle2,
  Eye,
  Play,
  AlertCircle,
  Columns
} from 'lucide-react';
import { 
  voiceService, 
  VoiceOption, 
  FISH_VOICE_PRESETS, 
  VoiceProvider,
  generateThinkingAcknowledgement,
  extractConciseSpokenSummary
} from '../services/voiceService';
import { voiceToneAnalyzer, ToneAnalysisResult } from '../services/voiceToneAnalyzer';
import { api } from '../api';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ParsedLiveResponse {
  spokenText: string;
  noteData?: {
    title: string;
    folder: string;
    content: string;
  };
  detailsText?: string;
}

export function parseLiveResponse(rawText: string, tone?: ToneAnalysisResult | null): ParsedLiveResponse {
  let spokenText = '';
  let noteData: ParsedLiveResponse['noteData'] | undefined;
  let detailsText: string | undefined;

  // 1. Extract [FALA]...[/FALA]
  const falaMatch = rawText.match(/\[FALA\]([\s\S]*?)(?:\[\/FALA\]|(?=\[NOTA|\[DETALHES)|$)/i);
  if (falaMatch && falaMatch[1].trim()) {
    spokenText = falaMatch[1].trim();
  } else {
    // If model didn't wrap in [FALA], extract concise spoken summary
    spokenText = extractConciseSpokenSummary(rawText, tone);
  }

  // 2. Extract [NOTA: Title | Folder] ... [/NOTA]
  const noteMatch = rawText.match(/\[NOTA:\s*([^\|\]\n]+)(?:\s*\|\s*([^\]\n]+))?\]([\s\S]*?)(?:\[\/NOTA\]|$)/i);
  if (noteMatch && noteMatch[3].trim()) {
    const rawTitle = noteMatch[1].trim();
    const rawFolder = noteMatch[2]?.trim() || 'Estudos/Anotacoes de Leitura';
    const noteContent = noteMatch[3].replace(/\[\/NOTA\]/gi, '').trim();
    
    noteData = {
      title: rawTitle,
      folder: rawFolder,
      content: noteContent
    };
  }

  // 3. Extract [DETALHES] ... [/DETALHES]
  const detailsMatch = rawText.match(/\[DETALHES\]([\s\S]*?)(?:\[\/DETALHES\]|$)/i);
  if (detailsMatch && detailsMatch[1].trim()) {
    detailsText = detailsMatch[1].replace(/\[\/DETALHES\]/gi, '').trim();
  }

  // Se o modelo criou uma nota e não gerou texto falado prévio:
  if ((!spokenText || spokenText.startsWith('[NOTA') || spokenText.startsWith('#')) && noteData) {
    spokenText = `Criei a anotação "${noteData.title}" na pasta "${noteData.folder}" no seu cofre.`;
  } else if (!spokenText) {
    spokenText = extractConciseSpokenSummary(rawText, tone);
  }

  // Clean up any markdown syntax that degrades TTS speech quality
  spokenText = spokenText
    .replace(/^\[FALA\]/i, '')
    .replace(/\[\/FALA\]$/i, '')
    .replace(/\*\*/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();

  return { spokenText, noteData, detailsText };
}

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: string;
  messages?: Message[];
  isStreaming?: boolean;
  onSendMessage?: (content: string) => void;
  onStopStreaming?: () => void;
  onTransferToChat?: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  initialTopic?: string;
  onOpenNote?: (noteTitle: string) => void;
}

type LiveVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  activeModel,
  messages = [],
  isStreaming = false,
  onSendMessage,
  onStopStreaming,
  initialTopic = 'Estudos e Revisão Geral',
  onOpenNote
}) => {
  const [layoutMode, setLayoutMode] = useState<'split' | 'orb_only'>('split');
  const [voiceState, setVoiceState] = useState<LiveVoiceState>('idle');
  const voiceStateRef = useRef<LiveVoiceState>('idle');
  const [topic, setTopic] = useState<string>(initialTopic);
  const [isHandsFree, setIsHandsFree] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('tellus_live_voice_hands_free');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const isHandsFreeRef = useRef<boolean>(true);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [latestAiResponse, setLatestAiResponse] = useState<string>('');
  const [latestAiSpoken, setLatestAiSpoken] = useState<string>('');
  const [latestCreatedNote, setLatestCreatedNote] = useState<{ title: string; folder: string; content: string } | null>(null);
  const [viewingNoteContent, setViewingNoteContent] = useState<{ title: string; folder: string; content: string } | null>(null);
  
  // Voice & Settings
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(voiceService.getVoiceProvider());
  const [fishVoiceId, setFishVoiceId] = useState<string>(voiceService.getFishVoiceId() || FISH_VOICE_PRESETS[0].id);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isSavedToVault, setIsSavedToVault] = useState<boolean>(false);
  const [isTestingAudio, setIsTestingAudio] = useState<boolean>(false);
  const isTestingAudioRef = useRef<boolean>(false);
  const [detectedUserTone, setDetectedUserTone] = useState<ToneAnalysisResult | null>(null);
  const [micErrorMsg, setMicErrorMsg] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);

  // References
  const recognizerRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<any>(null);
  const isComponentMounted = useRef<boolean>(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const prevIsStreamingRef = useRef<boolean>(false);

  // Helper to ensure voiceState and voiceStateRef are always in lockstep
  const updateVoiceState = (state: LiveVoiceState) => {
    voiceStateRef.current = state;
    setVoiceState(state);
  };

  useEffect(() => {
    isHandsFreeRef.current = isHandsFree;
  }, [isHandsFree]);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      stopAll();
    };
  }, []);

  // Auto-scroll chat view when new messages or chunks arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Listen for agent streaming completion to speak concise response without duplication
  useEffect(() => {
    if (!isOpen) return;

    if (prevIsStreamingRef.current && !isStreaming) {
      // Stream just completed!
      if (messages && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
          const parsed = parseLiveResponse(lastMsg.content, detectedUserTone);
          setLatestAiResponse(lastMsg.content);
          setLatestAiSpoken(parsed.spokenText);
          if (parsed.noteData) {
            setLatestCreatedNote(parsed.noteData);
          }

          updateVoiceState('speaking');
          voiceService.speakMessageSummary(lastMsg.id, lastMsg.content, detectedUserTone, {
            forceProvider: voiceProvider,
            referenceId: fishVoiceId,
            voiceURI: selectedVoiceUri,
            rate: speechRate,
            onStart: () => {
              if (isComponentMounted.current) {
                updateVoiceState('speaking');
              }
            },
            onEnd: () => {
              if (!isComponentMounted.current) return;
              updateVoiceState('idle');
              // Se modo Mãos-Livres ativo, retoma a escuta para continuar o diálogo
              if (isHandsFreeRef.current) {
                setTimeout(() => {
                  if (isComponentMounted.current && !isTestingAudioRef.current) {
                    startListening();
                  }
                }, 600);
              }
            },
            onError: () => {
              if (isComponentMounted.current) updateVoiceState('idle');
            }
          });
        } else {
          updateVoiceState('idle');
        }
      } else {
        updateVoiceState('idle');
      }
    } else if (!prevIsStreamingRef.current && isStreaming) {
      // Agent is actively working and streaming
      updateVoiceState('thinking');
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, messages, isOpen, detectedUserTone, voiceProvider, fishVoiceId, selectedVoiceUri, speechRate]);

  useEffect(() => {
    if (!isOpen) {
      stopAll();
      return;
    }

    // Load voices
    const loadVoices = () => {
      setVoiceProvider(voiceService.getVoiceProvider());
      setFishVoiceId(voiceService.getFishVoiceId() || FISH_VOICE_PRESETS[0].id);
      const opts = voiceService.getVoiceOptions();
      setVoices(opts);
      const pref = voiceService.getPreferredVoice();
      if (pref) setSelectedVoiceUri(pref.voiceURI);
      setSpeechRate(voiceService.getSpeechRate());
    };

    loadVoices();
    voiceService.onVoicesReady(loadVoices);

    // No modo Mãos-Livres, inicia a escuta automaticamente ao abrir o modal
    let autoStartTimer: any = null;
    if (isHandsFreeRef.current) {
      autoStartTimer = setTimeout(() => {
        if (isComponentMounted.current && !isTestingAudioRef.current) {
          startListening();
        }
      }, 400);
    }

    return () => {
      if (autoStartTimer) clearTimeout(autoStartTimer);
    };
  }, [isOpen]);

  const stopAll = () => {
    isTestingAudioRef.current = false;
    setIsTestingAudio(false);
    voiceService.stop();
    voiceService.releaseMicrophone();
    voiceToneAnalyzer.cleanup();
    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch {}
      recognizerRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    updateVoiceState('idle');
  };

  const startListening = async () => {
    if (!voiceService.isSpeechRecognitionAvailable()) {
      setMicErrorMsg('Seu navegador ou ambiente não suporta Web Speech Recognition nativo. Utilize Google Chrome ou Edge.');
      return;
    }

    if (isTestingAudioRef.current) {
      voiceService.stop();
      isTestingAudioRef.current = false;
      setIsTestingAudio(false);
    }

    // Do not double-start if already actively listening
    if (voiceStateRef.current === 'listening' && recognizerRef.current) {
      return;
    }

    if (!isComponentMounted.current) return;

    // 1. Explicitly prompt and verify microphone permission via getUserMedia
    const micCheck = await voiceService.requestMicrophoneAccess();
    if (!micCheck.granted) {
      setMicErrorMsg(micCheck.error || 'Permissão de microfone negada ou bloqueada.');
      updateVoiceState('idle');
      return;
    }
    setMicErrorMsg(null);

    voiceService.stop();
    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch {}
      recognizerRef.current = null;
    }

    updateVoiceState('listening');
    setCurrentTranscript('');

    // Start real-time acoustic tone analysis alongside SpeechRecognition using the verified stream
    try {
      voiceToneAnalyzer.start(micCheck.stream).catch(err => {
        console.warn('[LiveVoice] Tone analyzer start failed:', err);
      });
    } catch {}

    try {
      const recognizer = voiceService.createSpeechRecognizer({
        lang: 'pt-BR',
        onStart: () => {
          if (isComponentMounted.current) {
            updateVoiceState('listening');
            setMicErrorMsg(null);
            setIsUserSpeaking(false);
            setIsTranscribingAudio(false);
          }
        },
        onVolume: (vol) => {
          if (isComponentMounted.current) {
            setMicVolume(vol);
          }
        },
        onSpeakingChange: (speaking) => {
          if (isComponentMounted.current) {
            setIsUserSpeaking(speaking);
          }
        },
        onProcessing: (proc) => {
          if (isComponentMounted.current) {
            setIsTranscribingAudio(proc);
            if (proc) {
              updateVoiceState('thinking');
            }
          }
        },
        onResult: (transcript, isFinal) => {
          if (!isComponentMounted.current) return;
          setCurrentTranscript(transcript);
          setIsTranscribingAudio(false);

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          if (isFinal) {
            handleUserSpeechCompleted(transcript);
          } else if (isHandsFreeRef.current && transcript.trim().length > 2) {
            // Em modo Mãos-Livres, 1.2s de silêncio após falar conclui e envia IMEDIATAMENTE ao chat
            silenceTimeoutRef.current = setTimeout(() => {
              if (isComponentMounted.current && (voiceStateRef.current === 'listening' || voiceStateRef.current === 'idle')) {
                handleUserSpeechCompleted(transcript);
              }
            }, 1200);
          }
        },
        onError: (err) => {
          console.warn('[LiveVoice] Recognition error:', err);
          setIsTranscribingAudio(false);
          setIsUserSpeaking(false);
          if (err === 'not-allowed') {
            setMicErrorMsg(voiceService.isElectron() 
              ? 'Microfone não autorizado no Windows. Verifique Configurações > Privacidade e Segurança > Microfone.' 
              : 'Microfone bloqueado: Permita o acesso ao microfone no navegador.');
          } else if (err === 'network') {
            return;
          } else if (err !== 'no-speech' && err !== 'aborted') {
            setMicErrorMsg(`Aviso de captura de áudio: ${err}`);
          }
          if (err !== 'no-speech' && err !== 'aborted') {
            if (isComponentMounted.current) {
              updateVoiceState('idle');
            }
          }
        },
        onEnd: () => {
          setIsUserSpeaking(false);
          setMicVolume(0);
          if (
            isComponentMounted.current &&
            voiceStateRef.current === 'listening' &&
            isHandsFreeRef.current &&
            !isTestingAudioRef.current
          ) {
            setTimeout(() => {
              if (
                isComponentMounted.current &&
                voiceStateRef.current === 'listening' &&
                isHandsFreeRef.current &&
                !isTestingAudioRef.current
              ) {
                try {
                  recognizerRef.current?.start();
                } catch {}
              }
            }, 250);
          } else if (voiceStateRef.current === 'listening' && !isHandsFreeRef.current) {
            if (isComponentMounted.current) {
              updateVoiceState('idle');
            }
          }
        }
      });

      recognizerRef.current = recognizer;
      recognizer.start();
    } catch (e: any) {
      console.error('[LiveVoice] Failed to start recognition:', e);
      if (isComponentMounted.current) {
        updateVoiceState('idle');
      }
    }
  };

  const handleTestAudio = () => {
    if (isTestingAudio) {
      voiceService.stop();
      isTestingAudioRef.current = false;
      setIsTestingAudio(false);
      if (isHandsFreeRef.current) {
        startListening();
      }
      return;
    }

    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch {}
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    isTestingAudioRef.current = true;
    setIsTestingAudio(true);

    const testPhrase = voiceProvider === 'fish-audio'
      ? (fishVoiceId === '82d13948027e4be69892dd3d0104e681'
          ? 'Olá! Eu sou o Jarvis. Síntese de voz em alta definição conectada com sucesso no Tellus.'
          : fishVoiceId === '2714f32ab7f8475fa45e277f840c8c23'
          ? 'Oie! Ahri pronta para estudar com você no Tellus. Áudio e voz funcionando perfeitamente!'
          : 'Olá! Testando a síntese de voz do Tellus em tempo real.')
      : 'Olá! Testando a voz nativa do sistema no Tellus.';

    voiceService.speak(testPhrase, {
      forceProvider: voiceProvider,
      referenceId: fishVoiceId,
      voiceURI: selectedVoiceUri,
      rate: speechRate,
      onStart: () => {
        if (isComponentMounted.current) {
          isTestingAudioRef.current = true;
          setIsTestingAudio(true);
        }
      },
      onEnd: () => {
        if (!isComponentMounted.current) return;
        isTestingAudioRef.current = false;
        setIsTestingAudio(false);
        if (isHandsFreeRef.current) {
          setTimeout(() => {
            if (isComponentMounted.current && !isTestingAudioRef.current) {
              startListening();
            }
          }, 400);
        }
      },
      onError: (err) => {
        console.error('[LiveVoice] Erro no teste de áudio:', err);
        if (!isComponentMounted.current) return;
        isTestingAudioRef.current = false;
        setIsTestingAudio(false);
      }
    });
  };

  const handleUserSpeechCompleted = async (spokenText: string) => {
    const text = spokenText.trim();
    if (!text || text.length < 2) return;

    if (recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch {}
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    // Stop and classify acoustic + semantic voice tone
    const toneResult = voiceToneAnalyzer.stopAndAnalyze(text);
    setDetectedUserTone(toneResult);

    // Immediate contextual vocal acknowledgement (instant vocal feedback showing Tellus is thinking)
    const ackPhrase = generateThinkingAcknowledgement(text, toneResult);
    updateVoiceState('thinking');
    setLatestAiSpoken(ackPhrase);

    // Speak immediate acknowledgement with emotion mirroring
    voiceService.speak(ackPhrase, {
      forceProvider: voiceProvider,
      referenceId: fishVoiceId,
      voiceURI: selectedVoiceUri,
      rate: speechRate
    });

    // Envia IMEDIATAMENTE para o chat e aciona o agent loop sem exigir confirmação manual!
    if (onSendMessage) {
      onSendMessage(text);
    }
  };

  const handleInterrupt = () => {
    voiceService.stop();
    if (isStreaming && onStopStreaming) {
      onStopStreaming();
    }
    updateVoiceState('idle');
  };

  const handleSaveToVault = async () => {
    if (messages.length === 0) return;
    try {
      const now = new Date();
      const title = `Sessão de Voz - ${topic.slice(0, 30)} - ${now.toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
      const content = `# 🎙️ ${title}\n\n**Data:** ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}\n**Tema de Estudo:** ${topic}\n**Modelo:** ${activeModel}\n\n---\n\n## Diálogo da Sessão\n\n` +
        messages.map(m => `**${m.role === 'user' ? '👤 Você' : '🤖 Assistente'}:**\n${m.content}\n`).join('\n---\n\n');

      await api.saveNote({
        title,
        folder: 'Estudos/Sessoes de Voz',
        subject: topic,
        content,
        isProjectSpecific: false
      });

      setIsSavedToVault(true);
      setTimeout(() => setIsSavedToVault(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar no cofre: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const renderOrbStage = () => (
    <div className="flex flex-col items-center justify-center flex-1 my-auto">
      {/* Animated Interactive Orb */}
      <div className="relative flex items-center justify-center my-4">
        {/* Outer Ripple Wave 1 */}
        <div className={`absolute rounded-full border transition-all duration-1000 ${
          voiceState === 'listening' ? 'w-56 h-56 border-purple-500/30 scale-110 animate-ping' :
          voiceState === 'thinking' ? 'w-56 h-56 border-cyan-500/20 rotate-180 animate-spin' :
          voiceState === 'speaking' ? 'w-56 h-56 border-emerald-500/30 scale-125 animate-pulse' :
          'w-40 h-40 border-slate-700/20 scale-100'
        }`} style={{ animationDuration: voiceState === 'thinking' ? '6s' : '2s' }} />

        {/* Outer Ripple Wave 2 */}
        <div className={`absolute rounded-full border transition-all duration-700 ${
          voiceState === 'listening' ? 'w-44 h-44 border-purple-400/40 scale-105 animate-pulse' :
          voiceState === 'thinking' ? 'w-44 h-44 border-cyan-400/30 -rotate-90 animate-spin' :
          voiceState === 'speaking' ? 'w-44 h-44 border-emerald-400/40 scale-110 animate-ping' :
          'w-32 h-32 border-slate-700/20'
        }`} style={{ animationDuration: '3s' }} />

        {/* Glowing Core Sphere */}
        <div 
          onClick={() => {
            if (voiceState === 'speaking') {
              handleInterrupt();
            } else if (voiceState === 'listening') {
              if (recognizerRef.current) {
                recognizerRef.current.stop();
              } else {
                stopAll();
              }
            } else {
              startListening();
            }
          }}
          style={{
            transform: voiceState === 'listening' ? `scale(${1 + micVolume * 0.22})` : undefined
          }}
          className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl cursor-pointer transition-all duration-300 relative z-10 select-none ${
            voiceState === 'listening'
              ? isUserSpeaking
                ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 ring-4 ring-purple-400 shadow-purple-500/80 scale-110'
                : 'bg-gradient-to-tr from-purple-600 to-indigo-500 ring-4 ring-purple-500/40 shadow-purple-500/50'
              : voiceState === 'thinking'
              ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 ring-4 ring-cyan-500/40 shadow-cyan-500/50 animate-pulse'
              : voiceState === 'speaking'
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 ring-4 ring-emerald-500/40 shadow-emerald-500/50 scale-105'
              : 'bg-gradient-to-tr from-panel to-card ring-2 ring-card-border shadow-black/60 hover:scale-105 hover:ring-accent/50'
          }`}
        >
          {voiceState === 'listening' ? (
            <Mic className={`w-10 h-10 text-white ${isUserSpeaking ? 'animate-bounce' : ''}`} />
          ) : voiceState === 'thinking' ? (
            <Sparkles className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '3s' }} />
          ) : voiceState === 'speaking' ? (
            <Volume2 className="w-10 h-10 text-white animate-pulse" />
          ) : (
            <Mic className="w-10 h-10 text-slate-400" />
          )}
        </div>
      </div>

      {/* Status Text under Orb */}
      <div className="text-center space-y-1 relative z-10 mt-2">
        <span className="font-bold text-sm text-slate-100 block">
          {isTranscribingAudio ? '⚡ Transcrevendo áudio com IA...' :
           isUserSpeaking ? '🎙️ Ouvindo você falar...' :
           voiceState === 'listening' ? 'Estou ouvindo... Fale sua pergunta ou comentário' :
           voiceState === 'thinking' ? 'Raciocinando resposta...' :
           voiceState === 'speaking' ? 'Reproduzindo áudio (clique no orbe para pausar)' :
           'Clique no orbe ou no botão abaixo para começar a falar'}
        </span>
        <span className="text-[11px] text-slate-400 block font-mono">
          {isHandsFree ? 'Modo Mãos-Livres Ativo (envio automático ao pausar fala)' : 'Modo Manual / Push-to-Talk'}
        </span>
      </div>

      {/* Microphone Diagnostic Alert Banner */}
      {micErrorMsg && (
        <div className="w-full max-w-md mt-4 p-3 rounded-2xl bg-amber-950/70 border border-amber-500/60 shadow-xl space-y-1 text-xs text-amber-200 relative z-20 animate-in fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block">Diagnóstico de Microfone:</span>
                <p className="text-[11px] text-amber-100">{micErrorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMicErrorMsg(null)}
              className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Real-time Subtitles / Live Transcript Floating Card */}
      {(currentTranscript || latestAiSpoken || latestAiResponse || latestCreatedNote || detectedUserTone) && (
        <div className="w-full max-w-md mt-5 p-3.5 rounded-2xl bg-card/90 border border-card-border/80 shadow-2xl backdrop-blur-md space-y-2 text-xs relative z-10 animate-in fade-in">
          {/* Detected User Tone Badge */}
          {detectedUserTone && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-card-border/50 text-[11px]">
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-panel border border-card-border/80 text-slate-300 font-mono">
                <span>{detectedUserTone.emoji}</span>
                <span className="text-slate-400">Tom:</span>
                <span className="font-semibold text-accent-light">{detectedUserTone.label}</span>
              </div>
              {detectedUserTone.type === 'whispering' && (
                <span className="text-[10px] text-amber-300 font-medium italic animate-pulse">
                  🤫 Sussurrando de volta...
                </span>
              )}
              {detectedUserTone.type === 'excited' && (
                <span className="text-[10px] text-emerald-300 font-medium italic animate-pulse">
                  ⚡ Respondendo com energia!
                </span>
              )}
              {detectedUserTone.type === 'calm' && (
                <span className="text-[10px] text-cyan-300 font-medium italic">
                  🌿 Tom sereno e tranquilo
                </span>
              )}
            </div>
          )}

          {currentTranscript && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-purple-300 font-mono flex items-center space-x-1">
                <Mic className="w-3 h-3 text-purple-400" />
                <span>Você disse:</span>
              </span>
              <p className="text-slate-100 italic text-xs leading-relaxed">"{currentTranscript}"</p>
            </div>
          )}

          {(latestAiSpoken || latestAiResponse) && (
            <div className="space-y-0.5 pt-1.5 border-t border-card-border/50">
              <span className="text-[10px] font-bold uppercase text-emerald-300 font-mono flex items-center space-x-1">
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span>Tellus (Fala):</span>
              </span>
              <p className="text-slate-100 text-xs font-medium leading-relaxed">
                {(latestAiSpoken || parseLiveResponse(latestAiResponse).spokenText).replace(/^\[[a-zA-Z\s_-]+\]\s*/, '')}
              </p>
            </div>
          )}

          {/* Automatic Vault Note Created Badge Card */}
          {latestCreatedNote && (
            <div className="mt-2 p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                  <BookMarked className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <span className="font-bold text-amber-200 truncate block">{latestCreatedNote.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono truncate block">📂 {latestCreatedNote.folder}</span>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewingNoteContent(latestCreatedNote)}
                  className="px-2 py-1 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-300 hover:text-white text-[10px] font-semibold flex items-center space-x-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Ver</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const title = latestCreatedNote.title;
                    onOpenNote?.(title);
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-200 hover:text-white text-[10px] font-semibold flex items-center space-x-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Vault</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-3 sm:p-5 animate-in fade-in select-none">
      <div className={`bg-[#0b0e14] border border-card-border/80 rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col relative transition-all duration-300 ${
        layoutMode === 'split' ? 'max-w-6xl h-[88vh]' : 'max-w-2xl min-h-[580px]'
      }`}>
        
        {/* Glow Background Elements */}
        <div className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          voiceState === 'listening' ? 'bg-purple-600/25' :
          voiceState === 'thinking' ? 'bg-cyan-500/25' :
          voiceState === 'speaking' ? 'bg-emerald-500/25' : 'bg-accent/10'
        }`} />
        <div className={`absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          voiceState === 'listening' ? 'bg-indigo-600/20' :
          voiceState === 'thinking' ? 'bg-blue-500/20' :
          voiceState === 'speaking' ? 'bg-teal-500/20' : 'bg-panel/30'
        }`} />

        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-card-border/70 flex items-center justify-between relative z-10 bg-card/40 shrink-0">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border shadow-md transition-colors ${
              voiceState === 'listening' ? 'bg-purple-950/60 border-purple-500 text-purple-300' :
              voiceState === 'thinking' ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300' :
              voiceState === 'speaking' ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' :
              'bg-panel border-card-border text-slate-400'
            }`}>
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-100">Live Voice Chat</h3>
                <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full uppercase font-bold border ${
                  voiceState === 'listening' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 animate-pulse' :
                  voiceState === 'thinking' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 animate-pulse' :
                  voiceState === 'speaking' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' :
                  'bg-panel border-card-border text-slate-500'
                }`}>
                  {voiceState === 'listening' ? 'Ouvindo...' :
                   voiceState === 'thinking' ? 'Pensando...' :
                   voiceState === 'speaking' ? 'Falando...' : 'Pronto'}
                </span>

                {/* Active Voice Provider Badge */}
                <button 
                  type="button"
                  onClick={() => setShowSettings(prev => !prev)}
                  className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-[10px] text-brand-cyan hover:bg-brand-cyan/20 transition-all shadow-sm cursor-pointer"
                  title="Configurar voz e áudio"
                >
                  <Sparkles className="w-3 h-3 text-brand-cyan" />
                  <span className="font-semibold">
                    {voiceProvider === 'fish-audio'
                      ? (FISH_VOICE_PRESETS.find(p => p.id === fishVoiceId)?.name.split(' ')[0] || 'Fish Audio')
                      : 'Voz do Sistema'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Conversação fluida com Tellus em tempo real</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Split / Orb Only Mode Toggle */}
            <button
              type="button"
              onClick={() => setLayoutMode(prev => prev === 'split' ? 'orb_only' : 'split')}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center space-x-1.5 cursor-pointer ${
                layoutMode === 'split' ? 'bg-accent/20 border-accent text-accent-light' : 'bg-panel border-card-border text-slate-400 hover:text-white'
              }`}
              title={layoutMode === 'split' ? 'Alternar para Modo Somente Orbe' : 'Alternar para Modo Dividido (Chat à esquerda e Orbe à direita)'}
            >
              <Columns className="w-4 h-4" />
              <span className="hidden sm:inline font-medium text-[11px]">{layoutMode === 'split' ? 'Chat + Orbe' : 'Só Orbe'}</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center space-x-1 cursor-pointer ${
                showSettings ? 'bg-accent/20 border-accent text-accent-light' : 'bg-panel border-card-border text-slate-400 hover:text-white'
              }`}
              title="Configurações de Voz"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-panel hover:bg-card-border text-slate-400 hover:text-white border border-card-border transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Study Topic Input & Presets Bar */}
        <div className="p-3 bg-panel/40 border-b border-card-border/60 relative z-10 space-y-2 shrink-0">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Tema de Estudo (ex: Segurança de Web App, Arquitetura de Dados, Revisão de Código)..."
              className="flex-1 bg-card border border-card-border/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent font-medium"
            />
          </div>
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-[10px]">
            <span className="text-slate-500 shrink-0 font-mono">Sugestões:</span>
            {['Segurança de Web App', 'Arquitetura de Dados', 'Treino de Entrevista', 'Revisão de Código', 'Concurso SPREGULA'].map(p => (
              <button
                key={p}
                onClick={() => setTopic(p)}
                className={`px-2 py-0.5 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                  topic === p ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold' : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Flyout Bar */}
        {showSettings && (
          <div className="p-3.5 bg-card/95 border-b border-card-border relative z-20 space-y-3 text-xs animate-in slide-in-from-top-2 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">Mecanismo de Voz:</span>
                <div className="flex items-center space-x-1 bg-panel p-0.5 rounded-xl border border-card-border">
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceProvider('fish-audio');
                      voiceService.setVoiceProvider('fish-audio');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                      voiceProvider === 'fish-audio'
                        ? 'bg-brand-cyan text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Fish Audio AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceProvider('system');
                      voiceService.setVoiceProvider('system');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                      voiceProvider === 'system'
                        ? 'bg-accent text-white font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Voz do Sistema</span>
                  </button>
                </div>
              </div>

              {/* Test Button */}
              <button
                type="button"
                onClick={handleTestAudio}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isTestingAudio
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                    : 'bg-panel hover:bg-card-border border-card-border text-slate-300 hover:text-white'
                }`}
                title={isTestingAudio ? 'Parar teste de áudio' : 'Ouvir demonstração da voz selecionada'}
              >
                {isTestingAudio ? (
                  <>
                    <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                    <span>Parar Teste</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-slate-300" />
                    <span>Testar Áudio</span>
                  </>
                )}
              </button>
            </div>

            {/* Presets or System Voice List */}
            {voiceProvider === 'fish-audio' ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 font-mono block">Vozes Expressivas Fish Audio:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FISH_VOICE_PRESETS.map((preset) => {
                    const isSelected = fishVoiceId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setFishVoiceId(preset.id);
                          voiceService.setFishVoiceId(preset.id);
                        }}
                        className={`text-left p-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-cyan/15 border-brand-cyan text-slate-100 shadow-sm'
                            : 'bg-panel border-card-border text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-200">{preset.name}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 font-mono block">Voz do Sistema (TTS):</label>
                  <select
                    value={selectedVoiceUri}
                    onChange={(e) => {
                      setSelectedVoiceUri(e.target.value);
                      voiceService.setPreferredVoice(e.target.value);
                    }}
                    className="w-full bg-panel border border-card-border rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    {voices.map(v => (
                      <option key={v.uri} value={v.uri}>
                        {v.isPortuguese ? '🇧🇷 ' : ''}{v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-48 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Velocidade:</span>
                    <span className="text-accent-light font-bold">{speechRate}x</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {[0.8, 1.0, 1.2, 1.5].map(r => (
                      <button
                        key={r}
                        onClick={() => {
                          setSpeechRate(r);
                          voiceService.setSpeechRate(r);
                        }}
                        className={`flex-1 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer ${
                          speechRate === r ? 'bg-accent text-white border-accent font-bold' : 'bg-panel border-card-border text-slate-400 hover:text-white'
                        }`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Central Stage: Split View (Chat on left, Orb on right) OR Focused Orb Only */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative z-10">
          {layoutMode === 'split' ? (
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden w-full">
              {/* Left Column: Live Chat Stream */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#07090e]/70 border-b md:border-b-0 md:border-r border-card-border/70 overflow-hidden">
                <div className="px-4 py-2 border-b border-card-border/60 bg-panel/30 flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-accent-light" />
                    <span>Histórico do Chat ao Vivo</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}
                  </span>
                </div>

                {/* Messages stream */}
                <div 
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3 text-xs select-text scrollbar-thin scrollbar-thumb-card-border"
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                      <Radio className="w-8 h-8 text-slate-600 animate-pulse" />
                      <p className="font-medium text-slate-300">Nenhuma mensagem no chat ainda.</p>
                      <p className="text-[11px] text-slate-500 max-w-xs">
                        Fale pelo microfone ou pelo Orbe. O Tellus responderá por voz e registrará tudo aqui.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="text-[10px] font-mono text-slate-400 px-1">
                          {msg.role === 'user' ? '👤 Você' : '🤖 Tellus'}
                        </div>
                        <div className={`p-3 rounded-2xl max-w-[90%] text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-purple-950/40 border border-purple-500/30 text-purple-100 rounded-tr-sm'
                            : 'bg-card/90 border border-card-border text-slate-200 rounded-tl-sm select-text'
                        }`}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-invert prose-xs max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content.replace(/\[FALA\][\s\S]*?\[\/FALA\]/gi, '').trim() || msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {isStreaming && (
                    <div className="flex items-center space-x-2 p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 text-xs animate-pulse">
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span>Tellus está pensando, executando tarefas e criando notas...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Glowing Orb & Real-Time Controls */}
              <div className="w-full md:w-[420px] lg:w-[450px] shrink-0 flex flex-col justify-between overflow-y-auto p-4 sm:p-6 bg-card/20">
                {renderOrbStage()}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center overflow-y-auto p-6 sm:p-10 w-full">
              {renderOrbStage()}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-3.5 sm:p-4 border-t border-card-border/80 bg-card/60 relative z-10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Hands Free Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isHandsFree;
              setIsHandsFree(next);
              isHandsFreeRef.current = next;
              try {
                localStorage.setItem('tellus_live_voice_hands_free', String(next));
              } catch {}
              if (!next) stopAll();
              else startListening();
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
              isHandsFree 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-xs' 
                : 'bg-panel border-card-border text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Mãos-Livres: {isHandsFree ? 'LIGADO' : 'DESLIGADO'}</span>
          </button>

          {/* Central Talk Button (Push-to-Talk or Interrupt) */}
          <div className="flex items-center space-x-2">
            {voiceState === 'speaking' ? (
              <button
                type="button"
                onClick={handleInterrupt}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Interromper Fala</span>
              </button>
            ) : voiceState === 'listening' ? (
              <button
                type="button"
                onClick={() => {
                  if (recognizerRef.current) {
                    recognizerRef.current.stop();
                  } else {
                    stopAll();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{isTranscribingAudio ? 'Transcrevendo...' : 'Concluir Fala'}</span>
              </button>
            ) : voiceState === 'thinking' ? (
              <button
                type="button"
                onClick={handleInterrupt}
                className="px-4 py-2 rounded-xl bg-cyan-600/60 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Pensando...</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startListening}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-accent/30 transition-all cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Falar Agora</span>
              </button>
            )}
          </div>

          {/* Save to Vault & Close */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSaveToVault}
              disabled={messages.length === 0}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                isSavedToVault
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-panel hover:bg-card-border border-card-border text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer'
              }`}
              title="Salvar diálogo como nota estruturada no Notes Module (Vault)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavedToVault ? 'Salvo no Vault!' : 'Salvar no Vault'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-accent/20 hover:bg-accent border border-accent/40 text-accent-light hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Ir para o chat principal"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ir p/ Chat</span>
            </button>
          </div>
        </div>

        {/* Full Note Inspector Overlay */}
        {viewingNoteContent && (
          <div className="absolute inset-0 z-30 bg-[#080a10]/95 backdrop-blur-md p-6 flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-card-border">
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <BookMarked className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="truncate">
                  <h4 className="font-bold text-sm text-slate-100 truncate">{viewingNoteContent.title}</h4>
                  <span className="text-[10px] font-mono text-amber-300">
                    📂 {viewingNoteContent.folder}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const title = viewingNoteContent.title;
                    setViewingNoteContent(null);
                    onOpenNote?.(title);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-amber-900/30 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir no Editor do Vault</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingNoteContent(null)}
                  className="p-1.5 rounded-xl hover:bg-card-border text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Fechar pré-visualização"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed text-slate-200 scrollbar-thin scrollbar-thumb-card-border select-text">
              <div className="prose prose-invert max-w-none text-xs leading-relaxed select-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {viewingNoteContent.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
