import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  Folder, 
  FolderPlus,
  ShieldCheck, 
  Network, 
  Edit3, 
  Sparkles,
  Link as LinkIcon,
  MessageSquareQuote,
  ArrowLeft,
  Copy,
  Check,
  Tag,
  GraduationCap,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  FolderOpen,
  Wand2,
  FolderInput,
  MoveRight,
  GripVertical,
  Eye
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FrankNote, GraphData } from '../types';
import { api } from '../api';

interface FrankNoteViewProps {
  onMentionInChat?: (note: FrankNote) => void;
  onStudyTopic?: (topic: string) => void;
  onReturnToAgent?: () => void;
}

export const FrankNoteView: React.FC<FrankNoteViewProps> = ({
  onMentionInChat,
  onStudyTopic,
  onReturnToAgent
}) => {
  const [notes, setNotes] = useState<FrankNote[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<{ [f: string]: boolean }>({});
  const [activeNote, setActiveNote] = useState<FrankNote | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'editor' | 'graph'>('editor');
  
  // Note View Mode: 'preview' (Default) vs 'edit'
  const [noteViewMode, setNoteViewMode] = useState<'preview' | 'edit'>('preview');

  const [editContent, setEditContent] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editFolder, setEditFolder] = useState<string>('Geral');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Folder Creation State
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  // Drag and Drop & Move State (Notes & Folders)
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [draggedFolderName, setDraggedFolderName] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [moveModalNote, setMoveModalNote] = useState<FrankNote | null>(null);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>('Geral');
  const [newMoveFolderName, setNewMoveFolderName] = useState<string>('');

  // Notion Import Modal State
  const [isNotionModalOpen, setIsNotionModalOpen] = useState<boolean>(false);
  const [notionPasteTitle, setNotionPasteTitle] = useState<string>('');
  const [notionPasteContent, setNotionPasteContent] = useState<string>('');
  const [notionTargetFolder, setNotionTargetFolder] = useState<string>('Notion Import');
  const [isImportingNotion, setIsImportingNotion] = useState<boolean>(false);

  // Text Selection & Context Menu for Study Engine
  const [selectedText, setSelectedText] = useState<string>('');
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showFloatingAction, setShowFloatingAction] = useState<boolean>(false);
  const [floatingActionPos, setFloatingActionPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenuPos(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const fetchNotesAndFolders = async () => {
    try {
      const [notesList, foldersList] = await Promise.all([
        api.listNotes(),
        api.listFolders()
      ]);
      setNotes(notesList);
      setFolders(foldersList);
      if (notesList.length > 0 && !activeNote) {
        selectNote(notesList[0]);
      }
    } catch {
      // ignore
    }
  };

  const handleMoveNote = async (noteId: string, targetFolder: string) => {
    try {
      const updated = await api.moveNote(noteId, targetFolder);
      await fetchNotesAndFolders();
      if (activeNote?.id === noteId) {
        setActiveNote(updated);
        setEditFolder(updated.folder || updated.subject || targetFolder);
      }
      setMoveModalNote(null);
    } catch (err: any) {
      alert(`Erro ao mover nota: ${err.message}`);
    }
  };

  const handleMoveFolder = async (sourceFolder: string, targetParentFolder: string) => {
    try {
      await api.moveFolder(sourceFolder, targetParentFolder);
      await fetchNotesAndFolders();
    } catch (err: any) {
      alert(`Erro ao mover pasta: ${err.message}`);
    }
  };

  const fetchGraph = async () => {
    try {
      const data = await api.getNotesGraph();
      setGraphData(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotesAndFolders();
  }, []);

  useEffect(() => {
    if (viewMode === 'graph') {
      fetchGraph();
    }
  }, [viewMode]);

  const selectNote = (note: FrankNote) => {
    setActiveNote(note);
    setEditTitle(note.title);
    setEditFolder(note.folder || note.subject || 'Geral');
    setEditContent(note.content);
    setNoteViewMode('preview'); // Always open in formatted preview first!
  };

  const handleCreateNoteInFolder = (folderName: string = 'Geral') => {
    const newNoteTemplate = {
      title: 'Nova Anotação ' + new Date().toLocaleDateString('pt-BR'),
      folder: folderName,
      subject: folderName,
      content: `# Nova Anotação\n\nEscreva suas notas aqui no formato Notion/Markdown.\n\nUse \`[[Nome de Outra Nota]]\` para criar conexões e #tags para categorizar.\n`,
      isProjectSpecific: false
    };

    api.saveNote(newNoteTemplate).then((created) => {
      fetchNotesAndFolders();
      setActiveNote(created);
      setEditTitle(created.title);
      setEditFolder(created.folder || folderName);
      setEditContent(created.content);
      setNoteViewMode('edit'); // Open new notes in edit mode
    });
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.createFolder(newFolderName.trim());
      setIsCreatingFolder(false);
      setNewFolderName('');
      await fetchNotesAndFolders();
    } catch (err: any) {
      alert(`Erro ao criar pasta: ${err.message}`);
    }
  };

  const toggleFolderCollapse = (folderName: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const handleReviewFolderWithAgent = (folderName: string) => {
    const folderNotes = notes.filter(n => (n.folder || n.subject || 'Geral') === folderName);
    if (folderNotes.length === 0) {
      alert(`A pasta "${folderName}" está vazia.`);
      return;
    }

    const payload = `Quero fazer uma revisão e aprimoramento visual completo de todas as anotações da pasta "${folderName}".

Aqui estão as notas atuais da pasta:

${folderNotes.map(n => `### [[${n.title}]] (Arquivo: ${n.filename})\n${n.content}`).join('\n\n---\n\n')}

Por favor, revise o conteúdo, organize com títulos hierárquicos, tabelas comparativas, diagramas Mermaid, callouts de destaque e checklists estruturados para deixar as anotações visualmente muito agradáveis, claras e profissionais. Salve as melhorias diretamente no FrankMD Vault usando a ferramenta frank_note_save.`;

    if (onMentionInChat) {
      onMentionInChat({
        id: `review-${folderName}`,
        title: `Revisão de Notas: ${folderName}`,
        filename: 'folder_review.md',
        folder: folderName,
        subject: folderName,
        tags: ['#revisao', '#formatacao'],
        content: payload,
        links: folderNotes.map(n => n.title),
        backlinks: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  };

  const handleSaveActiveNote = async () => {
    if (!activeNote) return;
    setIsSaving(true);
    try {
      const updated = await api.saveNote({
        id: activeNote.id,
        title: editTitle,
        folder: editFolder,
        subject: editFolder,
        content: editContent,
        isProjectSpecific: activeNote.isProjectSpecific
      });
      setActiveNote(updated);
      setNoteViewMode('preview'); // Switch to preview after saving
      fetchNotesAndFolders();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id: string, isProjectSpecific?: boolean) => {
    if (!confirm('Deseja mover esta anotação para o backup de segurança e deletar?')) return;
    try {
      await api.deleteNote(id, isProjectSpecific);
      const remaining = notes.filter(n => n.id !== id);
      setNotes(remaining);
      if (remaining.length > 0) selectNote(remaining[0]);
      else setActiveNote(null);
    } catch (err: any) {
      alert(`Erro ao deletar: ${err.message}`);
    }
  };

  const handleImportNotionPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notionPasteTitle.trim() || !notionPasteContent.trim()) return;

    setIsImportingNotion(true);
    try {
      await api.importNotionNotes([{
        filename: `${notionPasteTitle.trim()}.md`,
        content: notionPasteContent,
        folder: notionTargetFolder.trim() || 'Notion Import'
      }]);
      setIsNotionModalOpen(false);
      setNotionPasteTitle('');
      setNotionPasteContent('');
      await fetchNotesAndFolders();
      alert('Nota importada com sucesso do Notion!');
    } catch (err: any) {
      alert(`Erro ao importar nota: ${err.message}`);
    } finally {
      setIsImportingNotion(false);
    }
  };

  const handleImportNotionFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImportingNotion(true);
    try {
      const items: Array<{ filename: string; content: string; folder?: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          const text = await file.text();
          items.push({
            filename: file.name,
            content: text,
            folder: notionTargetFolder.trim() || 'Notion Import'
          });
        }
      }

      if (items.length > 0) {
        const res = await api.importNotionNotes(items);
        alert(`${res.importedCount} notas importadas com sucesso do Notion!`);
        setIsNotionModalOpen(false);
        await fetchNotesAndFolders();
      }
    } catch (err: any) {
      alert(`Erro ao importar arquivos: ${err.message}`);
    } finally {
      setIsImportingNotion(false);
    }
  };

  const copyNoteContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTextSelection = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';
      if (text && text.length >= 2) {
        setSelectedText(text);
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setFloatingActionPos({
            x: Math.min(Math.max(rect.left + rect.width / 2 - 130, 20), window.innerWidth - 320),
            y: Math.max(rect.top - 48, 12)
          });
          setShowFloatingAction(true);
        }
      } else {
        setShowFloatingAction(false);
      }
    }, 20);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length >= 2) {
      e.preventDefault();
      setSelectedText(selection);
      setContextMenuPos({
        x: Math.min(e.clientX, window.innerWidth - 260),
        y: Math.min(e.clientY, window.innerHeight - 200)
      });
      setShowFloatingAction(false);
    }
  };

  // Group notes by folder
  const allFolderNames = Array.from(new Set([
    ...folders,
    ...notes.map(n => n.folder || n.subject || 'Geral')
  ]));

  const filteredNotes = notes.filter(n => {
    const matchesQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = selectedFolderFilter === 'all' || (n.folder || n.subject || 'Geral') === selectedFolderFilter;
    return matchesQuery && matchesFolder;
  });

  return (
    <div className="h-full flex flex-col bg-background text-slate-200 overflow-hidden select-none font-sans relative">
      {/* Floating Action Pill on Text Selection */}
      {showFloatingAction && selectedText && (
        <div
          style={{ left: `${floatingActionPos.x}px`, top: `${floatingActionPos.y}px` }}
          className="fixed z-50 bg-card/95 backdrop-blur-md border border-accent/60 shadow-2xl rounded-2xl p-1.5 flex items-center space-x-1.5 animate-in fade-in zoom-in-95"
        >
          <button
            onClick={() => {
              setShowFloatingAction(false);
              onStudyTopic?.(selectedText);
            }}
            className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
            title="Iniciar Roteiro de Estudo Ativo no Chat"
          >
            <GraduationCap className="w-3.5 h-3.5 text-accent-light" />
            <span>Estudar sobre "{selectedText.slice(0, 20)}{selectedText.length > 20 ? '...' : ''}"</span>
          </button>

          <button
            onClick={() => {
              setShowFloatingAction(false);
              if (activeNote) {
                onMentionInChat?.({
                  ...activeNote,
                  content: `Pergunta sobre o trecho "${selectedText}" na anotação [[${activeNote.title}]]:\n\n${activeNote.content}`
                });
              }
            }}
            className="p-1.5 rounded-xl hover:bg-card-border text-slate-300 hover:text-white transition-colors"
            title="Perguntar no Chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Right Click Context Menu */}
      {contextMenuPos && selectedText && (
        <div
          style={{ left: `${contextMenuPos.x}px`, top: `${contextMenuPos.y}px` }}
          className="fixed z-50 bg-card border border-card-border shadow-2xl rounded-2xl p-1.5 min-w-[250px] flex flex-col space-y-1 animate-in fade-in zoom-in-95 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-card-border text-[10px] text-slate-400 font-mono truncate">
            Seleção: <strong className="text-slate-200">"{selectedText.slice(0, 24)}{selectedText.length > 24 ? '...' : ''}"</strong>
          </div>

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              onStudyTopic?.(selectedText);
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl bg-accent/20 hover:bg-accent text-accent-light hover:text-white font-semibold flex items-center space-x-2 transition-all"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Pesquisar e Estudar sobre</span>
          </button>

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              if (activeNote) {
                onMentionInChat?.({
                  ...activeNote,
                  content: `Explique detalhadamente o trecho "${selectedText}" da anotação [[${activeNote.title}]]:\n\n${activeNote.content}`
                });
              }
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-panel text-slate-300 hover:text-white flex items-center space-x-2 transition-all"
          >
            <HelpCircle className="w-4 h-4 text-brand-cyan" />
            <span>Explicar este Trecho no Chat</span>
          </button>

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              const newNoteTemplate = {
                title: selectedText.slice(0, 40),
                folder: activeNote?.folder || 'Estudos',
                subject: activeNote?.folder || 'Estudos',
                content: `# ${selectedText}\n\nConceito referenciado a partir de [[${activeNote?.title || 'Nota Anterior'}]].\n\n## Definição e Anotações\n`,
                isProjectSpecific: activeNote?.isProjectSpecific || false
              };
              api.saveNote(newNoteTemplate).then((created) => {
                fetchNotesAndFolders();
                selectNote(created);
              });
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-panel text-slate-300 hover:text-white flex items-center space-x-2 transition-all"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Criar Nota [[{selectedText.slice(0, 16)}]]</span>
          </button>
        </div>
      )}

      {/* Quick Move Note Modal */}
      {moveModalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none">
          <div className="bg-card border border-card-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <FolderInput className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Mover Anotação para Pasta</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[280px]">"{moveModalNote.title}"</p>
                </div>
              </div>
              <button onClick={() => setMoveModalNote(null)} className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Selecione a Pasta de Destino:</span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-card-border">
                {allFolderNames.map(f => (
                  <button
                    key={f}
                    onClick={() => handleMoveNote(moveModalNote.id, f)}
                    className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between transition-all ${
                      (moveModalNote.folder || moveModalNote.subject || 'Geral') === f
                        ? 'bg-accent/20 border-accent text-accent-light font-semibold'
                        : 'bg-panel border-card-border text-slate-300 hover:bg-card-border hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>{f}</span>
                    </div>
                    {(moveModalNote.folder || moveModalNote.subject || 'Geral') === f && (
                      <span className="text-[10px] text-accent-light font-mono">(Atual)</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-card-border space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Ou criar e mover para nova pasta:</span>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    placeholder="Nome da nova pasta..."
                    value={newMoveFolderName}
                    onChange={(e) => setNewMoveFolderName(e.target.value)}
                    className="flex-1 bg-panel border border-card-border rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent font-mono"
                  />
                  <button
                    onClick={() => {
                      if (newMoveFolderName.trim()) {
                        handleMoveNote(moveModalNote.id, newMoveFolderName.trim());
                        setNewMoveFolderName('');
                      }
                    }}
                    disabled={!newMoveFolderName.trim()}
                    className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-sm"
                  >
                    Mover
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notion Import Modal */}
      {isNotionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in select-none">
          <div className="bg-card border border-card-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <Download className="w-4 h-4 text-accent-light" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Importar Páginas do Notion</h3>
                  <p className="text-[11px] text-slate-400">Importe arquivos Markdown (.md) exportados do Notion ou cole o conteúdo.</p>
                </div>
              </div>
              <button onClick={() => setIsNotionModalOpen(false)} className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Export Help Banner */}
              <div className="p-3 rounded-xl bg-panel border border-card-border text-[11px] text-slate-300 leading-relaxed space-y-1">
                <span className="font-bold text-accent-light block flex items-center space-x-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Como exportar do Notion:</span>
                </span>
                <span>No Notion, clique em <strong>Configurações & Membros</strong> ➔ <strong>Exportar todo o conteúdo</strong> ➔ Formato: <strong>Markdown & CSV</strong>.</span>
              </div>

              {/* Destination Folder Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pasta de Destino no Cofre:</label>
                <input
                  type="text"
                  value={notionTargetFolder}
                  onChange={(e) => setNotionTargetFolder(e.target.value)}
                  placeholder="Ex: Notion Import, Arquitetura, Estudos..."
                  className="w-full bg-panel border border-card-border rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent font-mono"
                />
              </div>

              {/* Upload Multi-files */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-card-border hover:border-accent/50 bg-panel/50 text-center space-y-2 cursor-pointer relative">
                <input
                  type="file"
                  multiple
                  accept=".md,.txt"
                  onChange={handleImportNotionFiles}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-6 h-6 text-accent-light mx-auto" />
                <span className="font-bold text-slate-200 block">Selecionar arquivos Markdown (.md) do Notion</span>
                <span className="text-[11px] text-slate-400 block">Clique ou arraste os arquivos aqui</span>
              </div>

              <div className="text-center text-slate-500 font-mono text-[10px]">OU COLE O CONTEÚDO MANUALMENTE</div>

              {/* Manual Paste Form */}
              <form onSubmit={handleImportNotionPaste} className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Título da página do Notion..."
                  value={notionPasteTitle}
                  onChange={(e) => setNotionPasteTitle(e.target.value)}
                  className="w-full bg-panel border border-card-border rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent"
                />

                <textarea
                  rows={4}
                  placeholder="# Conteúdo Markdown copiado da página do Notion..."
                  value={notionPasteContent}
                  onChange={(e) => setNotionPasteContent(e.target.value)}
                  className="w-full bg-panel border border-card-border rounded-xl p-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-accent"
                />

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsNotionModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border text-slate-300 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isImportingNotion}
                    className="px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-all shadow-md"
                  >
                    {isImportingNotion ? 'Importando...' : 'Importar Nota'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar Controls */}
      <div className="h-12 border-b border-card-border bg-sidebar px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-white p-0.5 border border-card-border shadow-xs flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Tellus" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xs text-slate-100 font-mono">FrankMD Vault & Pastas</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Obsidian Standard Compatible</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Notion Import Button */}
          <button
            onClick={() => setIsNotionModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card border border-card-border text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
            title="Importar notas exportadas do Notion (.md / .csv)"
          >
            <Download className="w-3.5 h-3.5 text-accent-light" />
            <span>Importar do Notion</span>
          </button>

          {/* Mode Switcher: Editor vs Graph */}
          <div className="flex items-center bg-card rounded-lg p-0.5 border border-card-border text-xs">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'editor'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Notas ({notes.length})</span>
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'graph'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3 h-3 text-cyan-400" />
              <span>Grafo</span>
            </button>
          </div>

          <button
            onClick={() => handleCreateNoteInFolder(selectedFolderFilter !== 'all' ? selectedFolderFilter : 'Geral')}
            className="px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Nota</span>
          </button>
        </div>
      </div>

      {/* VIEW MODES */}
      {viewMode === 'graph' ? (
        /* OBSIDIAN-STYLE INTERACTIVE GRAPH */
        <div className="flex-1 p-6 flex flex-col bg-background relative overflow-hidden">
          <div className="absolute top-8 left-8 z-10 p-4 rounded-2xl bg-card/90 backdrop-blur-md border border-card-border shadow-xl space-y-1.5 max-w-sm">
            <div className="flex items-center space-x-2 font-bold text-xs text-slate-100">
              <Network className="w-4 h-4 text-cyan-400" />
              <span>Grafo de Conexões de Conhecimento</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Visualização de todos os conceitos, pastas, wikilinks <code className="text-accent-light">[[Ideia]]</code> e tags entre seus projetos.
            </p>
          </div>
          <canvas ref={canvasRef} className="w-full h-full rounded-2xl border border-card-border/50 bg-[#06070a]" />
        </div>
      ) : (
        /* NOTION-STYLE FULL DOCUMENT WORKSPACE WITH FOLDER TREE & DRAG-AND-DROP */
        <div className="flex-1 flex overflow-hidden">
          {/* Notes & Folders Explorer Sidebar */}
          <div className="w-84 border-r border-card-border bg-sidebar flex flex-col shrink-0">
            {/* Search & Actions Bar */}
            <div className="p-3 border-b border-card-border space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por título, conteúdo ou #tags..."
                  className="w-full bg-card border border-card-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Folders Filter / Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-accent-light" />
                  <span>Pastas do Cofre ({allFolderNames.length})</span>
                </span>
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="text-[11px] text-accent-light hover:text-white flex items-center space-x-1 font-semibold"
                  title="Criar nova pasta no cofre"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ Pasta</span>
                </button>
              </div>

              {/* Inline Create Folder Form */}
              {isCreatingFolder && (
                <form onSubmit={handleCreateFolder} className="p-2 bg-card rounded-xl border border-accent/40 space-y-2 animate-in fade-in">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Nome da pasta (ex: Estudos - Python)..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-panel border border-card-border rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-accent font-mono"
                  />
                  <div className="flex items-center justify-end space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-2 py-0.5 rounded bg-panel hover:bg-card-border text-[10px] text-slate-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px]"
                    >
                      Criar Pasta
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Folders & Notes Hierarchical Tree (Drag & Drop Target for Notes and Folders) */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin scrollbar-thumb-card-border">
              {allFolderNames.map((folderName) => {
                const folderNotes = filteredNotes.filter(n => (n.folder || n.subject || 'Geral') === folderName);
                const isCollapsed = collapsedFolders[folderName];
                const isDragTarget = dragOverFolder === folderName;
                
                // Calculate folder path depth for nested subfolders
                const pathSegments = folderName.split('/');
                const depth = pathSegments.length - 1;
                const displayName = pathSegments[pathSegments.length - 1] || folderName;
                const isSubfolder = depth > 0;

                return (
                  <div 
                    key={folderName} 
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-tellus-folder', folderName);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedFolderName(folderName);
                    }}
                    onDragEnd={() => {
                      setDraggedFolderName(null);
                      setDragOverFolder(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverFolder !== folderName) setDragOverFolder(folderName);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setDragOverFolder(null);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const droppedFolder = e.dataTransfer.getData('application/x-tellus-folder') || draggedFolderName;
                      const droppedNoteId = e.dataTransfer.getData('text/plain') || draggedNoteId;
                      
                      setDragOverFolder(null);
                      setDraggedNoteId(null);
                      setDraggedFolderName(null);

                      if (droppedFolder && droppedFolder !== folderName) {
                        // Move folder into target folder as subfolder
                        await handleMoveFolder(droppedFolder, folderName);
                      } else if (droppedNoteId) {
                        // Move note into target folder
                        await handleMoveNote(droppedNoteId, folderName);
                      }
                    }}
                    style={{ marginLeft: `${Math.min(depth * 14, 42)}px` }}
                    className={`space-y-1 rounded-2xl border p-1.5 transition-all duration-200 overflow-hidden ${
                      isDragTarget
                        ? 'bg-accent/20 border-accent ring-2 ring-accent scale-[1.01] shadow-lg'
                        : isSubfolder
                        ? 'bg-panel/20 border-card-border/40'
                        : 'bg-panel/40 border-card-border/70'
                    }`}
                  >
                    {/* Folder Header */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-card-border/40 transition-colors group cursor-grab active:cursor-grabbing">
                      <div
                        onClick={() => toggleFolderCollapse(folderName)}
                        className="flex items-center space-x-1.5 cursor-pointer flex-1 truncate select-none"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-accent-light shrink-0" />
                        )}
                        <Folder className={`w-3.5 h-3.5 shrink-0 ${isSubfolder ? 'text-cyan-400' : 'text-amber-400'}`} />
                        <span className={`font-bold text-xs truncate ${isSubfolder ? 'text-cyan-200' : 'text-slate-200'}`} title={folderName}>
                          {displayName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          ({folderNotes.length})
                        </span>
                        {isDragTarget && (
                          <span className="text-[9px] font-bold text-accent-light uppercase px-1.5 py-0.5 rounded bg-accent/30 animate-pulse">
                            Soltar aqui
                          </span>
                        )}
                      </div>

                      {/* Folder Action Tools */}
                      <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewFolderName(`${folderName}/`);
                            setIsCreatingFolder(true);
                          }}
                          className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-cyan-300"
                          title={`Criar subpasta dentro de "${folderName}"`}
                        >
                          <FolderPlus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleReviewFolderWithAgent(folderName)}
                          className="px-1.5 py-0.5 rounded-md bg-accent/20 hover:bg-accent text-accent-light hover:text-white text-[9px] font-semibold flex items-center space-x-1 transition-all border border-accent/30"
                          title="Revisar e aprimorar visualmente todas as notas desta pasta com o Agente"
                        >
                          <Wand2 className="w-2.5 h-2.5" />
                          <span>IA</span>
                        </button>
                        <button
                          onClick={() => handleCreateNoteInFolder(folderName)}
                          className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-white"
                          title={`Criar nova nota em "${folderName}"`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Notes in Folder (Draggable) */}
                    {!isCollapsed && (
                      <div className="pl-3 pr-1 space-y-1.5 pt-1">
                        {folderNotes.length === 0 ? (
                          <div className="p-2 text-[10px] text-slate-500 italic">
                            {isDragTarget ? 'Solte a anotação ou pasta aqui' : 'Vazia. Arraste notas para cá ou clique em +.'}
                          </div>
                        ) : (
                          folderNotes.map((n) => {
                            const isActive = activeNote?.id === n.id;
                            const isBeingDragged = draggedNoteId === n.id;
                            const isBibliography = n.title.includes('Referencias') || n.title.includes('Bibliografias') || n.filename.includes('99_');
                            
                            return (
                              <div
                                key={n.id}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData('text/plain', n.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggedNoteId(n.id);
                                }}
                                onDragEnd={() => {
                                  setDraggedNoteId(null);
                                  setDragOverFolder(null);
                                }}
                                onClick={() => selectNote(n)}
                                className={`p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex flex-col space-y-1 group/card ${
                                  isBeingDragged
                                    ? 'opacity-40 border-dashed border-accent scale-95'
                                    : isActive
                                    ? 'bg-accent/20 border-accent text-white shadow-sm'
                                    : isBibliography
                                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200 hover:bg-amber-950/30'
                                    : 'bg-card/70 border-card-border/80 text-slate-300 hover:bg-card-border/40'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-xs truncate max-w-[150px] text-slate-100 flex items-center space-x-1.5">
                                    <GripVertical className="w-3 h-3 text-slate-500 opacity-40 group-hover/card:opacity-100 shrink-0" />
                                    {isBibliography ? (
                                       <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                                    ) : (
                                       <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                    )}
                                    <span className="truncate">{n.title}</span>
                                  </span>

                                  <div className="flex items-center space-x-1">
                                    {isBibliography && (
                                      <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        Bibliografia
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMoveModalNote(n);
                                      }}
                                      className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-amber-300 opacity-60 group-hover/card:opacity-100 transition-opacity"
                                      title="Mover para outra pasta..."
                                    >
                                      <FolderInput className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                <p className="text-[10px] text-slate-400 truncate line-clamp-1 leading-relaxed pl-4">
                                  {n.content.replace(/^#+.*?\n/, '').replace(/<!--.*?-->/g, '').trim().slice(0, 70)}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Note View & Editor Panel */}
          {activeNote ? (
            <div className="flex-1 flex flex-col bg-[#0b0d13] overflow-hidden">
              {/* Document Header */}
              <div className="p-3.5 border-b border-card-border bg-sidebar/40 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3 flex-1 mr-4 min-w-0">
                  {noteViewMode === 'edit' ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título da Anotação..."
                      className="font-bold text-base bg-transparent text-slate-100 focus:outline-none focus:border-b border-accent flex-1"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-5 h-5 text-accent-light shrink-0" />
                      <h2 className="font-bold text-base text-slate-100 truncate">{editTitle}</h2>
                    </div>
                  )}
                  
                  {/* Folder Breadcrumb & Switcher */}
                  <div className="flex items-center space-x-1.5 bg-panel border border-card-border px-2.5 py-1 rounded-xl shrink-0">
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {noteViewMode === 'edit' ? (
                      <select
                        value={editFolder}
                        onChange={(e) => {
                          const newF = e.target.value;
                          setEditFolder(newF);
                          handleMoveNote(activeNote.id, newF);
                        }}
                        className="bg-transparent text-xs text-amber-300 focus:outline-none font-mono cursor-pointer max-w-[180px] truncate"
                        title="Mover anotação para outra pasta"
                      >
                        {allFolderNames.map(f => (
                          <option key={f} value={f} className="bg-card text-slate-200">
                            📁 {f}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-amber-300 font-mono truncate max-w-[200px]" title={`Pasta: ${editFolder}`}>
                        {editFolder}
                      </span>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  {noteViewMode === 'preview' ? (
                    <>
                      <button
                        onClick={() => setNoteViewMode('edit')}
                        className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-accent/20"
                        title="Editar conteúdo da nota em Markdown"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Nota</span>
                      </button>

                      <button
                        onClick={() => setMoveModalNote(activeNote)}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 hover:text-amber-300 flex items-center space-x-1.5 transition-all"
                        title="Mover esta anotação para outra pasta"
                      >
                        <FolderInput className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mover</span>
                      </button>

                      <button
                        onClick={() => copyNoteContent(editContent, activeNote.id)}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 flex items-center space-x-1.5 transition-all"
                      >
                        {copiedId === activeNote.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Markdown</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteNote(activeNote.id, activeNote.isProjectSpecific)}
                        className="p-2 rounded-xl hover:bg-card-border text-slate-400 hover:text-rose-400 transition-colors"
                        title="Excluir anotação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditContent(activeNote.content);
                          setEditTitle(activeNote.title);
                          setNoteViewMode('preview');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-all"
                      >
                        Cancelar
                      </button>

                      <button
                        onClick={() => setNoteViewMode('preview')}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
                        title="Ver visualização formatada"
                      >
                        <Eye className="w-3.5 h-3.5 text-accent-light" />
                        <span>Modo Leitura</span>
                      </button>

                      <button
                        onClick={handleSaveActiveNote}
                        disabled={isSaving}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-950/30"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Salvando...' : 'Salvar & Visualizar'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* DOCUMENT BODY */}
              {noteViewMode === 'preview' ? (
                /* 1. FORMATTED PREVIEW VIEW (DEFAULT) */
                <div 
                  className="flex-1 overflow-y-auto bg-[#0a0c12] p-8 scrollbar-thin scrollbar-thumb-card-border select-text"
                  onMouseUp={handleTextSelection}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={() => setNoteViewMode('edit')}
                  title="Dê duplo clique para editar esta anotação"
                >
                  <div className="max-w-4xl mx-auto space-y-6">
                    {/* Top banner info */}
                    <div className="flex items-center justify-between pb-4 border-b border-card-border/60 text-xs text-slate-400 font-mono">
                      <span className="flex items-center space-x-1.5">
                        <Folder className="w-3.5 h-3.5 text-amber-400" />
                        <span>Caminho: <strong>{activeNote.relativePath || `${editFolder}/${activeNote.filename}`}</strong></span>
                      </span>
                      <button
                        onClick={() => setNoteViewMode('edit')}
                        className="text-[11px] text-accent-light hover:underline flex items-center space-x-1 font-sans"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Clique ou dê duplo-clique para editar</span>
                      </button>
                    </div>

                    {/* Rendered Markdown Document */}
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed select-text space-y-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editContent}
                      </ReactMarkdown>
                    </div>

                    {/* Backlinks Section */}
                    {activeNote.backlinks && activeNote.backlinks.length > 0 && (
                      <div className="mt-12 pt-6 border-t border-card-border">
                        <div className="flex items-center space-x-2 text-xs font-bold text-accent-light mb-3">
                          <LinkIcon className="w-4 h-4" />
                          <span>Notas que mencionam esta ({activeNote.backlinks.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeNote.backlinks.map(b => (
                            <span key={b} className="px-3 py-1 rounded-xl bg-accent/15 border border-accent/30 text-xs text-slate-200 font-medium">
                              [[{b}]]
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 2. SPLIT-SCREEN EDIT MODE */
                <div 
                  className="flex-1 grid grid-cols-2 overflow-hidden select-text"
                  onMouseUp={handleTextSelection}
                  onContextMenu={handleContextMenu}
                >
                  {/* Editor Column */}
                  <div className="border-r border-card-border p-6 flex flex-col bg-[#08090e]">
                    <div className="flex items-center justify-between text-[11px] uppercase font-bold text-slate-500 mb-3 font-mono">
                      <span>Editor Markdown (suporta [[Wikilinks]] e #tags)</span>
                      <span className="text-emerald-400">● Protegido por Backup</span>
                    </div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onMouseUp={handleTextSelection}
                      onContextMenu={handleContextMenu}
                      placeholder="Escreva seu documento com formatação Markdown, tabelas, código e [[Conexões]]..."
                      className="flex-1 w-full bg-transparent text-xs text-slate-200 font-mono resize-none focus:outline-none leading-relaxed select-text"
                    />
                  </div>

                  {/* Live Preview Column */}
                  <div 
                    className="p-8 overflow-y-auto bg-[#0a0c12] scrollbar-thin scrollbar-thumb-card-border select-text"
                    onMouseUp={handleTextSelection}
                    onContextMenu={handleContextMenu}
                  >
                    <div className="max-w-3xl mx-auto space-y-6">
                      <span className="text-[11px] uppercase font-bold text-slate-500 block font-mono">
                        Pré-visualização em Tempo Real
                      </span>

                      <div className="prose prose-invert max-w-none text-xs leading-relaxed select-text">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {editContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Selecione ou crie uma anotação para começar a escrever.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
