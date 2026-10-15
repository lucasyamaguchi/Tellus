import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  X, 
  FileText, 
  Image as ImageIcon, 
  FileCode, 
  FileSpreadsheet, 
  File, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  FolderCheck, 
  ArrowRight, 
  ExternalLink, 
  BookOpen, 
  Trash2, 
  RefreshCw, 
  Folder,
  MessageSquare,
  Video,
  Clipboard,
  Paperclip,
  Lightbulb,
  Tag
} from 'lucide-react';
import { IncomingDropzoneFile, DropzoneOrganizeReport, OrganizedFileResult } from '../types';
import { api } from '../api';

interface SmartDropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNote?: (noteTitle: string) => void;
  onRefreshNotes?: () => void;
  initialFiles?: File[] | null;
  targetProjectPath?: string;
  onOpenSkills?: () => void;
}

export const SmartDropzoneModal: React.FC<SmartDropzoneModalProps> = ({
  isOpen,
  onClose,
  onOpenNote,
  onRefreshNotes,
  initialFiles,
  targetProjectPath,
  onOpenSkills
}) => {
  const [textDump, setTextDump] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<IncomingDropzoneFile[]>([]);
  const [defaultSkillScope, setDefaultSkillScope] = useState<'project' | 'global' | 'situational'>(targetProjectPath ? 'project' : 'global');
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [report, setReport] = useState<DropzoneOrganizeReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Convert File objects to Base64
  const processFileList = async (fileList: FileList | File[]) => {
    setErrorMessage(null);
    const newFiles: IncomingDropzoneFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      try {
        const base64 = await fileToBase64(f);
        newFiles.push({
          name: f.name,
          type: f.type || 'application/octet-stream',
          size: f.size,
          base64Data: base64
        });
      } catch (err: any) {
        console.error(`Erro ao ler arquivo ${f.name}:`, err);
      }
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      processFileList(initialFiles);
    }
  }, [isOpen, initialFiles]);

  if (!isOpen) return null;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileList(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFileList(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setTextDump('');
    setReport(null);
    setErrorMessage(null);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTextDump(prev => prev ? `${prev}\n\n${text}` : text);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    } catch {
      setErrorMessage('Não foi possível ler a área de transferência. Use Ctrl+V diretamente no campo.');
    }
  };

  const handleInsertWhatsAppExample = () => {
    const example = `[14:22, 10/10/2026] Lucas: Lembrete importante sobre o projeto: em JWT devemos usar RS256 com chave assimétrica em vez de HS256 em microsserviços para não compartilhar o segredo comum entre todos os nós.
[14:25, 10/10/2026] Lucas: Outra coisa que vi na aula de Docker: no Dockerfile, usar multi-stage build reduz a imagem do Node de 1.1GB para apenas 130MB rodando com Alpine e apenas as dependências de produção!
[15:10, 10/10/2026] Lucas: Sobre o concurso/edital: o Artigo 37 da Constituição traz os princípios LIMPE (Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência). Preciso revisar a regra do teto remuneratório.`;
    setTextDump(example);
  };

  const handleInsertTranscriptExample = () => {
    const example = `00:01 Olá pessoal, nesta aula vamos falar sobre duas coisas fundamentais em engenharia de dados.
01:15 Primeiro: o padrão Medallion em Lakehouse. A camada Bronze guarda os dados brutos sem transformação. A camada Silver aplica limpeza, deduplicação e schema enforcement. A camada Gold agrega métricas de negócio para os dashboards.
08:40 Segundo ponto da aula: particionamento no Apache Iceberg. Ao contrário do Hive que cria pastas físicas rígidas, o Iceberg suporta hidden partitioning e partition evolution sem precisar reescrever tabelas inteiras.`;
    setTextDump(example);
  };

  const handleExecuteOrganize = async () => {
    const hasFiles = selectedFiles.length > 0;
    const hasText = textDump.trim().length > 0;

    if (!hasFiles && !hasText) {
      setErrorMessage('Por favor, digite/cole ideias, conversas do WhatsApp ou anexe arquivos antes de iniciar.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStep('Decompondo temas e consultando pastas do Vault...');

    try {
      const res = await api.organizeDropzoneFiles({
        files: selectedFiles,
        textDump: textDump.trim(),
        targetProjectPath,
        defaultSkillScope
      });
      setReport(res);
      onRefreshNotes?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao organizar conteúdo com IA');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const getFileBadge = (item: OrganizedFileResult) => {
    switch (item.fileType) {
      case 'skill':
        return (
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Skill do Agente</span>
          </span>
        );
      case 'whatsapp':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            <span>WhatsApp</span>
          </span>
        );
      case 'transcript':
        return (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-mono flex items-center gap-1">
            <Video className="w-3 h-3" />
            <span>Transcrição</span>
          </span>
        );
      case 'idea':
      case 'note':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            <span>Nota / Ideia</span>
          </span>
        );
      case 'pdf':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-mono flex items-center gap-1">
            <FileText className="w-3 h-3" />
            <span>PDF</span>
          </span>
        );
      case 'image':
        return (
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            <span>Imagem</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-500/20 border border-slate-500/30 text-slate-300 text-[10px] font-mono flex items-center gap-1">
            <File className="w-3 h-3" />
            <span>Arquivo</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in select-none">
      <div className="bg-[#0b0e14] border border-card-border/90 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-card-border/80 bg-card/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-cyan/20 to-purple-600/20 border border-brand-cyan/40 flex items-center justify-center text-brand-cyan shrink-0 shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-100">Smart Ingestion Stream & Brain Dump</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-cyan/15 border border-brand-cyan/35 text-brand-cyan font-semibold">
                  IA Arquivista
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Campo unificado: jogue conversas de WhatsApp, transcrições de vídeo, arquivos ou ideias soltas. A IA separa os temas e cria notas no Vault.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-card-border text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 select-text scrollbar-thin scrollbar-thumb-card-border">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2.5 text-rose-300 text-xs animate-in shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. REPORT VIEW (If processing finished) */}
          {report ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <FolderCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-300">Organização Concluída com Sucesso!</h4>
                    <p className="text-xs text-slate-300">
                      {report.successfulCount} itens e notas estruturados e arquivados no Vault ({report.vaultPath}).
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 rounded-xl bg-panel hover:bg-card-border border border-card-border text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Novo Envio</span>
                  </button>

                  {report.reportNotePath && (
                    <button
                      onClick={() => {
                        const cleanTitle = report.reportNotePath?.replace(/\.md$/i, '').split('/').pop() || '';
                        onOpenNote?.(cleanTitle);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-accent/25 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Ver Relatório no Vault</span>
                    </button>
                  )}
                </div>
              </div>

              {/* List of Created / Organized Notes and Files */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Notas Criadas & Justificativas de Alocação
                  </h5>
                  <span className="text-[11px] font-mono text-slate-500">
                    {report.results.length} notas/arquivos
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {report.results.map((item: OrganizedFileResult) => (
                    <div 
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-card border border-card-border/80 hover:border-accent/40 transition-all flex flex-col gap-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {getFileBadge(item)}
                          <div className="truncate">
                            <span className="font-bold text-xs text-slate-100 truncate block">
                              {item.savedName.replace(/\.md$/i, '')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Folder className="w-3 h-3 text-amber-400/80" />
                              <span>{item.targetFolder}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {item.fileType === 'skill' && onOpenSkills && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenSkills();
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-cyan-400" />
                              <span>Ver na Aba de Skills</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const targetTitle = item.noteTitle || item.savedName.replace(/\.md$/i, '');
                              onOpenNote?.(targetTitle);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent border border-accent/30 hover:border-accent text-accent-light hover:text-white text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Abrir no Vault</span>
                          </button>
                        </div>
                      </div>

                      {/* Skill Scope Selector (Project vs Global vs Situational) */}
                      {item.fileType === 'skill' && (
                        <div className="p-2.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 text-[11px] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold uppercase text-cyan-300 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>Escopo da Skill no Tellus:</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.skillScope === 'project' ? '📌 Focada no Projeto Atual' : item.skillScope === 'situational' ? '⚡ Sob Demanda / Situacional' : '🌐 Global na Raiz'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              disabled={updatingSkillId === item.id}
                              onClick={async () => {
                                setUpdatingSkillId(item.id);
                                try {
                                  await api.saveSkill({
                                    id: item.skillId || item.savedName.replace(/\.md$/i, ''),
                                    name: item.skillName || item.savedName.replace(/\.md$/i, ''),
                                    scope: 'project',
                                    isProjectSpecific: true,
                                    targetProjectPath
                                  });
                                  item.skillScope = 'project';
                                } finally {
                                  setUpdatingSkillId(null);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                                item.skillScope === 'project'
                                  ? 'bg-cyan-500 text-white border-cyan-400 shadow-xs'
                                  : 'bg-card border-card-border text-slate-400 hover:text-white'
                              }`}
                            >
                              📌 Focada no Projeto Atual
                            </button>
                            <button
                              type="button"
                              disabled={updatingSkillId === item.id}
                              onClick={async () => {
                                setUpdatingSkillId(item.id);
                                try {
                                  await api.saveSkill({
                                    id: item.skillId || item.savedName.replace(/\.md$/i, ''),
                                    name: item.skillName || item.savedName.replace(/\.md$/i, ''),
                                    scope: 'global',
                                    isProjectSpecific: false
                                  });
                                  item.skillScope = 'global';
                                } finally {
                                  setUpdatingSkillId(null);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                                item.skillScope === 'global'
                                  ? 'bg-cyan-500 text-white border-cyan-400 shadow-xs'
                                  : 'bg-card border-card-border text-slate-400 hover:text-white'
                              }`}
                            >
                              🌐 Global na Raiz
                            </button>
                            <button
                              type="button"
                              disabled={updatingSkillId === item.id}
                              onClick={async () => {
                                setUpdatingSkillId(item.id);
                                try {
                                  await api.saveSkill({
                                    id: item.skillId || item.savedName.replace(/\.md$/i, ''),
                                    name: item.skillName || item.savedName.replace(/\.md$/i, ''),
                                    scope: 'situational',
                                    isProjectSpecific: false,
                                    isActive: false
                                  });
                                  item.skillScope = 'situational';
                                } finally {
                                  setUpdatingSkillId(null);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                                item.skillScope === 'situational'
                                  ? 'bg-amber-500 text-white border-amber-400 shadow-xs'
                                  : 'bg-card border-card-border text-slate-400 hover:text-white'
                              }`}
                            >
                              ⚡ Somente Situacional
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Reason & Context */}
                      <div className="p-2.5 rounded-xl bg-panel/70 border border-card-border/60 text-[11px] text-slate-300 space-y-1">
                        <div className="flex items-center space-x-1 font-semibold text-amber-300/90 text-[10px] uppercase font-mono">
                          <Sparkles className="w-3 h-3" />
                          <span>Por que foi colocado nesta pasta:</span>
                        </div>
                        <p className="leading-relaxed text-slate-300">{item.reason}</p>
                        {item.summary && (
                          <p className="text-[10px] text-slate-400 pt-0.5 border-t border-card-border/40 leading-relaxed">
                            <strong>Resumo:</strong> {item.summary}
                          </p>
                        )}
                      </div>

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {item.tags.map((t, idx) => (
                            <span key={idx} className="text-[10px] font-mono text-brand-cyan/90 bg-brand-cyan/10 px-1.5 py-0.5 rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* 2. UNIFIED INGESTION FORM VIEW */
            <div className="space-y-4">
              {/* Quick Template / Inspiration Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>Entrada Rápida & Exemplos:</span>
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card-border border border-card-border text-[11px] text-slate-300 hover:text-white flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <Clipboard className="w-3 h-3 text-brand-cyan" />
                    <span>Colar Área de Transferência</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertWhatsAppExample}
                    className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card-border border border-card-border text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Exemplo WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertTranscriptExample}
                    className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card-border border border-card-border text-[11px] text-purple-400 hover:text-purple-300 flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <Video className="w-3 h-3" />
                    <span>Exemplo Transcrição</span>
                  </button>
                </div>
              </div>

              {/* Main Textarea (Brain Dump) */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={textDump}
                  onChange={(e) => setTextDump(e.target.value)}
                  placeholder="Escreva livremente suas ideias, cole conversas do WhatsApp, transcrições de vídeos do YouTube ou anotações desordenadas... O Tellus irá analisar, separar os temas e criar notas estruturadas no Vault."
                  rows={8}
                  className="w-full bg-card border border-card-border/80 focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-2xl p-4 text-xs text-slate-100 placeholder-slate-500 leading-relaxed focus:outline-none transition-all resize-y font-mono"
                />

                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-500 bg-background/80 px-2 py-0.5 rounded-md pointer-events-none">
                  {textDump.length} caracteres
                </div>
              </div>

              {/* Drag & Drop Zone for Associated Files */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  isDraggingOver
                    ? 'border-brand-cyan bg-brand-cyan/10 scale-[1.01]'
                    : 'border-card-border/70 hover:border-slate-500 bg-panel/30 hover:bg-panel/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-2xl bg-card border border-card-border flex items-center justify-center text-slate-400">
                  <Paperclip className="w-5 h-5 text-accent-light" />
                </div>

                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-200">
                    Anexar Arquivos, Mídias ou Documentos (Opcional)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Arraste ou clique para anexar PDFs, imagens, áudios, tabelas ou código
                  </p>
                </div>
              </div>

              {/* Staged Files Chips */}
              {selectedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[11px]">Arquivos Anexados ({selectedFiles.length}):</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      Remover todos os arquivos
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-card border border-card-border text-xs text-slate-200"
                      >
                        <FileText className="w-3.5 h-3.5 text-accent-light" />
                        <span className="truncate max-w-[200px] text-[11px]">{file.name}</span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                          className="p-0.5 rounded hover:bg-card-border text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Skill Scope Default Selector if .md files are staged */}
                  {selectedFiles.some(f => /\.(md|markdown)$/i.test(f.name)) && (
                    <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between flex-wrap gap-2 text-xs mt-2">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-200 block text-[11px]">
                            Arquivo(s) Markdown / Skill detectado(s)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Caso contenham estrutura de skill de IA, definir escopo inicial:
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDefaultSkillScope('project')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                            defaultSkillScope === 'project'
                              ? 'bg-cyan-500 text-white border-cyan-400 shadow-xs'
                              : 'bg-card border-card-border text-slate-400 hover:text-white'
                          }`}
                        >
                          📌 Projeto Atual
                        </button>
                        <button
                          type="button"
                          onClick={() => setDefaultSkillScope('global')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                            defaultSkillScope === 'global'
                              ? 'bg-cyan-500 text-white border-cyan-400 shadow-xs'
                              : 'bg-card border-card-border text-slate-400 hover:text-white'
                          }`}
                        >
                          🌐 Global Raiz
                        </button>
                        <button
                          type="button"
                          onClick={() => setDefaultSkillScope('situational')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                            defaultSkillScope === 'situational'
                              ? 'bg-amber-500 text-white border-amber-400 shadow-xs'
                              : 'bg-card border-card-border text-slate-400 hover:text-white'
                          }`}
                        >
                          ⚡ Situacional
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="p-4 border-t border-card-border/80 bg-card/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            {!report && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isProcessing || (!textDump && selectedFiles.length === 0)}
                className="px-3 py-1.5 rounded-xl bg-panel hover:bg-card-border border border-card-border text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
              >
                Limpar Campos
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-panel hover:bg-card-border border border-card-border text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {report ? 'Fechar' : 'Cancelar'}
            </button>

            {!report && (
              <button
                type="button"
                onClick={handleExecuteOrganize}
                disabled={isProcessing || (!textDump.trim() && selectedFiles.length === 0)}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-accent/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{processingStep || 'Classificando & Criando Notas...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Classificar, Separar Ideias & Criar Notas</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
