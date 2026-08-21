import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  Folder, 
  ShieldCheck, 
  Network, 
  Edit3, 
  Sparkles,
  Link as LinkIcon,
  MessageSquareQuote,
  ArrowLeft,
  Copy,
  Check,
  Tag
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FrankNote, GraphData } from '../types';
import { api } from '../api';

interface FrankNoteViewProps {
  onMentionInChat?: (note: FrankNote) => void;
  onReturnToAgent?: () => void;
}

export const FrankNoteView: React.FC<FrankNoteViewProps> = ({
  onMentionInChat,
  onReturnToAgent
}) => {
  const [notes, setNotes] = useState<FrankNote[]>([]);
  const [activeNote, setActiveNote] = useState<FrankNote | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'editor' | 'graph'>('editor');
  const [editContent, setEditContent] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editSubject, setEditSubject] = useState<string>('Geral');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchNotes = async () => {
    try {
      const list = await api.listNotes();
      setNotes(list);
      if (list.length > 0 && !activeNote) {
        selectNote(list[0]);
      }
    } catch {
      // ignore
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
    fetchNotes();
  }, []);

  useEffect(() => {
    if (viewMode === 'graph') {
      fetchGraph();
    }
  }, [viewMode]);

  const selectNote = (note: FrankNote) => {
    setActiveNote(note);
    setEditTitle(note.title);
    setEditSubject(note.subject || 'Geral');
    setEditContent(note.content);
  };

  const handleCreateNote = () => {
    const newNoteTemplate = {
      title: 'Nova Anotação ' + new Date().toLocaleDateString('pt-BR'),
      subject: selectedSubject !== 'all' ? selectedSubject : 'Ideias',
      content: `# Nova Anotação\n\nEscreva suas notas aqui no formato Notion/Markdown.\n\nUse \`[[Nome de Outra Nota]]\` para criar conexões e #tags para categorizar.\n`,
      isProjectSpecific: false
    };

    api.saveNote(newNoteTemplate).then((created) => {
      fetchNotes();
      selectNote(created);
    });
  };

  const handleSaveActiveNote = async () => {
    if (!activeNote) return;
    setIsSaving(true);
    try {
      const updated = await api.saveNote({
        id: activeNote.id,
        title: editTitle,
        subject: editSubject,
        content: editContent,
        isProjectSpecific: activeNote.isProjectSpecific
      });
      setActiveNote(updated);
      fetchNotes();
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

  const copyNoteContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const subjects = Array.from(new Set(notes.map(n => n.subject || 'Geral')));

  const filteredNotes = notes.filter(n => {
    const matchesQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubject === 'all' || (n.subject || 'Geral') === selectedSubject;
    return matchesQuery && matchesSubject;
  });

  // Render Interactive Canvas Graph (Obsidian-Style)
  useEffect(() => {
    if (viewMode !== 'graph' || !graphData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = canvas.width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.height = canvas.parentElement?.clientHeight || 600;

    const simNodes = graphData.nodes.map((node, i) => {
      const angle = (i / Math.max(1, graphData.nodes.length)) * Math.PI * 2;
      const radius = 150 + Math.random() * 120;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4
      };
    });

    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = '#1e293b22';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Links
      ctx.strokeStyle = '#64748b55';
      ctx.lineWidth = 1.2;
      for (const link of graphData.links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      }

      // Nodes
      for (const node of simNodes) {
        ctx.fillStyle = node.color || '#818cf8';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.type === 'subject' ? 10 : node.type === 'tag' ? 6 : 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff33';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText(node.label.replace(/^📂\s*/, ''), node.x, node.y + 18);

        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 40 || node.x > width - 40) node.vx *= -1;
        if (node.y < 40 || node.y > height - 40) node.vy *= -1;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [viewMode, graphData]);

  return (
    <div className="h-full flex flex-col bg-[#090a0f] text-slate-100 overflow-hidden select-none">
      {/* Notion-style Top Bar */}
      <div className="h-14 border-b border-card-border bg-sidebar px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          {onReturnToAgent && (
            <button
              onClick={onReturnToAgent}
              className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
              title="Voltar ao Workspace do Agente"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Agente</span>
            </button>
          )}

          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-brand-cyan/20 border border-brand-cyan/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-brand-cyan" />
            </div>
            <div>
              <span className="font-bold text-sm bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                FrankMD Notes & Knowledge Vault
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Segurança local de dados · Wikilinks · Grafo Obsidian
              </span>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-card rounded-lg p-0.5 border border-card-border text-xs">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'editor'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Documento & Editor</span>
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'graph'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Grafo de Conhecimento (Obsidian)</span>
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1.5 text-[11px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Data Safety: Auto-Backup Local Ativo</span>
          </span>

          {activeNote && onMentionInChat && (
            <button
              onClick={() => onMentionInChat(activeNote)}
              className="px-3 py-1.5 rounded-lg bg-panel hover:bg-brand-cyan/20 border border-card-border hover:border-brand-cyan/40 text-brand-cyan text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
              title="Citar esta anotação na conversa ativa com a IA"
            >
              <MessageSquareQuote className="w-3.5 h-3.5" />
              <span>Mencionar no Chat</span>
            </button>
          )}

          <button
            onClick={handleCreateNote}
            className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Anotação</span>
          </button>
        </div>
      </div>

      {/* Main Area */}
      {viewMode === 'graph' ? (
        /* GRAPH VIEW */
        <div className="flex-1 relative flex flex-col bg-[#07080c] overflow-hidden p-6">
          <div className="absolute top-8 left-8 z-10 bg-card/90 backdrop-blur border border-card-border p-4 rounded-2xl shadow-2xl text-xs space-y-2 pointer-events-none max-w-sm">
            <div className="font-bold text-slate-100 flex items-center space-x-2 text-sm">
              <Network className="w-4 h-4 text-brand-cyan" />
              <span>Grafo de Conexões de Conhecimento</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Visualização de todos os conceitos, wikilinks <code className="text-accent-light">[[Ideia]]</code> e tags entre seus projetos.
            </p>
            <div className="flex items-center space-x-4 text-[11px] pt-1">
              <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#818cf8]" /><span>Notas</span></span>
              <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /><span>Assuntos</span></span>
              <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" /><span>Tags</span></span>
            </div>
          </div>
          <canvas ref={canvasRef} className="w-full h-full rounded-2xl border border-card-border/50 bg-[#06070a]" />
        </div>
      ) : (
        /* NOTION-STYLE FULL DOCUMENT WORKSPACE */
        <div className="flex-1 flex overflow-hidden">
          {/* Notes Explorer Sidebar */}
          <div className="w-80 border-r border-card-border bg-sidebar flex flex-col shrink-0">
            {/* Search & Topic Tabs */}
            <div className="p-4 border-b border-card-border space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por título, conteúdo ou #tags..."
                  className="w-full bg-card border border-card-border rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Topic Filters */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                <button
                  onClick={() => setSelectedSubject('all')}
                  className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all ${
                    selectedSubject === 'all'
                      ? 'bg-accent text-white font-semibold shadow-sm'
                      : 'bg-card text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todas ({notes.length})
                </button>
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSubject(s)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all ${
                      selectedSubject === s
                        ? 'bg-accent text-white font-semibold shadow-sm'
                        : 'bg-card text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-card-border">
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Nenhuma anotação encontrada.
                </div>
              ) : (
                filteredNotes.map((n) => {
                  const isActive = activeNote?.id === n.id;
                  return (
                    <div
                      key={n.id}
                      onClick={() => selectNote(n)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer group flex flex-col space-y-1.5 ${
                        isActive
                          ? 'bg-accent/15 border-accent text-white shadow-md shadow-accent/10'
                          : 'bg-card border-card-border text-slate-300 hover:bg-card-border/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs truncate max-w-[190px] block text-slate-100">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-brand-cyan font-mono px-2 py-0.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20">
                          {n.subject}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate line-clamp-2 leading-relaxed">
                        {n.content.replace(/^#+.*?\n/, '').trim().slice(0, 90)}
                      </p>
                      {n.tags.length > 0 && (
                        <div className="flex items-center space-x-1.5 pt-1 overflow-hidden">
                          {n.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-[10px] text-emerald-400 font-mono">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Note Notion-style Editor & Preview Panel */}
          {activeNote ? (
            <div className="flex-1 flex flex-col bg-[#0b0d13] overflow-hidden">
              {/* Document Header */}
              <div className="p-4 border-b border-card-border bg-sidebar/40 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3 flex-1 mr-6">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título da Anotação..."
                    className="font-bold text-base bg-transparent text-slate-100 focus:outline-none focus:border-b border-accent flex-1"
                  />
                  <div className="flex items-center space-x-1.5">
                    <Folder className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Tema / Assunto"
                      className="text-xs text-brand-cyan bg-panel border border-card-border px-3 py-1 rounded-xl w-36 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
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
                    onClick={handleSaveActiveNote}
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-950/30"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteNote(activeNote.id, activeNote.isProjectSpecific)}
                    className="p-2 rounded-xl hover:bg-card-border text-slate-400 hover:text-rose-400 transition-colors"
                    title="Excluir anotação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Document Split Body (Markdown Source + Formatted Preview) */}
              <div className="flex-1 grid grid-cols-2 overflow-hidden">
                {/* Editor Column */}
                <div className="border-r border-card-border p-6 flex flex-col bg-[#08090e]">
                  <div className="flex items-center justify-between text-[11px] uppercase font-bold text-slate-500 mb-3 font-mono">
                    <span>Editor Markdown (suporta [[Wikilinks]] e #tags)</span>
                    <span className="text-emerald-400">● Protegido por Backup</span>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Escreva seu documento com formatação Markdown, tabelas, código e [[Conexões]]..."
                    className="flex-1 w-full bg-transparent text-xs text-slate-200 font-mono resize-none focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Live Notion-style Preview Column */}
                <div className="p-8 overflow-y-auto bg-[#0a0c12] scrollbar-thin scrollbar-thumb-card-border">
                  <div className="max-w-3xl mx-auto space-y-6">
                    <span className="text-[11px] uppercase font-bold text-slate-500 block font-mono">
                      Visualização Formatada
                    </span>

                    <div className="prose prose-invert max-w-none text-xs leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editContent}
                      </ReactMarkdown>
                    </div>

                    {/* Backlinks Section */}
                    {activeNote.backlinks && activeNote.backlinks.length > 0 && (
                      <div className="mt-10 pt-6 border-t border-card-border">
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
              </div>
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
