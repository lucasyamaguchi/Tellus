import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Square, 
  X, 
  BookOpen, 
  Sparkles, 
  RotateCcw, 
  Save, 
  MessageSquare, 
  Radio, 
  Sliders, 
  GraduationCap,
  ChevronDown,
  FileText,
  BookMarked,
  ExternalLink,
  CheckCircle2,
  Eye,
  PenTool,
  Play
} from 'lucide-react';
import { voiceService, VoiceOption, FISH_VOICE_PRESETS, VoiceProvider } from '../services/voiceService';
import { api } from '../api';
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

export function parseLiveResponse(rawText: string): ParsedLiveResponse {
  let spokenText = '';
  let noteData: ParsedLiveResponse['noteData'] | undefined;
  let detailsText: string | undefined;

  // 1. Extract [FALA]...[/FALA]
  const falaMatch = rawText.match(/\[FALA\]([\s\S]*?)(?:\[\/FALA\]|(?=\[NOTA|\[DETALHES)|$)/i);
  if (falaMatch && falaMatch[1].trim()) {
    spokenText = falaMatch[1].trim();
  } else {
    // If model didn't wrap in [FALA], take text prior to [NOTA or [DETALHES
    const beforeAction = rawText.split(/\[NOTA|\[DETALHES/i)[0].trim();
    spokenText = beforeAction || rawText.trim();
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
  onTransferToChat?: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  initialTopic?: string;
  onOpenNote?: (noteTitle: string) => void;
}

type LiveVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  activeModel,
  onTransferToChat,
  initialTopic = 'Estudos e Revisão Geral',
  onOpenNote
}) => {
  const [voiceState, setVoiceState] = useState<LiveVoiceState>('idle');
  const [topic, setTopic] = useState<string>(initialTopic);
  const [isHandsFree, setIsHandsFree] = useState<boolean>(true);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [latestAiResponse, setLatestAiResponse] = useState<string>('');
  const [latestAiSpoken, setLatestAiSpoken] = useState<string>('');
  const [latestCreatedNote, setLatestCreatedNote] = useState<{ title: string; folder: string; content: string } | null>(null);
  const [sessionNotes, setSessionNotes] = useState<Array<{ title: string; folder: string; content: string }>>([]);
  const [viewingNoteContent, setViewingNoteContent] = useState<{ title: string; folder: string; content: string } | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  
  // Voice & Settings
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(voiceService.getVoiceProvider());
  const [fishVoiceId, setFishVoiceId] = useState<string>(voiceService.getFishVoiceId() || FISH_VOICE_PRESETS[0].id);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isSavedToVault, setIsSavedToVault] = useState<boolean>(false);

  // References
  const recognizerRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<(() => void) | null>(null);
  const isComponentMounted = useRef<boolean>(true);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      stopAll();
    };
  }, []);

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

    // If hands free and open, start listening after a brief delay
    if (isHandsFree) {
      const timer = setTimeout(() => {
        startListening();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const stopAll = () => {
    voiceService.stop();
    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch {}
      recognizerRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current();
      abortControllerRef.current = null;
    }
    setVoiceState('idle');
  };

  const startListening = () => {
    if (!voiceService.isSpeechRecognitionAvailable()) {
      alert('Seu navegador ou ambiente não suporta Web Speech Recognition. Você pode usar o Whisper nas mensagens normais.');
      return;
    }

    voiceService.stop();
    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch {}
    }

    setVoiceState('listening');
    setCurrentTranscript('');

    try {
      recognizerRef.current = voiceService.createSpeechRecognizer({
        lang: 'pt-BR',
        onStart: () => {
          setVoiceState('listening');
        },
        onResult: (transcript, isFinal) => {
          setCurrentTranscript(transcript);

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          if (isFinal) {
            handleUserSpeechCompleted(transcript);
          } else if (isHandsFree && transcript.trim().length > 3) {
            // If hands free, wait for 1.5s of silence after interim text to submit
            silenceTimeoutRef.current = setTimeout(() => {
              handleUserSpeechCompleted(transcript);
            }, 1600);
          }
        },
        onError: (err) => {
          console.warn('[LiveVoice] Recognition error:', err);
          if (err !== 'no-speech') {
            setVoiceState('idle');
          }
        },
        onEnd: () => {
          // If still in listening state and hands-free, restart
          if (voiceState === 'listening' && isHandsFree && isComponentMounted.current) {
            try {
              recognizerRef.current?.start();
            } catch {
              // ignore
            }
          }
        }
      });

      recognizerRef.current.start();
    } catch (e: any) {
      console.error('[LiveVoice] Failed to start recognition:', e);
      setVoiceState('idle');
    }
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

    setVoiceState('thinking');
    const updatedHistory = [...conversationHistory, { role: 'user' as const, content: text }];
    setConversationHistory(updatedHistory);

    // Call LLM with strict oral speech vs written action separation
    const liveSystemPrompt = `[🎙️ MODO LIVE VOICE & ASSISTENTE INTELIGENTE]
- Você é a assistente pessoal do usuário em uma conversa ao vivo por VOZ sobre o tema: "${topic}".
- Responda OBRIGATORIAMENTE em PORTUGUÊS DO BRASIL (pt-BR).
- Seu tom deve ser natural, inteligente, amigável, acolhedor e ágil, como uma pessoa real conversando.

[REGRA DE OURO: SEPARAÇÃO ENTRE FALA ORAL E ESCRITA NO VAULT]
Para manter a conversa natural e fluida SEM gastar voz e tokens à toa lendo textos longos:
Sua resposta DEVE ser estruturada estritamente nas seguintes tags:

[FALA]
Aqui você coloca EXATAMENTE o que vai dizer em voz alta para o usuário.
- Limite: NO MÁXIMO 1 a 3 frases curtas, naturais e diretas (cerca de 20 a 45 palavras).
- Soe como uma companheira de estudo real falando: simpática, objetiva e empática.
- Responda à pergunta central imediatamente em tom oral.
- Se o usuário pediu uma anotação, pesquisa ou desenvolvimento (ex: "faça uma anotação, página X, frase Y, o que ela significaria hoje?"):
  Responda resumindo o significado em uma ou duas frases faladas e avise com naturalidade: "Fiz a anotação aqui! A frase significa principalmente que... vou colocar mais alguns detalhes e fontes nas suas notas agora mesmo."
- NUNCA use markdown complexo, listas longas, blocos de código ou tabelas dentro de [FALA].
[/FALA]

[NOTA: Título Claro da Nota | Pasta Sugerida no Vault]
(Gere esta tag SEMPRE que o usuário disser "anote isso", "faça uma anotação", citar livros/páginas, ou quando a reflexão merecer um registro permanente no cofre).
Escreva a nota completa em Markdown:
# Título da Nota
> Trecho ou citação com referência (Livro, página, autor).

## 📌 Contexto & Significado Central
Explicação detalhada e fundamentada do conceito.

## 🌍 O Que Ela Significa Hoje? (Aplicação Contemporânea)
Como esse conceito se aplica na sociedade atual, relações humanas, política, tecnologia, etc.

## 🤖 Reflexões e Comentários da Assistente
Seus comentários críticos, conexões e insights pessoais para enriquecer o pensamento do usuário.

## 📚 Fontes Pesquisadas & Leituras Complementares
Autores relacionados, obras de referência e conexões conceituais [[Wikilinks]].
[/NOTA]

[DETALHES]
(Opcional, use apenas se NÃO gerou uma [NOTA], mas quiser deixar 2 ou 3 tópicos complementares para o usuário ler silenciosamente na tela sem você precisar ler em voz alta).
[/DETALHES]`;

    let accumulatedText = '';

    try {
      const messagesPayload = [
        { role: 'system', content: liveSystemPrompt },
        ...updatedHistory.slice(-6).map(m => ({ role: m.role, content: m.content }))
      ];

      // Stream response from agent
      const cancelFn = api.streamChat(
        messagesPayload,
        activeModel,
        'openrouter',
        undefined,
        true,
        undefined,
        (event: { type: string; data: any }) => {
          if (event.type === 'content') {
            accumulatedText += event.data || '';
            setLatestAiResponse(accumulatedText);
            
            // Live update spoken text preview if available
            const partialParsed = parseLiveResponse(accumulatedText);
            if (partialParsed.spokenText) {
              setLatestAiSpoken(partialParsed.spokenText);
            }
          }
        },
        () => {
          // Streaming done
          handleAiSpeechReady(accumulatedText, updatedHistory);
        },
        (err: any) => {
          console.error('[LiveVoice] Chat error:', err);
          setVoiceState('idle');
        }
      );
      abortControllerRef.current = cancelFn;
    } catch (err) {
      console.error('[LiveVoice] Failed to request LLM:', err);
      setVoiceState('idle');
    }
  };

  const handleAiSpeechReady = async (aiText: string, updatedHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    if (!aiText.trim()) {
      setVoiceState('idle');
      return;
    }

    const parsed = parseLiveResponse(aiText);
    const textToSpeak = parsed.spokenText || aiText.split(/\[NOTA|\[DETALHES/i)[0].trim();
    setLatestAiSpoken(textToSpeak);

    // Auto-save rich note to Vault if generated
    if (parsed.noteData && parsed.noteData.title && parsed.noteData.content) {
      try {
        await api.saveNote({
          title: parsed.noteData.title,
          folder: parsed.noteData.folder,
          subject: topic,
          content: parsed.noteData.content,
          isProjectSpecific: false
        });
        setLatestCreatedNote(parsed.noteData);
        setSessionNotes(prev => [...prev, parsed.noteData!]);
      } catch (err) {
        console.error('[LiveVoice] Failed to auto-save note to Vault:', err);
      }
    }

    // Build rich history content for export / vault sessions
    let historyEntry = textToSpeak;
    if (parsed.noteData) {
      historyEntry += `\n\n> 📝 **Nota salva no Vault:** \`[[${parsed.noteData.title}]]\` na pasta *${parsed.noteData.folder}*\n\n${parsed.noteData.content}`;
    } else if (parsed.detailsText) {
      historyEntry += `\n\n> ℹ️ **Detalhes Complementares:**\n${parsed.detailsText}`;
    }

    setConversationHistory([...updatedHistory, { role: 'assistant', content: historyEntry }]);
    setVoiceState('speaking');

    // Speak ONLY the concise oral portion (avoids wasting tokens, prevents long monotone speeches)
    voiceService.speak(textToSpeak, {
      forceProvider: voiceProvider,
      referenceId: fishVoiceId,
      voiceURI: selectedVoiceUri,
      rate: speechRate,
      onStart: () => {
        setVoiceState('speaking');
      },
      onEnd: () => {
        if (!isComponentMounted.current) return;
        setVoiceState('idle');
        // If hands-free, automatically resume listening
        if (isHandsFree) {
          setTimeout(() => {
            if (isComponentMounted.current) startListening();
          }, 600);
        }
      },
      onError: () => {
        setVoiceState('idle');
      }
    });
  };

  const handleInterrupt = () => {
    stopAll();
  };

  const handleSaveToVault = async () => {
    if (conversationHistory.length === 0) return;
    try {
      const now = new Date();
      const title = `Sessão de Voz - ${topic.slice(0, 30)} - ${now.toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
      const content = `# 🎙️ ${title}\n\n**Data:** ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}\n**Tema de Estudo:** ${topic}\n**Modelo:** ${activeModel}\n\n---\n\n## Diálogo da Sessão\n\n` +
        conversationHistory.map(m => `**${m.role === 'user' ? '👤 Você' : '🤖 Assistente'}:**\n${m.content}\n`).join('\n---\n\n');

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

  const handleExportToChat = () => {
    if (conversationHistory.length === 0) return;
    onTransferToChat?.(conversationHistory);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in select-none">
      <div className="bg-[#0b0e14] border border-card-border/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col relative">
        
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
        <div className="p-4 sm:p-5 border-b border-card-border/70 flex items-center justify-between relative z-10 bg-card/40">
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
                  {voiceState === 'listening' ? 'Ouvindo você...' :
                   voiceState === 'thinking' ? 'Pensando...' :
                   voiceState === 'speaking' ? 'Falando...' : 'Pronto'}
                </span>

                {/* Active Voice Provider Badge */}
                <button 
                  type="button"
                  onClick={() => setShowSettings(prev => !prev)}
                  className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-[10px] text-brand-cyan hover:bg-brand-cyan/20 transition-all shadow-sm"
                  title="Clique para alternar voz"
                >
                  <Sparkles className="w-3 h-3 text-brand-cyan" />
                  <span className="font-semibold">
                    {voiceProvider === 'fish-audio'
                      ? (FISH_VOICE_PRESETS.find(p => p.id === fishVoiceId)?.name.split(' ')[0] || 'Fish Audio')
                      : 'Voz do Sistema'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Conversação e estudo contínuo em tempo real por voz</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center space-x-1 ${
                showSettings ? 'bg-accent/20 border-accent text-accent-light' : 'bg-panel border-card-border text-slate-400 hover:text-white'
              }`}
              title="Configurações de Voz"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-panel hover:bg-card-border text-slate-400 hover:text-white border border-card-border transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Study Topic Input & Presets Bar */}
        <div className="p-3.5 bg-panel/40 border-b border-card-border/60 relative z-10 space-y-2">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Tema de Estudo (ex: Sabotagem SPREGULA, Docker, Treino de Entrevista)..."
              className="flex-1 bg-card border border-card-border/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent font-medium"
            />
          </div>
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-[10px]">
            <span className="text-slate-500 shrink-0 font-mono">Sugestões:</span>
            {['Concurso SPREGULA', 'Treino de Entrevista', 'Perguntas e Respostas', 'Arquitetura de Dados', 'Revisão Rápida'].map(p => (
              <button
                key={p}
                onClick={() => setTopic(p)}
                className={`px-2 py-0.5 rounded-lg border transition-all whitespace-nowrap ${
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
          <div className="p-3.5 bg-card/90 border-b border-card-border relative z-10 space-y-3 text-xs animate-in slide-in-from-top-2">
            {/* Mechanism Toggle */}
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all ${
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all ${
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
                onClick={() => {
                  voiceService.speak('Olá! Testando a síntese de voz do Tellus em tempo real.', {
                    forceProvider: voiceProvider,
                    referenceId: fishVoiceId,
                    voiceURI: selectedVoiceUri,
                    rate: speechRate
                  });
                }}
                className="px-3 py-1 rounded-xl bg-panel hover:bg-card-border border border-card-border text-slate-300 hover:text-white text-[11px] flex items-center space-x-1.5 transition-colors"
              >
                <Play className="w-3 h-3 fill-slate-300" />
                <span>Testar Áudio</span>
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
                        className={`text-left p-2.5 rounded-xl border transition-all ${
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
                        className={`flex-1 py-1 rounded-lg border text-[10px] font-mono transition-all ${
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

        {/* Central Stage: Futuristic Glowing Soundwave Orb */}
        <div className="p-8 sm:p-12 flex flex-col items-center justify-center relative min-h-[300px]">
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
                  stopAll();
                } else {
                  startListening();
                }
              }}
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl cursor-pointer transition-all duration-500 relative z-10 select-none ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 ring-4 ring-purple-500/40 shadow-purple-500/50 scale-105'
                  : voiceState === 'thinking'
                  ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 ring-4 ring-cyan-500/40 shadow-cyan-500/50 animate-pulse'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 ring-4 ring-emerald-500/40 shadow-emerald-500/50 scale-105'
                  : 'bg-gradient-to-tr from-panel to-card ring-2 ring-card-border shadow-black/60 hover:scale-105 hover:ring-accent/50'
              }`}
            >
              {voiceState === 'listening' ? (
                <Mic className="w-10 h-10 text-white animate-bounce" />
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
              {voiceState === 'listening' ? 'Estou ouvindo... Fale sua pergunta ou comentário' :
               voiceState === 'thinking' ? 'Raciocinando resposta...' :
               voiceState === 'speaking' ? 'Reproduzindo áudio (clique no orbe para pausar)' :
               'Clique no orbe ou no botão abaixo para começar a falar'}
            </span>
            <span className="text-[11px] text-slate-400 block font-mono">
              {isHandsFree ? 'Modo Mãos-Livres Ativo (detecção automática)' : 'Modo Manual / Push-to-Talk'}
            </span>
          </div>

          {/* Real-time Subtitles / Live Transcript Floating Card */}
          {(currentTranscript || latestAiSpoken || latestAiResponse || latestCreatedNote) && (
            <div className="w-full max-w-xl mt-6 p-4 rounded-2xl bg-card/90 border border-card-border/80 shadow-2xl backdrop-blur-md space-y-2.5 text-xs relative z-10 animate-in fade-in">
              {currentTranscript && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-purple-300 font-mono flex items-center space-x-1">
                    <Mic className="w-3 h-3 text-purple-400" />
                    <span>Você disse:</span>
                  </span>
                  <p className="text-slate-100 italic text-sm leading-relaxed">"{currentTranscript}"</p>
                </div>
              )}

              {(latestAiSpoken || latestAiResponse) && (
                <div className="space-y-1 pt-2 border-t border-card-border/50">
                  <span className="text-[10px] font-bold uppercase text-emerald-300 font-mono flex items-center space-x-1">
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    <span>Assistente (Fala):</span>
                  </span>
                  <p className="text-slate-100 text-sm font-medium leading-relaxed">
                    {latestAiSpoken || parseLiveResponse(latestAiResponse).spokenText}
                  </p>
                </div>
              )}

              {/* Automatic Vault Note Created Badge Card */}
              {latestCreatedNote && (
                <div className="mt-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center justify-between gap-3 text-xs animate-in zoom-in-95">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                      <BookMarked className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-amber-200 truncate">{latestCreatedNote.title}</span>
                        <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded-full font-mono shrink-0">
                          Salva no Vault
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate">📂 {latestCreatedNote.folder} • Anotação estruturada & fontes</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewingNoteContent(latestCreatedNote)}
                      className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-300 hover:text-white text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                      title="Pré-visualizar nota completa na janela"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const title = latestCreatedNote.title;
                        onOpenNote?.(title);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-200 hover:text-white text-[11px] font-semibold flex items-center space-x-1 transition-all shadow-xs cursor-pointer"
                      title="Abrir nota no editor do FrankMD Vault"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir no Vault</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-4 border-t border-card-border/80 bg-card/60 relative z-10 flex flex-wrap items-center justify-between gap-3">
          {/* Hands Free Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isHandsFree;
              setIsHandsFree(next);
              if (!next) stopAll();
              else startListening();
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-all ${
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
                  if (currentTranscript.trim()) {
                    handleUserSpeechCompleted(currentTranscript);
                  } else {
                    stopAll();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Concluir Fala</span>
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

          {/* Export & Save Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSaveToVault}
              disabled={conversationHistory.length === 0}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                isSavedToVault
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-panel hover:bg-card-border border-card-border text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer'
              }`}
              title="Salvar diálogo como nota estruturada no FrankMD Vault"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavedToVault ? 'Salvo no Vault!' : 'Salvar no Vault'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportToChat}
              disabled={conversationHistory.length === 0}
              className="px-3 py-1.5 rounded-xl bg-accent/20 hover:bg-accent border border-accent/40 text-accent-light hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all disabled:opacity-40 cursor-pointer"
              title="Inserir histórico de voz no chat principal"
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
