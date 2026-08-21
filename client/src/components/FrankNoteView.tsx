import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Share2, 
  Search, 
  Tag, 
  Folder, 
  ShieldCheck, 
  Network, 
  Eye, 
  Edit3, 
  ArrowLeft,
  Sparkles,
  Link as LinkIcon,
  RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FrankNote, GraphData } from '../types';
import { api } from '../api';

export const FrankNoteView: React.FC = () => {
  const [notes, setNotes] = useState<FrankNote[]>([]);
  const [activeNote, setActiveNote] = useState<FrankNote | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'editor' | 'graph'>('editor');
  const [editContent, setEditContent] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editSubject, setEditSubject] = useState<string>('Geral');
  const [isSaving, setIsSaving] = useState<boolean>(false);
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
    setEditSubject(note.subject);
    setEditContent(note.content);
  };

  const handleCreateNote = () => {
    const newNoteTemplate = {
      title: 'Nova Nota ' + new Date().toLocaleDateString(),
      subject: selectedSubject !== 'all' ? selectedSubject : 'Geral',
      content: `# Nova Nota\n\nEscreva suas anotações aqui. Conecte com outras ideias usando \`[[Outra Nota]]\` e adicione tags como #ideia.\n`,
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
      alert(`Erro ao salvar nota: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id: string, isProjectSpecific?: boolean) => {
    if (!confirm('Deseja mover esta nota para o backup de segurança e deletar?')) return;
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

  // Extract unique subjects/topics
  const subjects = Array.from(new Set(notes.map(n => n.subject || 'Geral')));

  const filteredNotes = notes.filter(n => {
    const matchesQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubject === 'all' || n.subject === selectedSubject;
    return matchesQuery && matchesSubject;
  });

  // Render Interactive Canvas Graph (Obsidian-Style)
  useEffect(() => {
    if (viewMode !== 'graph' || !graphData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = canvas.width = canvas.parentElement?.clientWidth || 600;
    const height = canvas.height = canvas.parentElement?.clientHeight || 450;

    // Simulation nodes with positions
    const simNodes = graphData.nodes.map((node, i) => {
      const angle = (i / graphData.nodes.length) * Math.PI * 2;
      const radius = 120 + Math.random() * 80;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5
      };
    });

    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw background grid lines
      ctx.strokeStyle = '#1e293b22';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Links
      ctx.strokeStyle = '#64748b66';
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

      // Draw Nodes
      for (const node of simNodes) {
        // Node circle
        ctx.fillStyle = node.color || '#818cf8';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.type === 'subject' ? 9 : node.type === 'tag' ? 5 : 7, 0, Math.PI * 2);
        ctx.fill();

        // Node glow
        ctx.strokeStyle = '#ffffff33';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node label
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText(node.label.replace(/^📂\s*/, ''), node.x, node.y + 16);

        // Simple gentle oscillation
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 30 || node.x > width - 30) node.vx *= -1;
        if (node.y < 30 || node.y > height - 30) node.vy *= -1;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [viewMode, graphData]);

  return (
    <div className="h-full flex flex-col bg-[#0c0e14] text-slate-200 overflow-hidden">
      {/* Top Bar with Mode Toggle & Data Safety Badge */}
      <div className="h-12 border-b border-card-border bg-sidebar px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-brand-cyan" />
            <span className="text-xs font-bold text-slate-100">FrankMD Notes & Vault</span>
          </div>

          <div className="flex items-center space-x-1 bg-card rounded-lg p-0.5 border border-card-border text-[11px]">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
                viewMode === 'editor'
                  ? 'bg-accent text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Notas & Editor</span>
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
                viewMode === 'graph'
                  ? 'bg-accent text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3 h-3 text-brand-cyan" />
              <span>Grafo Visual (Obsidian)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Data Safety: Auto-Backup Ativo</span>
          </span>

          <button
            onClick={handleCreateNote}
            className="px-2.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Nota</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'graph' ? (
        /* GRAPH VIEW (Obsidian-like) */
        <div className="flex-1 relative flex flex-col bg-[#08090d] overflow-hidden p-4">
          <div className="absolute top-6 left-6 z-10 bg-card/90 backdrop-blur border border-card-border p-3 rounded-xl shadow-xl text-xs space-y-1.5 pointer-events-none">
            <div className="font-bold text-slate-100 flex items-center space-x-1.5">
              <Network className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Grafo de Conhecimento Conectado</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Visualização de notas, temas e wikilinks <code className="text-accent-light">[[Link]]</code>.
            </p>
            <div className="flex items-center space-x-3 text-[10px] pt-1">
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-[#818cf8]" /><span>Notas</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /><span>Assuntos</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-[#34d399]" /><span>Tags</span></span>
            </div>
          </div>
          <canvas ref={canvasRef} className="w-full h-full rounded-2xl border border-card-border/50 bg-[#07080c]" />
        </div>
      ) : (
        /* EDITOR & NOTE LIST VIEW */
        <div className="flex-1 flex overflow-hidden">
          {/* Notes Sidebar List */}
          <div className="w-72 border-r border-card-border bg-sidebar flex flex-col shrink-0">
            {/* Search & Topic filter */}
            <div className="p-3 border-b border-card-border space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar notas ou #tags..."
                  className="w-full bg-card border border-card-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Topic Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                <button
                  onClick={() => setSelectedSubject('all')}
                  className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-all ${
                    selectedSubject === 'all'
                      ? 'bg-accent text-white font-medium'
                      : 'bg-card text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({notes.length})
                </button>
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSubject(s)}
                    className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-all ${
                      selectedSubject === s
                        ? 'bg-accent text-white font-medium'
                        : 'bg-card text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Note list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-card-border">
              {filteredNotes.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Nenhuma nota encontrada.
                </div>
              ) : (
                filteredNotes.map((n) => {
                  const isActive = activeNote?.id === n.id;
                  return (
                    <div
                      key={n.id}
                      onClick={() => selectNote(n)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer group flex flex-col space-y-1 ${
                        isActive
                          ? 'bg-accent/15 border-accent text-white'
                          : 'bg-card border-card-border text-slate-300 hover:bg-card-border/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs truncate max-w-[170px] block text-slate-100">
                          {n.title}
                        </span>
                        <span className="text-[9px] text-brand-cyan font-mono px-1.5 py-0.5 rounded bg-brand-cyan/10">
                          {n.subject}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate line-clamp-1">
                        {n.content.replace(/^#+.*?\n/, '').trim().slice(0, 70)}
                      </p>
                      {n.tags.length > 0 && (
                        <div className="flex items-center space-x-1 pt-0.5 overflow-hidden">
                          {n.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-[9px] text-emerald-400 font-mono">
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

          {/* Active Note Editor & Preview */}
          {activeNote ? (
            <div className="flex-1 flex flex-col bg-background overflow-hidden">
              {/* Note Header & Title Editor */}
              <div className="p-3 border-b border-card-border bg-sidebar/50 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2 flex-1 mr-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título da Nota..."
                    className="font-bold text-sm bg-transparent text-slate-100 focus:outline-none focus:border-b border-accent flex-1"
                  />
                  <div className="flex items-center space-x-1">
                    <Folder className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Tema / Assunto"
                      className="text-xs text-brand-cyan bg-panel border border-card-border px-2 py-0.5 rounded-lg w-28 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSaveActiveNote}
                    disabled={isSaving}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1 transition-all shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteNote(activeNote.id, activeNote.isProjectSpecific)}
                    className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-rose-400 transition-colors"
                    title="Excluir nota"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note Body: Split Editor & Preview */}
              <div className="flex-1 grid grid-cols-2 overflow-hidden">
                {/* Editor */}
                <div className="border-r border-card-border p-4 flex flex-col bg-[#0a0c10]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 mb-2 font-mono flex items-center justify-between">
                    <span>Markdown Source (use [[Wikilinks]] e #tags)</span>
                    <span className="text-emerald-400">● Auto-Save Protegido</span>
                  </span>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Digite o conteúdo em Markdown com [[Outras Notas]] e #tags..."
                    className="flex-1 w-full bg-transparent text-xs text-slate-200 font-mono resize-none focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Live Preview */}
                <div className="p-4 overflow-y-auto bg-sidebar/20 scrollbar-thin scrollbar-thumb-card-border">
                  <span className="text-[10px] uppercase font-bold text-slate-500 mb-2 block font-mono">
                    Visualização Renderizada
                  </span>
                  <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {editContent}
                    </ReactMarkdown>
                  </div>

                  {/* Backlinks Footer */}
                  {activeNote.backlinks && activeNote.backlinks.length > 0 && (
                    <div className="mt-8 pt-4 border-t border-card-border">
                      <div className="flex items-center space-x-1 text-[11px] font-semibold text-accent-light mb-2">
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Notas que mencionam esta ({activeNote.backlinks.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeNote.backlinks.map(b => (
                          <span key={b} className="px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-[10px] text-slate-200 font-medium">
                            [[{b}]]
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Selecione ou crie uma nota para começar.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
