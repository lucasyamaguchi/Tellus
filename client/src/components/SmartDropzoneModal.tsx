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
  Folder 
} from 'lucide-react';
import { IncomingDropzoneFile, DropzoneOrganizeReport, OrganizedFileResult } from '../types';
import { api } from '../api';

interface SmartDropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNote?: (noteTitle: string) => void;
  onRefreshNotes?: () => void;
  initialFiles?: File[] | null;
}

export const SmartDropzoneModal: React.FC<SmartDropzoneModalProps> = ({
  isOpen,
  onClose,
  onOpenNote,
  onRefreshNotes,
  initialFiles
}) => {
  const [selectedFiles, setSelectedFiles] = useState<IncomingDropzoneFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [report, setReport] = useState<DropzoneOrganizeReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        // Strip data:mime/type;base64, prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Drag & drop handlers
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
    // reset input so user can re-upload same file if desired
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setReport(null);
    setErrorMessage(null);
  };

  const handleExecuteOrganize = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await api.organizeDropzoneFiles(selectedFiles);
      setReport(res);
      onRefreshNotes?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao organizar arquivos com IA');
    } finally {
      setIsProcessing(false);
    }
  };

  const getFileIcon = (filename: string, mimeType: string) => {
    const lower = filename.toLowerCase();
    if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) {
      return <ImageIcon className="w-5 h-5 text-purple-400" />;
    }
    if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-400" />;
    }
    if (/\.(csv|xlsx?|tsv)$/i.test(lower)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    if (/\.(ts|tsx|js|jsx|py|java|cpp|json|html|css)$/i.test(lower)) {
      return <FileCode className="w-5 h-5 text-cyan-400" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#0e121a] border border-card-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-card-border bg-[#131824] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center text-brand-cyan shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-100">Smart Dropzone com Auto-Organização</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-semibold">
                  IA Archivist
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Insira arquivos, imagens ou PDFs. A IA analisa o conteúdo, organiza nas pastas e emite um relatório com a justificativa.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2.5 text-rose-300 text-xs animate-in shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. If Report exists, show detailed report results */}
          {report ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <FolderCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-300">Organização Concluída com Sucesso!</h4>
                    <p className="text-xs text-slate-300">
                      {report.successfulCount} de {report.totalFiles} arquivos arquivados com sucesso no Vault.
                    </p>
                  </div>
                </div>

                {report.reportNotePath && (
                  <button
                    onClick={() => {
                      const cleanTitle = report.reportNotePath?.replace(/\.md$/i, '').split('/').pop() || '';
                      onOpenNote?.(cleanTitle);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs font-semibold text-slate-200 flex items-center space-x-1.5 transition-colors shrink-0"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-accent-light" />
                    <span>Ver Relatório no Vault</span>
                  </button>
                )}
              </div>

              {/* List of Organized Files with Reasons */}
              <div className="space-y-2.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Relatório Detalhado: Onde e Por Que Foi Colocado
                </h5>

                <div className="space-y-2">
                  {report.results.map((item: OrganizedFileResult) => (
                    <div 
                      key={item.id} 
                      className={`p-3.5 rounded-xl border transition-all ${
                        item.success 
                          ? 'bg-card border-card-border hover:border-slate-600' 
                          : 'bg-rose-500/5 border-rose-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3">
                          <div className="mt-0.5 shrink-0">
                            {getFileIcon(item.savedName, item.fileType)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-xs text-white">{item.savedName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({(item.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>

                            {/* Destination Folder Badge */}
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className="text-[10px] text-slate-400 font-mono">Destino no Vault:</span>
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30 flex items-center space-x-1">
                                <Folder className="w-3 h-3" />
                                <span>{item.targetFolder}</span>
                              </span>
                            </div>

                            {/* AI Decision Reason Highlight */}
                            <div className="mt-2 p-2.5 rounded-lg bg-[#0b0e14] border border-card-border/70 text-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono block">
                                💡 Por que foi colocado aqui:
                              </span>
                              <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                                {item.reason}
                              </p>
                              {item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {item.tags.map(t => (
                                    <span key={t} className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-panel text-slate-400 border border-card-border">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Open Button */}
                        {item.success && (
                          <button
                            onClick={() => {
                              const noteTitle = item.savedName.replace(/\.md$/i, '');
                              onOpenNote?.(noteTitle);
                              onClose();
                            }}
                            className="p-1.5 rounded-lg bg-panel hover:bg-card-border text-slate-400 hover:text-brand-cyan transition-colors shrink-0"
                            title="Abrir no FrankMD"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons to reset */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-4 py-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-200 font-semibold transition-colors flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Organizar Mais Arquivos</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-lg shadow-accent/20 transition-all"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            /* 2. Drag & Drop Upload Zone */
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDraggingOver
                    ? 'border-brand-cyan bg-brand-cyan/10 scale-[1.01]'
                    : 'border-card-border hover:border-slate-500 bg-card/40 hover:bg-card/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan mb-3 shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-100">
                  Arraste e solte arquivos aqui, ou <span className="text-brand-cyan underline">clique para selecionar</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Suporta PDFs, imagens (PNG, JPG, WebP), textos, documentos, código e planilhas. A IA cuidará da categorização.
                </p>
              </div>

              {/* Selected Files Queue */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Arquivos na fila ({selectedFiles.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[11px] text-rose-400 hover:underline flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Limpar lista</span>
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-card border border-card-border/80 text-xs"
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          {getFileIcon(file.name, file.type)}
                          <span className="text-slate-200 font-medium truncate">{file.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1 rounded-lg hover:bg-card-border text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteOrganize}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition-all ${
                        isProcessing
                          ? 'bg-brand-cyan/40 text-slate-900 cursor-wait'
                          : 'bg-gradient-to-r from-brand-cyan to-accent text-slate-950 hover:brightness-110 shadow-brand-cyan/20'
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Analisando conteúdo e organizando no Vault...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-slate-950" />
                          <span>Organizar {selectedFiles.length} {selectedFiles.length === 1 ? 'Arquivo' : 'Arquivos'} com IA & Emitir Relatório</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
