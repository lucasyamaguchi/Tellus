import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Square, 
  Sparkles, 
  Brain, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Terminal, 
  FileCode, 
  Database, 
  ArrowRightLeft, 
  Layers, 
  Trash2,
  Copy,
  Check,
  Paperclip,
  X,
  FileText,
  FileSpreadsheet,
  Music,
  Image as ImageIcon,
  MessageSquareQuote,
  Quote,
  ExternalLink,
  Eye,
  RotateCcw,
  Edit2,
  Zap,
  Maximize2,
  Minimize2,
  Camera,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Plus
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ToolCallItem, Routine, Attachment, QuotedMessage } from '../types';
import { api } from '../api';
import { voiceService, generateThinkingAcknowledgement } from '../services/voiceService';
import { voiceToneAnalyzer } from '../services/voiceToneAnalyzer';
import { parseLiveResponse } from './LiveVoiceModal';

interface ChatAreaProps {
  messages: Message[];
  isStreaming: boolean;
  activeModel: string;
  activeRoutine: Routine | null;
  onSendMessage: (content: string, attachments?: Attachment[], quotedMessage?: QuotedMessage) => void;
  onStopStreaming: () => void;
  onClearChat: () => void;
  onQuickAction: (action: string) => void;
  onSelectRoutine: (routine: Routine) => void;
  onOpenMentionModal: () => void;
  quotedMessage: QuotedMessage | null;
  onClearQuotedMessage: () => void;
  onOpenWindowPicker: () => void;
  onOpenNotes?: () => void;
  onOpenNoteOrFile?: (noteIdOrTitle: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (assistantMessageId: string) => void;
  tokenEfficiency?: boolean;
  onToggleTokenEfficiency?: () => void;
  onOpenLiveVoice?: () => void;
  activeSessionId?: string | null;
  activeSessionTitle?: string;
  onQuoteSnippet?: (quoted: QuotedMessage) => void;
  isLiveVoiceActive?: boolean;
  isLiveVoiceModalOpen?: boolean;
  liveVoiceMode?: 'voice_only' | 'mixed' | 'voice_output_only';
  onToggleLiveVoice?: () => void;
  onChangeLiveVoiceMode?: (mode: 'voice_only' | 'mixed' | 'voice_output_only') => void;
  onOpenLiveVoiceOrb?: () => void;
  onNewChat?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isStreaming,
  activeModel,
  activeRoutine,
  onSendMessage,
  onStopStreaming,
  onClearChat,
  onQuickAction,
  onSelectRoutine,
  onOpenMentionModal,
  quotedMessage,
  onClearQuotedMessage,
  onOpenWindowPicker,
  onOpenNotes,
  onOpenNoteOrFile,
  onEditMessage,
  onRegenerateResponse,
  tokenEfficiency,
  onToggleTokenEfficiency,
  onOpenLiveVoice,
  activeSessionId,
  activeSessionTitle,
  onQuoteSnippet,
  isLiveVoiceActive = false,
  isLiveVoiceModalOpen = false,
  liveVoiceMode = 'mixed',
  onToggleLiveVoice,
  onChangeLiveVoiceMode,
  onOpenLiveVoiceOrb,
  onNewChat
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [expandedToolGroups, setExpandedToolGroups] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Floating Snippet Selection State for quoting or copying partial message content
  const [selectedSnippet, setSelectedSnippet] = useState<{
    text: string;
    msgId: string;
    role: 'user' | 'assistant';
    rect: { top: number; left: number };
  } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  
  // Voice & Speech States
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const isDictatingRef = useRef<boolean>(false);
  const dictationRecognizerRef = useRef<any>(null);
  const dictationSilenceTimeoutRef = useRef<any>(null);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  // Message In-Place Editing State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [createdNoteInfo, setCreatedNoteInfo] = useState<{ id: string; title: string } | null>(null);

  const [isExpandedEditor, setIsExpandedEditor] = useState<boolean>(false);

  const stopDictation = (hardCancel = false) => {
    isDictatingRef.current = false;
    setIsDictating(false);
    if (dictationSilenceTimeoutRef.current) {
      clearTimeout(dictationSilenceTimeoutRef.current);
      dictationSilenceTimeoutRef.current = null;
    }
    if (dictationRecognizerRef.current) {
      const rec = dictationRecognizerRef.current;
      dictationRecognizerRef.current = null;
      try {
        if (hardCancel) {
          rec.abort();
        } else {
          rec.stop();
        }
      } catch {}
    }
    voiceService.releaseMicrophone();
    voiceToneAnalyzer.cleanup();
  };

  const handleToggleSpeakMessage = (msgId: string, content: string) => {
    if (speakingMessageId === msgId) {
      voiceService.stop();
      setSpeakingMessageId(null);
    } else {
      voiceService.speak(content, {
        onStart: () => setSpeakingMessageId(msgId),
        onEnd: () => setSpeakingMessageId(null),
        onError: () => setSpeakingMessageId(null)
      });
    }
  };

  // Auto-speak assistant responses when Live Voice is active in this session
  const prevIsStreamingRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming) {
      // Streaming just finished
      if (isLiveVoiceActive && !isLiveVoiceModalOpen && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
          const contentToSpeak = lastMsg.content || 'Notas e estruturas criadas com sucesso no seu Vault.';

          voiceService.speakMessageSummary(lastMsg.id, contentToSpeak, null, {
            onStart: () => setSpeakingMessageId(lastMsg.id),
            onEnd: () => {
              setSpeakingMessageId(null);
              // No modo Hands-Off contínuo (somente voz ou misto), reabre a escuta automaticamente!
              if (isLiveVoiceActive && liveVoiceMode !== 'voice_output_only') {
                setTimeout(() => {
                  if (!isDictatingRef.current) {
                    handleToggleDictation();
                  }
                }, 500);
              }
            },
            onError: () => setSpeakingMessageId(null)
          });
        }
      }
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, isLiveVoiceActive, isLiveVoiceModalOpen, liveVoiceMode, messages]);

  // Reset dictation whenever session changes
  useEffect(() => {
    stopDictation();
    setMicPermissionError(null);
  }, [activeSessionId]);

  const handleToggleDictation = async () => {
    if (isDictatingRef.current) {
      if (isLiveVoiceActive && input.trim()) {
        const speechText = input.trim();
        setInput('');
        stopDictation(false);
        onSendMessage(speechText, undefined, quotedMessage || undefined);
        if (quotedMessage) onClearQuotedMessage();
        return;
      }
      stopDictation(false);
      return;
    }

    if (!voiceService.isSpeechRecognitionAvailable()) {
      setMicPermissionError('Reconhecimento de fala nativo não suportado neste ambiente.');
      return;
    }

    setMicPermissionError(null);

    // 1. Explicitly prompt and verify microphone access via getUserMedia
    const micCheck = await voiceService.requestMicrophoneAccess();
    if (!micCheck.granted) {
      setMicPermissionError(micCheck.error || 'Permissão de microfone negada ou bloqueada.');
      stopDictation();
      return;
    }

    try {
      voiceToneAnalyzer.start(micCheck.stream).catch(() => {});
    } catch {}

    stopDictation();
    isDictatingRef.current = true;
    setIsDictating(true);

    try {
      const sendSpeechDirectly = (transcriptText: string) => {
        const textToSend = transcriptText.trim();
        if (!textToSend || textToSend.length < 2) return;
        setInput('');
        stopDictation(false);
        let tone = null;
        try {
          tone = voiceToneAnalyzer.stopAndAnalyze(textToSend);
        } catch {}
        if (isLiveVoiceActive) {
          const thinkingAck = generateThinkingAcknowledgement(textToSend, tone);
          voiceService.speak(thinkingAck);
        }
        onSendMessage(textToSend, undefined, quotedMessage || undefined);
        if (quotedMessage) onClearQuotedMessage();
      };

      const rec = voiceService.createSpeechRecognizer({
        lang: 'pt-BR',
        onStart: () => {
          isDictatingRef.current = true;
          setIsDictating(true);
          setMicPermissionError(null);
        },
        onProcessing: (proc) => {
          setIsTranscribing(proc);
        },
        onResult: (transcript, isFinal) => {
          if (!transcript || !transcript.trim()) return;

          if (isLiveVoiceActive) {
            setInput(transcript);
            if (isFinal && transcript.trim().length > 1) {
              sendSpeechDirectly(transcript);
              return;
            }
          } else {
            setInput(prev => {
              const separator = prev && !prev.endsWith(' ') ? ' ' : '';
              return prev + separator + transcript;
            });
          }

          // Reset silence timer on every chunk of speech detected
          if (dictationSilenceTimeoutRef.current) {
            clearTimeout(dictationSilenceTimeoutRef.current);
          }

          if (isLiveVoiceActive) {
            // Em modo Live Voice, 900ms de silêncio após fala envia imediatamente sem confirmação manual
            dictationSilenceTimeoutRef.current = setTimeout(() => {
              if (isDictatingRef.current) {
                sendSpeechDirectly(transcript || '');
              }
            }, 900);
          } else {
            // Ditado normal: pausa após 3.5s de silêncio
            dictationSilenceTimeoutRef.current = setTimeout(() => {
              if (isDictatingRef.current) {
                stopDictation(false);
              }
            }, 3500);
          }
        },
        onError: (err) => {
          console.warn('[Dictation] Recognition error:', err);
          if (err === 'not-allowed') {
            setMicPermissionError(voiceService.isElectron() 
              ? 'Microfone não autorizado no Windows. Verifique Configurações > Privacidade e Segurança > Microfone.' 
              : 'Microfone bloqueado: Permita o acesso ao microfone no navegador.');
            stopDictation(true);
          } else if (err === 'network') {
            // DirectMic já assume sem erro
            return;
          } else if (err !== 'no-speech' && err !== 'aborted') {
            stopDictation(true);
          }
        },
        onEnd: () => {
          // If dictation is still actively turned on, smoothly restart if not in live voice final
          if (isDictatingRef.current && !isLiveVoiceActive) {
            setTimeout(() => {
              if (isDictatingRef.current) {
                try {
                  rec.start();
                } catch {
                  // Harmless if already active
                }
              }
            }, 200);
          } else if (isDictatingRef.current && isLiveVoiceActive) {
            stopDictation(false);
          }
        }
      });

      dictationRecognizerRef.current = rec;
      rec.start();
    } catch (err: any) {
      console.error('[Dictation] Start error:', err);
      setMicPermissionError(err.message || 'Erro ao inicializar o microfone.');
      stopDictation();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, attachments]);

  // Auto-focus textarea on empty/new chat, active session change, or when done streaming
  useEffect(() => {
    if (!isStreaming) {
      const t1 = setTimeout(() => textareaRef.current?.focus(), 15);
      const t2 = setTimeout(() => textareaRef.current?.focus(), 80);
      const t3 = setTimeout(() => textareaRef.current?.focus(), 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [activeSessionId, messages.length, isStreaming]);

  // Robust chat area click handler: focuses textarea when clicking anywhere in chat or messages,
  // bringing up the active blinking cursor, while cleanly preserving text selections and interactive buttons.
  const handleChatContainerClick = (e: React.MouseEvent) => {
    // 1. If text is being selected or is highlighted, do NOT steal focus or clear selection!
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    const target = e.target as HTMLElement;

    // 2. Do not hijack if user clicked an interactive control
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a') ||
      target.closest('audio') ||
      target.closest('video') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('pre')
    ) {
      return;
    }

    // 3. Focus the input textarea and bring up the blinking cursor immediately
    textareaRef.current?.focus();
  };

  // Inspect selection on mouseup to show quick actions (Copy / Quote snippet)
  const handleMouseUpOnChat = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || !sel.toString().trim()) {
          setSelectedSnippet(null);
        }
      }, 150);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      setSelectedSnippet(null);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.ELEMENT_NODE 
        ? (container as HTMLElement) 
        : container.parentElement;

      const messageBubble = element?.closest('[data-message-id]') as HTMLElement | null;
      if (!messageBubble) {
        setSelectedSnippet(null);
        return;
      }

      const msgId = messageBubble.getAttribute('data-message-id') || '';
      const role = (messageBubble.getAttribute('data-message-role') || 'assistant') as 'user' | 'assistant';
      const rect = range.getBoundingClientRect();

      setSelectedSnippet({
        text,
        msgId,
        role,
        rect: {
          top: Math.max(12, rect.top - 46),
          left: Math.max(16, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 140))
        }
      });
    } catch {
      setSelectedSnippet(null);
    }
  };

  // Auto-resize textarea height to fit content smoothly without covering text
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxH = isExpandedEditor ? 480 : 260;
      const minH = isExpandedEditor ? 220 : 54;
      const calculatedH = Math.min(Math.max(textareaRef.current.scrollHeight, minH), maxH);
      textareaRef.current.style.height = `${calculatedH}px`;
    }
  }, [input, isExpandedEditor]);

  const handleGenerateNote = async () => {
    if (messages.length === 0) {
      alert('Inicie ou carregue uma conversa antes de criar uma anotação.');
      return;
    }
    setIsGeneratingNote(true);
    try {
      const res = await api.generateNoteFromChat({
        messages,
        model: activeModel
      });
      setCreatedNoteInfo({ id: res.note.id, title: res.note.title });
    } catch (err: any) {
      alert(`Erro ao criar anotação: ${err.message}`);
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();

    // Check for note creation commands
    if (
      lower === '/nota' ||
      lower === '/note' ||
      lower === 'criar uma anotação disso' ||
      lower === 'anotar conversa' ||
      lower === 'resumir em nota'
    ) {
      setInput('');
      handleGenerateNote();
      return;
    }

    stopDictation();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;
    onSendMessage(trimmed, attachments.length > 0 ? attachments : undefined, quotedMessage || undefined);
    setInput('');
    setAttachments([]);
    if (quotedMessage) onClearQuotedMessage();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const filesPayload: Array<{ name: string; type: string; base64: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64Content = res.split(',')[1] || res;
          resolve(base64Content);
        };
        reader.readAsDataURL(file);
      });

      filesPayload.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        base64
      });
    }

    try {
      const uploaded = await api.uploadFiles(filesPayload);
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (err: any) {
      alert(`Erro ao fazer upload de arquivos: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleTool = (toolId: string) => {
    setExpandedTools(prev => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  const toggleToolGroup = (msgId: string) => {
    setExpandedToolGroups(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const getToolIcon = (name: string) => {
    switch (name) {
      case 'read_file':
      case 'write_file':
      case 'edit_file':
      case 'list_dir':
      case 'grep_search':
        return <FileCode className="w-4 h-4 text-brand-cyan" />;
      case 'run_command':
        return <Terminal className="w-4 h-4 text-brand-amber" />;
      case 'memory_query':
      case 'memory_write_page':
      case 'memory_update_context':
        return <Database className="w-4 h-4 text-accent-light" />;
      case 'memory_create_handoff':
        return <ArrowRightLeft className="w-4 h-4 text-brand-emerald" />;
      case 'note_save':
      case 'frank_note_save':
      case 'note_search':
      case 'frank_note_search':
      case 'note_list':
      case 'frank_note_list':
        return <FileText className="w-4 h-4 text-amber-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCaptureScreen = async () => {
    setIsUploading(true);
    try {
      const capture = await api.captureScreen();
      setAttachments(prev => [...prev, capture]);
    } catch (err: any) {
      alert(`Erro ao capturar tela: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div 
      onClick={handleChatContainerClick}
      className="flex-1 flex flex-col h-full min-h-0 bg-background relative overflow-hidden chat-selectable select-text"
    >
      {/* Top Header / Live Voice Bar */}
      {isLiveVoiceActive ? (
        <div className="bg-gradient-to-r from-red-950/50 via-slate-900/90 to-purple-950/40 border-b border-red-500/30 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none backdrop-blur-md animate-in fade-in z-10">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 text-xs shadow-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-semibold text-[11px] tracking-wide">LIVE VOICE</span>
            </div>

            {/* 3 Modes Switcher */}
            <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => onChangeLiveVoiceMode?.('voice_only')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 cursor-pointer ${
                  liveVoiceMode === 'voice_only'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Somente Voz: conversa 100% por áudio sem necessidade de digitar"
              >
                <Mic className="w-3 h-3" />
                <span className="hidden sm:inline">Somente Voz</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeLiveVoiceMode?.('mixed')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 cursor-pointer ${
                  liveVoiceMode === 'mixed'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Misto: livre para falar pelo microfone ou digitar texto. A IA responde em texto e voz."
              >
                <Radio className="w-3 h-3" />
                <span>Misto</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeLiveVoiceMode?.('voice_output_only')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 cursor-pointer ${
                  liveVoiceMode === 'voice_output_only'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Retorno em Voz: digite suas perguntas e o Tellus SEMPRE responde falando em voz alta"
              >
                <Volume2 className="w-3 h-3" />
                <span className="hidden sm:inline">Retorno em Voz</span>
              </button>
            </div>

            {/* Live Talk Button (Microphone only turns on when clicked!) */}
            <button
              type="button"
              onClick={handleToggleDictation}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer ${
                isTranscribing
                  ? 'bg-amber-600 text-white animate-pulse ring-2 ring-amber-400'
                  : isDictating
                  ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40'
              }`}
              title={
                isTranscribing 
                  ? "Processando transcrição de áudio..." 
                  : isDictating 
                  ? "Modo Mãos-Livres ativo: Fale naturalmente. Ao pausar, seu prompt será enviado automaticamente." 
                  : "Clique para falar com o assistente por voz (Modo Mãos-Livres)"
              }
            >
              {isTranscribing ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-spin" />
                  <span>Transcrevendo...</span>
                </>
              ) : isDictating ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Ouvindo... (Envia ao pausar)</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-red-400" />
                  <span>Falar Agora</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            {onNewChat && (
              <button
                type="button"
                onClick={onNewChat}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs flex items-center space-x-1 transition-all cursor-pointer"
                title="Criar um novo chat e focar na digitação imediatamente"
              >
                <Plus className="w-3 h-3" />
                <span className="text-[11px] hidden sm:inline">Novo Chat</span>
              </button>
            )}

            {onOpenLiveVoiceOrb && (
              <button
                type="button"
                onClick={onOpenLiveVoiceOrb}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs flex items-center space-x-1 transition-all cursor-pointer"
                title="Abrir modal com Orbe 3D e visualizador de ondas"
              >
                <Sparkles className="w-3 h-3 text-red-400" />
                <span className="text-[11px] hidden md:inline">Orbe Visual</span>
              </button>
            )}

            {onToggleLiveVoice && (
              <button
                type="button"
                onClick={onToggleLiveVoice}
                className="p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                title="Desativar Live Voice nesta conversa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="border-b border-card-border/50 px-3.5 py-1 flex items-center justify-between text-xs text-slate-400 bg-sidebar/30 shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            {activeSessionTitle && (
              <span className="font-semibold text-slate-300 truncate max-w-[280px]">
                {activeSessionTitle}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onNewChat && (
              <button
                type="button"
                onClick={onNewChat}
                className="px-2 py-0.5 rounded-md hover:bg-accent/20 border border-transparent hover:border-accent/40 text-[11px] text-slate-300 hover:text-accent-light flex items-center space-x-1 transition-all cursor-pointer"
                title="Criar um novo chat e focar na digitação imediatamente"
              >
                <Plus className="w-3 h-3" />
                <span>Novo Chat</span>
              </button>
            )}
            {onToggleLiveVoice && (
              <button
                type="button"
                onClick={onToggleLiveVoice}
                className="px-2 py-0.5 rounded-md hover:bg-card-border/60 text-[11px] text-slate-400 hover:text-red-400 flex items-center space-x-1 transition-colors cursor-pointer"
                title="Ativar Live Voice nesta conversa (para respostas faladas por voz em tempo real)"
              >
                <Mic className="w-3 h-3" />
                <span>Ativar Live Voice</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Streaming / Background Processing Safety Banner */}
      {isStreaming && (
        <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300 shrink-0 select-none animate-in fade-in">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[11px] font-medium text-amber-200">
              Assistente respondendo ou executando tarefas...
            </span>
          </div>
          <button
            type="button"
            onClick={onStopStreaming}
            className="px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
            title="Interromper geração e desbloquear o chat para digitação imediata"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Interromper & Desbloquear</span>
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div 
        onClick={handleChatContainerClick}
        onMouseUp={handleMouseUpOnChat}
        className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-card-border cursor-text"
      >
        {messages.length === 0 ? (
          <div 
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest('button')) {
                textareaRef.current?.focus();
              }
            }}
            className="min-h-[380px] h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-5 cursor-text"
          >
            <div className="w-16 h-16 rounded-2xl bg-white p-1 border border-card-border/80 shadow-xl shadow-accent/5 flex items-center justify-center shrink-0 animate-in fade-in zoom-in-95 cursor-pointer" onClick={() => textareaRef.current?.focus()}>
              <img src="/logo.png" alt="Tellus Logo" className="w-full h-full object-contain" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-100">
                Tellus Workspace
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Converse com qualquer modelo do OpenRouter, Google, Claude ou OpenAI. Importe arquivos (PDF, CSV, PNG, MP3) ou cite mensagens de outros chats mantendo a continuidade do projeto.
              </p>
            </div>

            {/* Quick Starter Suggestions */}
            <div className="grid grid-cols-2 gap-2.5 w-full pt-4">
              <button
                onClick={() => onSendMessage('Faça um raio-x completo do projeto e atualize o active_context.md com os objetivos atuais.')}
                className="p-3 rounded-xl bg-card hover:bg-card-border/60 border border-card-border text-left text-xs transition-all group"
              >
                <div className="flex items-center space-x-2 text-accent-light font-semibold mb-1">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Mapear Projeto</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Lê arquivos e mapeia o contexto ativo.
                </span>
              </button>

              <button
                onClick={() => onSendMessage('Proponha um plano de arquitetura em etapas para o próximo recurso.')}
                className="p-3 rounded-xl bg-card hover:bg-card-border/60 border border-card-border text-left text-xs transition-all group"
              >
                <div className="flex items-center space-x-2 text-brand-cyan font-semibold mb-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Planejar Arquitetura</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Estrutura decisões e salva em decisions/.
                </span>
              </button>

              <button
                onClick={() => onSendMessage('Gere um snapshot de handoff sintetizando o que foi feito até agora.')}
                className="p-3 rounded-xl bg-card hover:bg-card-border/60 border border-card-border text-left text-xs transition-all group"
              >
                <div className="flex items-center space-x-2 text-brand-emerald font-semibold mb-1">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Criar Handoff</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Prepara a transição para outro modelo.
                </span>
              </button>

              <button
                onClick={() => onSendMessage('Verifique se há erros no código e execute os testes ou linter.')}
                className="p-3 rounded-xl bg-card hover:bg-card-border/60 border border-card-border text-left text-xs transition-all group"
              >
                <div className="flex items-center space-x-2 text-brand-amber font-semibold mb-1">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Executar Testes</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Roda diagnósticos locais diretamente.
                </span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-2 ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 px-1">
                {msg.role === 'user' ? (
                  <span className="font-semibold text-slate-300">Você</span>
                ) : (
                  <div className="flex items-center space-x-1.5">
                    <div className="w-4 h-4 rounded-md bg-white p-0.5 border border-card-border shadow-xs flex items-center justify-center shrink-0">
                      <img src="/logo.png" alt="Tellus" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-semibold text-slate-200">Tellus</span>
                  </div>
                )}
                {msg.modelUsed && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-panel border border-card-border text-slate-400">
                    {msg.modelUsed.split('/').pop()}
                  </span>
                )}
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                {msg.role !== 'user' && (
                  <button
                    type="button"
                    onClick={() => handleToggleSpeakMessage(msg.id, msg.content)}
                    className={`p-1 rounded-md border transition-all flex items-center space-x-1 cursor-pointer ${
                      speakingMessageId === msg.id
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/40 animate-pulse'
                        : 'bg-panel/60 hover:bg-card-border border-card-border/60 text-slate-400 hover:text-slate-200'
                    }`}
                    title={speakingMessageId === msg.id ? "Interromper leitura em voz alta" : "Ouvir resposta em voz alta (TTS)"}
                  >
                    {speakingMessageId === msg.id ? (
                      <>
                        <VolumeX className="w-3 h-3 text-emerald-400" />
                        <span className="text-[9px] font-mono text-emerald-300">Falando</span>
                      </>
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>

              {/* Message Bubble Container */}
              <div
                data-message-id={msg.id}
                data-message-role={msg.role}
                className={`message-bubble max-w-[85%] rounded-2xl p-4 transition-all chat-selectable select-text cursor-text ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-tr from-accent/90 to-accent text-white shadow-lg shadow-accent/15 selection:bg-white/30 selection:text-white'
                    : 'bg-card border border-card-border text-slate-100 shadow-md w-full selection:bg-accent/40 selection:text-white'
                }`}
              >
                {/* Quoted Message Card */}
                {msg.quotedMessage && (
                  <div className="mb-3 p-3 rounded-xl bg-black/40 border border-card-border text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 text-[10px] text-brand-cyan font-semibold">
                      <Quote className="w-3 h-3 text-brand-cyan" />
                      <span>Citação de: {msg.quotedMessage.sessionTitle}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2 italic font-mono bg-panel/60 p-1.5 rounded">
                      "{msg.quotedMessage.content}"
                    </p>
                  </div>
                )}

                {/* Attachments inside Message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {msg.attachments.map(att => (
                      <div
                        key={att.id}
                        className="rounded-xl border border-card-border/80 bg-panel p-2 flex items-center space-x-2 max-w-sm overflow-hidden"
                      >
                        {att.isImage ? (
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            className="w-12 h-12 object-cover rounded-lg border border-card-border"
                          />
                        ) : att.isAudio ? (
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-1.5 text-xs text-brand-amber font-mono">
                              <Music className="w-4 h-4" />
                              <span className="truncate max-w-[150px]">{att.name}</span>
                            </div>
                            <audio src={att.previewUrl} controls className="h-7 w-48" />
                          </div>
                        ) : att.isPdf ? (
                          <div className="flex items-center space-x-2 text-xs text-rose-300 font-mono">
                            <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{att.name}</span>
                          </div>
                        ) : att.isCsv ? (
                          <div className="flex items-center space-x-2 text-xs text-emerald-300 font-mono">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{att.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 text-xs text-slate-300 font-mono">
                            <FileCode className="w-5 h-5 text-brand-cyan shrink-0" />
                            <span className="truncate max-w-[150px]">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reasoning Accordion (Thinking Block) */}
                {msg.reasoning && (
                  <div className="mb-3 rounded-xl bg-background/70 border border-accent/20 overflow-hidden">
                    <button
                      onClick={() => toggleReasoning(msg.id)}
                      className="w-full px-3 py-2 flex items-center justify-between text-xs text-accent-light font-medium bg-accent/5 hover:bg-accent/10 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Brain className="w-3.5 h-3.5 animate-pulse-subtle text-accent" />
                        <span>Processo de Raciocínio (Deep Thought)</span>
                      </div>
                      {expandedReasoning[msg.id] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {expandedReasoning[msg.id] && (
                      <div className="p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed border-t border-accent/15 max-h-60 overflow-y-auto">
                        {msg.reasoning}
                      </div>
                    )}
                  </div>
                )}

                {/* Tool Execution Accordion Group (Processing / Actions) */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (() => {
                  const totalCount = msg.toolCalls.length;
                  const runningCount = msg.toolCalls.filter(tc => tc.status === 'running').length;
                  const errorCount = msg.toolCalls.filter(tc => tc.status === 'error').length;
                  const completedCount = msg.toolCalls.filter(tc => tc.status === 'completed').length;
                  const isRunning = runningCount > 0;
                  const isGroupExpanded = expandedToolGroups[msg.id] ?? isRunning;

                  return (
                    <div className="mb-3 rounded-xl border border-card-border/80 bg-panel/60 overflow-hidden shadow-xs backdrop-blur-xs">
                      <button
                        type="button"
                        onClick={() => toggleToolGroup(msg.id)}
                        className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-card/70 transition-colors text-left group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-accent/10 border border-accent/20 text-accent shrink-0">
                            {isRunning ? (
                              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                            ) : errorCount > 0 ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <Zap className="w-3.5 h-3.5 text-accent-light" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 truncate">
                            <span className="font-semibold text-slate-200">
                              {isRunning ? 'Processando Ações do Sistema...' : 'Ações do Sistema'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-slate-400 border border-white/5 font-mono">
                              {completedCount}/{totalCount}
                            </span>
                            <div className="hidden sm:flex items-center space-x-1">
                              {Array.from(new Set(msg.toolCalls.map(tc => tc.name.replace(/^frank_/, '')))).slice(0, 3).map(name => (
                                <span key={name} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5">
                                  {name}
                                </span>
                              ))}
                              {new Set(msg.toolCalls.map(tc => tc.name)).size > 3 && (
                                <span className="text-[9px] text-slate-500">...</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {isRunning && (
                            <span className="text-[10px] text-amber-400 flex items-center">
                              Em andamento
                            </span>
                          )}
                          {isGroupExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-colors" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-colors" />
                          )}
                        </div>
                      </button>

                      {isGroupExpanded && (
                        <div className="p-2 space-y-2 border-t border-card-border/60 bg-background/40">
                          {msg.toolCalls.map((tc) => {
                            const isItemExpanded = expandedTools[tc.id];
                            const cleanName = tc.name.replace(/^frank_/, '');
                            return (
                              <div
                                key={tc.id}
                                className="rounded-lg border border-card-border/60 bg-panel/80 overflow-hidden text-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleTool(tc.id)}
                                  className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-card/60 transition-colors text-left"
                                >
                                  <div className="flex items-center space-x-2 truncate">
                                    {getToolIcon(tc.name)}
                                    <span className="font-mono font-medium text-slate-300 truncate">
                                      {cleanName}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 shrink-0">
                                    {tc.status === 'running' && (
                                      <span className="flex items-center text-[10px] text-amber-400">
                                        <Clock className="w-2.5 h-2.5 mr-1 animate-spin" /> Executando
                                      </span>
                                    )}
                                    {tc.status === 'completed' && (
                                      <span className="flex items-center text-[10px] text-emerald-400">
                                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Concluído
                                      </span>
                                    )}
                                    {tc.status === 'error' && (
                                      <span className="flex items-center text-[10px] text-rose-400">
                                        <AlertCircle className="w-2.5 h-2.5 mr-1" /> Erro
                                      </span>
                                    )}
                                    {isItemExpanded ? (
                                      <ChevronDown className="w-3 h-3 text-slate-500" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 text-slate-500" />
                                    )}
                                  </div>
                                </button>

                                {isItemExpanded && (
                                  <div className="p-2.5 border-t border-card-border/50 text-[11px] font-mono space-y-2 bg-background/60">
                                    <div>
                                      <span className="text-slate-500 uppercase text-[9px] font-bold block mb-1">
                                        Argumentos:
                                      </span>
                                      <pre className="text-slate-300 p-2 rounded bg-panel/90 overflow-x-auto text-[10px]">
                                        {tc.arguments}
                                      </pre>
                                    </div>
                                    {tc.result && (
                                      <div>
                                        <span className="text-slate-500 uppercase text-[9px] font-bold block mb-1">
                                          Resultado:
                                        </span>
                                        <pre className="text-emerald-300 p-2 rounded bg-panel/90 overflow-x-auto max-h-48 overflow-y-auto text-[10px]">
                                          {typeof tc.result === 'string'
                                            ? tc.result
                                            : JSON.stringify(tc.result, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Text Content & Edit Mode */}
                {msg.role === 'user' && editingMessageId === msg.id ? (
                  <div className="space-y-2 mt-1">
                    <textarea
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      className="w-full bg-black/40 border border-white/30 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white resize-none leading-relaxed"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditingMessageId(null)}
                        className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-xs text-slate-300 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onEditMessage && editInput.trim()) {
                            onEditMessage(msg.id, editInput.trim());
                          }
                          setEditingMessageId(null);
                        }}
                        className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-accent font-semibold text-xs transition-all shadow-md"
                      >
                        Salvar e Reenviar
                      </button>
                    </div>
                  </div>
                ) : (
                  msg.content && (
                    <div className={`prose prose-invert max-w-none text-xs leading-relaxed break-words chat-selectable select-text cursor-text ${msg.role === 'user' ? 'text-white' : 'text-slate-100'}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const codeText = String(children).replace(/\n$/, '').trim();
                            
                            // Check if it's an inline code referencing a markdown note, folder path, or file
                            const isMdFile = codeText.endsWith('.md') || codeText.endsWith('.markdown');
                            const isFolder = codeText.includes('/') && (codeText.endsWith('/') || !codeText.includes('.'));
                            const isWikilinkLike = codeText.startsWith('[[') && codeText.endsWith(']]');
                            const isNumberedNote = /^0\d-/.test(codeText) || /^\d{2}_/.test(codeText);

                            if (inline && (isMdFile || isWikilinkLike || isFolder || isNumberedNote) && onOpenNoteOrFile) {
                              const cleanTarget = codeText.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onOpenNoteOrFile(cleanTarget);
                                  }}
                                  className="inline-flex items-center space-x-1 font-mono text-[11px] font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 hover:border-amber-400 px-1.5 py-0.5 rounded-md cursor-pointer transition-all mx-0.5 shadow-xs group"
                                  title={`Abrir "${cleanTarget}" no Notes Module (Vault)`}
                                >
                                  <FileText className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform" />
                                  <span className="underline decoration-amber-500/50 underline-offset-2">{codeText}</span>
                                </button>
                              );
                            }

                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                          a({ href, children, ...props }: any) {
                            if (href && (href.startsWith('note://') || href.startsWith('vault://') || href.endsWith('.md'))) {
                              const target = href.replace(/^(note|vault):\/\//, '');
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onOpenNoteOrFile) onOpenNoteOrFile(target);
                                  }}
                                  className="inline-flex items-center space-x-1 font-semibold text-accent-light hover:text-white underline cursor-pointer"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>{children}</span>
                                </button>
                              );
                            }
                            return (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-light hover:underline" {...props}>
                                {children}
                              </a>
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )
                )}

                {/* User Message Action Buttons (Edit + Copy) */}
                {msg.role === 'user' && editingMessageId !== msg.id && (
                  <div className="mt-2 pt-1.5 border-t border-white/15 flex items-center justify-end space-x-2 text-[10px] text-white/70">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditInput(msg.content);
                      }}
                      className="hover:text-white flex items-center space-x-1 transition-colors"
                      title="Editar esta mensagem e reenviar à IA"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="hover:text-white flex items-center space-x-1 transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-300" />
                          <span className="text-emerald-300">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Assistant Message Action Buttons (Regenerate + Copy) */}
                {msg.role === 'assistant' && (
                  <div className="mt-2 pt-2 border-t border-card-border/50 flex items-center justify-end space-x-3">
                    {onRegenerateResponse && (
                      <button
                        type="button"
                        onClick={() => onRegenerateResponse(msg.id)}
                        disabled={isStreaming}
                        className="text-[10px] text-slate-400 hover:text-accent-light flex items-center space-x-1 transition-colors disabled:opacity-50"
                        title="Regenerar esta resposta com o modelo ativo"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Regenerar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Action Footer */}
      <div 
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button') && !target.closest('input') && !target.closest('a') && !target.closest('textarea')) {
            textareaRef.current?.focus();
          }
        }}
        className="p-4 border-t border-card-border bg-sidebar shrink-0 space-y-2.5 cursor-text"
      >
        {/* Active Quoted Message Preview Bar */}
        {quotedMessage && (
          <div className="p-2.5 rounded-xl bg-card border border-brand-cyan/40 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2 text-xs overflow-hidden">
              <Quote className="w-4 h-4 text-brand-cyan shrink-0" />
              <div className="overflow-hidden">
                <span className="font-semibold text-brand-cyan text-[11px] block">
                  Citando: {quotedMessage.sessionTitle}
                </span>
                <span className="text-slate-300 text-[10px] truncate block font-mono">
                  "{quotedMessage.content}"
                </span>
              </div>
            </div>
            <button
              onClick={onClearQuotedMessage}
              className="p-1 rounded-md hover:bg-card-border text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Staged Created Note Notification Banner */}
        {createdNoteInfo && (
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">
                Anotação <strong>"{createdNoteInfo.title}"</strong> criada no Notes Module (Vault)!
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {onOpenNotes && (
                <button
                  type="button"
                  onClick={onOpenNotes}
                  className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-all"
                >
                  Ver no Vault
                </button>
              )}
              <button
                type="button"
                onClick={() => setCreatedNoteInfo(null)}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active Streaming Alert & Stop Button Banner */}
        {isStreaming && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2 text-xs text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>Tellus está gerando resposta com <strong>{activeModel.split('/').pop()}</strong>...</span>
            </div>
            <button
              type="button"
              onClick={onStopStreaming}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-rose-950/40"
              title="Interromper geração imediatamente"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Interromper Resposta</span>
            </button>
          </div>
        )}

        {/* Staged Attachments Preview Bar */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-card border border-card-border">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-panel border border-card-border text-xs text-slate-200"
              >
                {att.isImage ? (
                  <img src={att.previewUrl} alt={att.name} className="w-6 h-6 object-cover rounded" />
                ) : att.isAudio ? (
                  <Music className="w-4 h-4 text-brand-amber" />
                ) : att.isPdf ? (
                  <FileText className="w-4 h-4 text-rose-400" />
                ) : att.isCsv ? (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                ) : (
                  <FileCode className="w-4 h-4 text-brand-cyan" />
                )}
                <span className="truncate max-w-[140px] text-[11px]">{att.name}</span>
                <span className="text-[9px] text-slate-500 font-mono">({formatFileSize(att.size)})</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 rounded hover:bg-card-border text-slate-400 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {attachments.some(att => att.isImage) && (
              <div className="w-full pt-2 mt-1 border-t border-card-border/60 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 font-medium">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Foto anexada (Caderno / Anotação manuscrita)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInput('Anote isso: faça o reconhecimento desta anotação do meu caderno e salve como nota no Notes Module (Vault).');
                    textareaRef.current?.focus();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  title="Preencher comando para digitalizar caligrafia e salvar no cofre de notas"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Digitalizar & Salvar no Vault ("Anote isso")</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Action Chips Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          {onOpenLiveVoice && (
            <button
              onClick={onOpenLiveVoice}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600/25 to-indigo-600/25 hover:from-purple-600/40 hover:to-indigo-600/40 border border-purple-500/50 text-purple-300 transition-all whitespace-nowrap flex items-center space-x-1.5 font-semibold cursor-pointer shadow-xs animate-pulse"
              title="Abrir Modo Live Voice Chat para estudo conversacional por voz em tempo real"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>🎙️ Live Voice Chat</span>
            </button>
          )}

          {attachments.some(att => att.isImage) && (
            <button
              onClick={() => {
                setInput('Anote isso: faça o reconhecimento desta anotação do meu caderno e salve como nota no Notes Module (Vault).');
                textareaRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 transition-colors whitespace-nowrap flex items-center space-x-1 font-semibold animate-pulse"
              title="Digitalizar caligrafia da foto e salvar no Notes Module (Vault)"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>📷 Anote isso (OCR Caderno)</span>
            </button>
          )}

          <button
            onClick={onOpenMentionModal}
            className="px-2.5 py-1 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan transition-colors whitespace-nowrap flex items-center space-x-1"
            title="Citar mensagem de outro chat"
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>@ Citar Mensagem</span>
          </button>

          <button
            onClick={() => onQuickAction('Atualize o active_context.md com o status atual do projeto.')}
            className="px-2.5 py-1 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-300 transition-colors whitespace-nowrap flex items-center space-x-1"
          >
            <Brain className="w-3 h-3 text-brand-cyan" />
            <span>Atualizar Contexto</span>
          </button>
          <button
            onClick={() => onQuickAction('Crie um snapshot de handoff para transição de modelo.')}
            className="px-2.5 py-1 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-300 transition-colors whitespace-nowrap flex items-center space-x-1"
          >
            <ArrowRightLeft className="w-3 h-3 text-brand-emerald" />
            <span>Criar Handoff</span>
          </button>
          <button
            onClick={() => onQuickAction('Execute um diagnóstico no projeto e reporte os achados.')}
            className="px-2.5 py-1 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-300 transition-colors whitespace-nowrap flex items-center space-x-1"
          >
            <Terminal className="w-3 h-3 text-brand-amber" />
            <span>Diagnóstico</span>
          </button>

          {/* Quick Token Efficiency Switcher */}
          {onToggleTokenEfficiency && (
            <button
              onClick={onToggleTokenEfficiency}
              className={`px-2.5 py-1 rounded-lg border text-xs transition-all whitespace-nowrap flex items-center space-x-1.5 font-mono ${
                tokenEfficiency
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm font-semibold'
                  : 'bg-card hover:bg-card-border border-card-border text-slate-400'
              }`}
              title="Ativar/Desativar Token Efficiency: Respostas diretas e sem enrolação, apenas aplicando a ação e reportando arquivos modificados."
            >
              <Zap className={`w-3 h-3 ${tokenEfficiency ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
              <span>{tokenEfficiency ? '⚡ Eficiência: ON' : '⚡ Modo Eficiência'}</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={() => {
                onClearChat();
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="px-2 py-1 rounded-lg bg-card hover:bg-rose-950/30 border border-card-border hover:border-rose-800/40 text-slate-400 hover:text-rose-300 transition-colors ml-auto flex items-center space-x-1"
              title="Limpar Conversa"
            >
              <Trash2 className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* Microphone Permission / Diagnostic Help Banner */}
        {micPermissionError && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-start justify-between gap-2.5 text-xs text-amber-200 animate-in fade-in">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300 block">Diagnóstico de Microfone / Live Voice:</span>
                <p className="text-[11px] leading-relaxed text-amber-100/90">{micPermissionError}</p>
                <div className="text-[10px] text-amber-300/80 font-mono space-y-0.5 pt-0.5">
                  {voiceService.isElectron() ? (
                    <>
                      <p>1. No Windows: <strong>Configurações &gt; Privacidade e Segurança &gt; Microfone</strong> &gt; Ativar acesso.</p>
                      <p>2. Certifique-se de que o microfone do computador está conectado e não silenciado (Mute).</p>
                      <p>3. A captura de áudio direto via hardware (WASAPI) está ativada automaticamente no aplicativo.</p>
                    </>
                  ) : (
                    <>
                      <p>1. Clique no ícone de 🔒 (cadeado ou permissões) na barra de endereço do navegador.</p>
                      <p>2. Altere <strong>Microfone</strong> para <strong>Permitir</strong>.</p>
                      <p>3. No Windows: <strong>Configurações &gt; Privacidade &gt; Microfone</strong> &gt; Ativar acesso.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMicPermissionError(null)}
              className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-400 hover:text-amber-200 transition-colors"
              title="Fechar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Auto-Expanding Input Bar Card (Flexbox - Buttons NEVER overlap text!) */}
        <div 
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('button') && !target.closest('input')) {
              textareaRef.current?.focus();
            }
          }}
          className={`rounded-2xl bg-card border border-card-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 shadow-xl shadow-black/40 transition-all flex flex-col p-3 gap-2.5 cursor-text ${
            isExpandedEditor ? 'ring-2 ring-accent/30' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.txt,.json,.js,.ts,.tsx,.py,.md"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Top Bar inside Input Box: Expand Button & Status */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-0.5 select-none">
            <div className="flex items-center space-x-1.5">
              {input.length > 0 ? (
                <span className="text-[10px] text-amber-400 font-mono font-medium">
                  {input.length} caracteres
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-sans flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-accent-light inline opacity-70" />
                  <span>Chat com Tellus</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsExpandedEditor(!isExpandedEditor)}
              className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-white transition-colors flex items-center space-x-1 text-[10px]"
              title={isExpandedEditor ? "Recolher caixa de texto" : "Expandir caixa de texto para digitação confortável"}
            >
              {isExpandedEditor ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isExpandedEditor ? 'Recolher' : 'Expandir'}</span>
            </button>
          </div>

          {/* Auto-Expanding Textarea (Full clear visibility) */}
          <textarea
            ref={textareaRef}
            value={input}
            onClick={(e) => {
              e.stopPropagation();
              textareaRef.current?.focus();
            }}
            onFocus={() => {
              const sel = window.getSelection();
              if (sel && sel.type === 'Range') {
                sel.collapseToEnd();
              }
            }}
            onChange={(e) => {
              setInput(e.target.value);
              // Trigger mention modal if user typed @
              if (e.target.value.endsWith('@')) {
                onOpenMentionModal();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem, instrução para o agente, ou use @ para citar outro chat..."
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed overflow-y-auto font-sans caret-amber-400 selection:bg-accent/40 selection:text-white"
            style={{ minHeight: isExpandedEditor ? '240px' : '48px' }}
            autoFocus
          />

          {/* Bottom Toolbar naturally below the text (NEVER covering text!) */}
          <div className="pt-2 border-t border-card-border/60 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono flex-wrap gap-y-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-1.5 rounded-lg bg-panel hover:bg-card-border border border-card-border text-slate-300 hover:text-accent-light transition-all flex items-center space-x-1"
                title="Anexar arquivos (PDF, CSV, PNG, MP3, etc.)"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span className="text-[11px] font-sans">
                  {isUploading ? 'Processando...' : 'Anexar'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCaptureScreen}
                disabled={isUploading}
                className="p-1.5 rounded-lg bg-panel hover:bg-brand-cyan/20 border border-card-border hover:border-brand-cyan/40 text-brand-cyan transition-all flex items-center space-x-1"
                title="Capturar a tela inteira do computador"
              >
                <ImageIcon className="w-3.5 h-3.5 text-brand-cyan" />
                <span className="text-[11px] font-sans font-medium">Capturar Tela</span>
              </button>

              <button
                type="button"
                onClick={onOpenWindowPicker}
                disabled={isUploading}
                className="p-1.5 rounded-lg bg-panel hover:bg-accent/20 border border-card-border hover:border-accent/40 text-accent-light transition-all flex items-center space-x-1"
                title="Escolher uma janela específica (VS Code, Navegador, etc.) para inspecionar"
              >
                <Eye className="w-3.5 h-3.5 text-accent-light" />
                <span className="text-[11px] font-sans font-medium">Escolher Janela</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateNote}
                disabled={isGeneratingNote || messages.length === 0}
                className="p-1.5 rounded-lg bg-panel hover:bg-emerald-500/20 border border-card-border hover:border-emerald-500/40 text-emerald-400 transition-all flex items-center space-x-1"
                title="Criar nota estruturada no Notes Module (Vault) com os pontos chave e resumo da conversa (/nota)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[11px] font-sans font-medium">
                  {isGeneratingNote ? 'Sintetizando...' : 'Anotar Chat'}
                </span>
              </button>

              <span className="flex items-center space-x-1 pl-1 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-semibold">{activeModel.split('/').pop()}</span>
              </span>
              <span className="hidden sm:inline text-slate-500">• Shift+Enter p/ nova linha</span>
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                title="Interromper processamento e desbloquear o chat"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Interromper & Desbloquear</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1.5">
                {/* Microphone / Dictation button */}
                <button
                  type="button"
                  onClick={handleToggleDictation}
                  className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                    isTranscribing
                      ? 'bg-amber-600 text-white border-amber-500 ring-2 ring-amber-500/50 shadow-md shadow-amber-600/30 animate-pulse'
                      : isDictating
                      ? 'bg-purple-600 text-white border-purple-500 ring-2 ring-purple-500/50 shadow-md shadow-purple-600/30 animate-pulse'
                      : 'bg-panel hover:bg-card-border border-card-border text-slate-300 hover:text-white'
                  }`}
                  title={isTranscribing ? "Processando transcrição..." : isDictating ? "Parar ditado e transcrever fala" : "Ditar mensagem por voz (Reconhecimento de fala em pt-BR)"}
                >
                  {isTranscribing ? (
                    <Sparkles className="w-4 h-4 text-amber-200 animate-spin" />
                  ) : isDictating ? (
                    <MicOff className="w-4 h-4 text-white" />
                  ) : (
                    <Mic className="w-4 h-4 text-purple-400" />
                  )}
                </button>

                <button
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md ${
                    input.trim() || attachments.length > 0
                      ? 'bg-accent hover:bg-accent-hover shadow-accent/30 cursor-pointer'
                      : 'bg-card-border text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Enviar</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Floating Selection Micro-Toolbar (Copy / Ask in chat / Quote in another chat) */}
      {selectedSnippet && (
        <div
          style={{ top: `${selectedSnippet.rect.top}px`, left: `${selectedSnippet.rect.left}px` }}
          className="fixed z-50 flex items-center space-x-1.5 p-1 rounded-xl bg-[#1a1c22]/95 border border-accent/40 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Copy snippet button */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(selectedSnippet.text);
              setCopiedSnippet(true);
              setTimeout(() => {
                setCopiedSnippet(false);
                setSelectedSnippet(null);
              }, 1200);
            }}
            className="px-2 py-1 rounded-lg bg-panel hover:bg-card-border text-slate-200 hover:text-white flex items-center space-x-1 transition-all cursor-pointer"
            title="Copiar trecho selecionado para a área de transferência"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">Copiar</span>
              </>
            )}
          </button>

          <div className="w-[1px] h-3.5 bg-card-border" />

          {/* Ask / Quote in current chat */}
          <button
            type="button"
            onClick={() => {
              setInput(prev => {
                const quoteText = `> "${selectedSnippet.text}"\n\n`;
                return prev ? `${prev}\n${quoteText}` : quoteText;
              });
              setSelectedSnippet(null);
              textareaRef.current?.focus();
            }}
            className="px-2 py-1 rounded-lg bg-accent/20 hover:bg-accent text-accent-light hover:text-white flex items-center space-x-1 transition-all cursor-pointer font-medium"
            title="Inserir citação do trecho selecionado na mensagem para perguntar neste chat"
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span className="text-[11px]">Perguntar no Chat</span>
          </button>

          {/* Quote snippet in another chat */}
          {onQuoteSnippet && (
            <>
              <div className="w-[1px] h-3.5 bg-card-border" />
              <button
                type="button"
                onClick={() => {
                  onQuoteSnippet({
                    sessionId: activeSessionId || 'atual',
                    sessionTitle: activeSessionTitle || 'Conversa Atual',
                    messageId: selectedSnippet.msgId,
                    role: selectedSnippet.role,
                    content: selectedSnippet.text,
                    timestamp: Date.now()
                  });
                  setSelectedSnippet(null);
                }}
                className="px-2 py-1 rounded-lg bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-slate-900 flex items-center space-x-1 transition-all cursor-pointer font-medium"
                title="Fixar este trecho selecionado para perguntar ou citar em outro chat"
              >
                <Quote className="w-3.5 h-3.5" />
                <span className="text-[11px]">Citar em Outro Chat</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSelectedSnippet(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors ml-0.5"
            title="Fechar"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
