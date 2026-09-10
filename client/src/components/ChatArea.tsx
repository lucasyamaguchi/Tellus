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
  Camera
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ToolCallItem, Routine, Attachment, QuotedMessage } from '../types';
import { api } from '../api';

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
  onToggleTokenEfficiency
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Message In-Place Editing State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [createdNoteInfo, setCreatedNoteInfo] = useState<{ id: string; title: string } | null>(null);

  const [isExpandedEditor, setIsExpandedEditor] = useState<boolean>(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, attachments]);

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
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-background relative overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-card-border">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-16 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-white p-1 border border-card-border/80 shadow-xl shadow-accent/5 flex items-center justify-center shrink-0 animate-in fade-in zoom-in-95">
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
              </div>

              {/* Message Bubble Container */}
              <div
                className={`max-w-[85%] rounded-2xl p-4 transition-all ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-tr from-accent/90 to-accent text-white shadow-lg shadow-accent/15'
                    : 'bg-card border border-card-border text-slate-100 shadow-md w-full'
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

                {/* Tool Execution Cards */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {msg.toolCalls.map((tc) => {
                      const isExpanded = expandedTools[tc.id];
                      return (
                        <div
                          key={tc.id}
                          className="rounded-xl border border-card-border bg-panel overflow-hidden"
                        >
                          <button
                            onClick={() => toggleTool(tc.id)}
                            className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-card transition-colors text-left"
                          >
                            <div className="flex items-center space-x-2">
                              {getToolIcon(tc.name)}
                              <span className="font-mono font-semibold text-slate-200">
                                {tc.name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {tc.status === 'running' && (
                                <span className="flex items-center text-[10px] text-amber-400">
                                  <Clock className="w-3 h-3 mr-1 animate-spin" /> Executando...
                                </span>
                              )}
                              {tc.status === 'completed' && (
                                <span className="flex items-center text-[10px] text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Concluído
                                </span>
                              )}
                              {tc.status === 'error' && (
                                <span className="flex items-center text-[10px] text-rose-400">
                                  <AlertCircle className="w-3 h-3 mr-1" /> Erro
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-3 border-t border-card-border text-[11px] font-mono space-y-2 bg-background/50">
                              <div>
                                <span className="text-slate-500 uppercase text-[9px] font-bold block mb-1">
                                  Argumentos:
                                </span>
                                <pre className="text-slate-300 p-2 rounded bg-panel overflow-x-auto">
                                  {tc.arguments}
                                </pre>
                              </div>
                              {tc.result && (
                                <div>
                                  <span className="text-slate-500 uppercase text-[9px] font-bold block mb-1">
                                    Resultado:
                                  </span>
                                  <pre className="text-emerald-300 p-2 rounded bg-panel overflow-x-auto max-h-48 overflow-y-auto">
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
                    <div className={`prose prose-invert max-w-none text-xs leading-relaxed break-words ${msg.role === 'user' ? 'text-white' : 'text-slate-100'}`}>
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
                                  title={`Abrir "${cleanTarget}" no FrankMD Vault`}
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
      <div className="p-4 border-t border-card-border bg-sidebar shrink-0 space-y-2.5">
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
                Anotação <strong>"{createdNoteInfo.title}"</strong> criada no FrankMD Vault!
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
                    setInput('Anote isso: faça o reconhecimento desta anotação do meu caderno e salve como nota no FrankMD Vault.');
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
          {attachments.some(att => att.isImage) && (
            <button
              onClick={() => {
                setInput('Anote isso: faça o reconhecimento desta anotação do meu caderno e salve como nota no FrankMD Vault.');
                textareaRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 transition-colors whitespace-nowrap flex items-center space-x-1 font-semibold animate-pulse"
              title="Digitalizar caligrafia da foto e salvar no FrankMD Vault"
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
              onClick={onClearChat}
              className="px-2 py-1 rounded-lg bg-card hover:bg-rose-950/30 border border-card-border hover:border-rose-800/40 text-slate-400 hover:text-rose-300 transition-colors ml-auto flex items-center space-x-1"
              title="Limpar Conversa"
            >
              <Trash2 className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* Auto-Expanding Input Bar Card (Flexbox - Buttons NEVER overlap text!) */}
        <div className={`rounded-2xl bg-card border border-card-border focus-within:border-accent shadow-xl shadow-black/40 transition-all flex flex-col p-3 gap-2.5 ${
          isExpandedEditor ? 'ring-2 ring-accent/30' : ''
        }`}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.txt,.json,.js,.ts,.tsx,.py,.md"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Top Bar inside Input Box: Expand Button & Status */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-0.5">
            <span className="text-[10px] text-slate-500">
              {input.length > 0 ? `${input.length} caracteres` : 'Escreva uma mensagem ou instrução para o agente...'}
            </span>
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
            onChange={(e) => {
              setInput(e.target.value);
              // Trigger mention modal if user typed @
              if (e.target.value.endsWith('@')) {
                onOpenMentionModal();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem, instrução para o agente, ou use @ para citar outro chat..."
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed overflow-y-auto font-sans"
            style={{ minHeight: isExpandedEditor ? '240px' : '48px' }}
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
                title="Criar nota estruturada no FrankMD Vault com os pontos chave e resumo da conversa (/nota)"
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
                onClick={onStopStreaming}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-rose-600/30 transition-all"
              >
                <Square className="w-3 h-3" />
                <span>Interromper</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && attachments.length === 0}
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md ${
                  input.trim() || attachments.length > 0
                    ? 'bg-accent hover:bg-accent-hover shadow-accent/30'
                    : 'bg-card-border text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Enviar</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
