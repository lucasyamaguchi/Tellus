import React, { useState, useEffect } from 'react';
import { 
  History, 
  GitCommit, 
  GitBranch, 
  FileCode, 
  Plus, 
  Minus, 
  Check, 
  RotateCcw, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  MessageSquare, 
  Calendar, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Sparkles,
  AlertCircle,
  FileText,
  Eye,
  GitPullRequest
} from 'lucide-react';
import { FileChangeEntry, GitDiffReport, GitDiffFile } from '../types';
import { api } from '../api';

interface FileHistoryViewerProps {
  activeSessionId?: string | null;
  activeSessionTitle?: string;
  onOpenFileInEditor?: (filePath: string) => void;
  onNavigateToChat?: (sessionId: string, messageId?: string) => void;
}

export const FileHistoryViewer: React.FC<FileHistoryViewerProps> = ({
  activeSessionId,
  activeSessionTitle,
  onOpenFileInEditor,
  onNavigateToChat
}) => {
  const [viewScope, setViewScope] = useState<'current_chat' | 'all_chats' | 'git_diff'>('current_chat');
  const [changes, setChanges] = useState<FileChangeEntry[]>([]);
  const [gitReport, setGitReport] = useState<GitDiffReport | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [historyList, gitData] = await Promise.all([
        api.getFileChanges(),
        api.getGitDiff().catch(() => ({ files: [], branch: '', isGitRepo: false }))
      ]);
      setChanges(historyList || []);
      setGitReport(gitData);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSessionId]);

  const toggleDiff = (id: string) => {
    setExpandedDiffs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevert = async (change: FileChangeEntry) => {
    if (!window.confirm(`Deseja realmente reverter as alterações feitas no arquivo "${change.filePath}"?`)) {
      return;
    }
    setRevertingId(change.id);
    try {
      const res = await api.revertFileChange(change.id);
      alert(res.message);
      await loadData();
      if (onOpenFileInEditor) {
        onOpenFileInEditor(change.filePath);
      }
    } catch (err: any) {
      alert(`Falha ao reverter: ${err.message}`);
    } finally {
      setRevertingId(null);
    }
  };

  // Filter changes
  const filteredChanges = changes.filter(c => {
    if (viewScope === 'current_chat' && activeSessionId) {
      if (c.sessionId !== activeSessionId) return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.filePath.toLowerCase().includes(q) ||
      (c.reason && c.reason.toLowerCase().includes(q)) ||
      (c.sessionTitle && c.sessionTitle.toLowerCase().includes(q))
    );
  });

  const currentChatChangesCount = changes.filter(c => c.sessionId === activeSessionId).length;

  return (
    <div className="h-full w-full flex flex-col bg-[#12141c] text-slate-200 select-none">
      {/* Top Scope / Filter Tabs */}
      <div className="p-3 border-b border-card-border bg-sidebar/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 bg-black/40 rounded-xl p-1 border border-card-border text-xs">
            <button
              type="button"
              onClick={() => setViewScope('current_chat')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                viewScope === 'current_chat'
                  ? 'bg-accent text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mostrar apenas arquivos alterados nesta conversa ativa"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Neste Chat</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                viewScope === 'current_chat' ? 'bg-white/20 text-white' : 'bg-card text-slate-400'
              }`}>
                {currentChatChangesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewScope('all_chats')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                viewScope === 'all_chats'
                  ? 'bg-accent text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mostrar histórico consolidado de todos os chats do projeto"
            >
              <History className="w-3 h-3" />
              <span>Todos os Chats</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                viewScope === 'all_chats' ? 'bg-white/20 text-white' : 'bg-card text-slate-400'
              }`}>
                {changes.length}
              </span>
            </button>

            {gitReport && gitReport.isGitRepo && (
              <button
                type="button"
                onClick={() => setViewScope('git_diff')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                  viewScope === 'git_diff'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visualizar diffs do Git em tempo real no projeto"
              >
                <GitBranch className="w-3 h-3" />
                <span>Git Diff</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  viewScope === 'git_diff' ? 'bg-white/20 text-white' : 'bg-card text-slate-400'
                }`}>
                  {gitReport.files.length}
                </span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-card border border-card-border hover:border-slate-500 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Atualizar histórico de alterações"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-accent-light' : ''}`} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome do arquivo, motivo ou chat..."
            className="w-full bg-card border border-card-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-card-border">
        {viewScope === 'git_diff' ? (
          /* Live Git Diff Section */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center space-x-1.5 font-mono text-[11px]">
                <GitBranch className="w-3 h-3 text-emerald-400" />
                <span>Branch: <strong className="text-slate-200">{gitReport?.branch || 'main'}</strong></span>
              </span>
              <span>{gitReport?.files.length || 0} arquivos pendentes</span>
            </div>

            {(!gitReport || gitReport.files.length === 0) ? (
              <div className="p-8 text-center text-slate-500 text-xs rounded-2xl border border-dashed border-card-border">
                <Check className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="font-semibold text-slate-400">Árvore de trabalho 100% limpa</p>
                <p className="text-[11px] text-slate-500 mt-1">Nenhum arquivo modificado ou não rastreado no git no momento.</p>
              </div>
            ) : (
              gitReport.files.map((file) => {
                const isExpanded = expandedDiffs[file.path] ?? true;
                return (
                  <div key={file.path} className="rounded-xl border border-card-border bg-panel overflow-hidden shadow-xs">
                    <div 
                      onClick={() => toggleDiff(file.path)}
                      className="p-3 bg-card/60 flex items-center justify-between cursor-pointer hover:bg-card transition-colors"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-mono text-xs font-semibold text-slate-100 truncate">
                          {file.path}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                          file.status === 'added' || file.status === 'untracked'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                            : file.status === 'deleted'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                        }`}>
                          {file.status}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <div className="flex items-center space-x-1 text-[11px] font-mono">
                          {file.insertions > 0 && <span className="text-emerald-400">+{file.insertions}</span>}
                          {file.deletions > 0 && <span className="text-rose-400">-{file.deletions}</span>}
                        </div>
                        {onOpenFileInEditor && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFileInEditor(file.path);
                            }}
                            className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-accent-light"
                            title="Abrir no Editor"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </div>

                    {isExpanded && file.diff && (
                      <div className="p-2.5 bg-black/50 border-t border-card-border font-mono text-[11px] overflow-x-auto max-h-72">
                        {file.diff.split('\n').map((line, i) => {
                          const isAdd = line.startsWith('+') && !line.startsWith('+++');
                          const isDel = line.startsWith('-') && !line.startsWith('---');
                          const isHeader = line.startsWith('@@') || line.startsWith('diff ');
                          return (
                            <div 
                              key={i} 
                              className={`whitespace-pre px-1 py-0.5 rounded ${
                                isAdd ? 'bg-emerald-950/50 text-emerald-300' :
                                isDel ? 'bg-rose-950/50 text-rose-300' :
                                isHeader ? 'text-brand-cyan/80 font-bold' :
                                'text-slate-400'
                              }`}
                            >
                              {line}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* File Changes History List */
          <div className="space-y-3">
            {filteredChanges.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs rounded-2xl border border-dashed border-card-border space-y-2">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-400">
                  {viewScope === 'current_chat'
                    ? 'Nenhum arquivo alterado neste chat ainda'
                    : 'Nenhuma alteração registrada'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {viewScope === 'current_chat'
                    ? 'Quando o Tellus criar ou editar arquivos durante esta conversa, o histórico detalhado aparecerá aqui.'
                    : 'Quando o agente modificar arquivos, você poderá ver exatamente as linhas e os motivos aqui.'}
                </p>
                {viewScope === 'current_chat' && changes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewScope('all_chats')}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent text-accent-light hover:text-white text-xs font-medium transition-all"
                  >
                    Ver alterações de todos os chats ({changes.length})
                  </button>
                )}
              </div>
            ) : (
              filteredChanges.map((change) => {
                const isExpanded = expandedDiffs[change.id] ?? false;
                const formattedDate = new Date(change.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div 
                    key={change.id}
                    className="rounded-xl border border-card-border bg-panel overflow-hidden shadow-xs hover:border-slate-600 transition-all"
                  >
                    {/* Header Card */}
                    <div className="p-3 bg-card/70 border-b border-card-border/60 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-mono text-xs font-bold text-white truncate">
                              {change.filePath}
                            </span>
                            
                            {/* Lines Added / Removed Badge */}
                            <span className="flex items-center space-x-1 font-mono text-[10px] font-semibold">
                              {change.linesAdded > 0 && (
                                <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                  +{change.linesAdded}
                                </span>
                              )}
                              {change.linesRemoved > 0 && (
                                <span className="bg-rose-950/60 text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded">
                                  -{change.linesRemoved}
                                </span>
                              )}
                            </span>

                            {/* Line Range Badge */}
                            {change.lineRange && (
                              <span className="font-mono text-[10px] bg-amber-950/50 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded">
                                L{change.lineRange.start}-{change.lineRange.end}
                              </span>
                            )}
                          </div>

                          {/* Chat Association Badge */}
                          {change.sessionTitle && (
                            <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                              <span className="text-slate-500">Origem:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (change.sessionId && onNavigateToChat) {
                                    onNavigateToChat(change.sessionId, change.messageId);
                                  }
                                }}
                                className="text-accent-light hover:underline font-medium truncate max-w-[200px] flex items-center space-x-1 cursor-pointer"
                                title={`Ir para a conversa: "${change.sessionTitle}"`}
                              >
                                <MessageSquare className="w-3 h-3 shrink-0" />
                                <span>{change.sessionTitle}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 shrink-0 text-[10px] text-slate-400 font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formattedDate}</span>
                        </div>
                      </div>

                      {/* Reason / Por que Box */}
                      {change.reason && (
                        <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-xs text-slate-200 flex items-start space-x-2">
                          <Sparkles className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] uppercase font-bold text-accent-light tracking-wide block">
                              Por que esta alteração foi feita:
                            </span>
                            <p className="text-[11px] text-slate-200 leading-relaxed font-sans">
                              {change.reason}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => toggleDiff(change.id)}
                            className="px-2.5 py-1 rounded-md bg-panel hover:bg-card-border border border-card-border text-[11px] text-slate-300 font-medium transition-all flex items-center space-x-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-accent-light" />
                            <span>{isExpanded ? 'Recolher Diff' : 'Ver Linhas / Diff'}</span>
                          </button>

                          {onOpenFileInEditor && (
                            <button
                              type="button"
                              onClick={() => onOpenFileInEditor(change.filePath)}
                              className="px-2.5 py-1 rounded-md bg-panel hover:bg-card-border border border-card-border text-[11px] text-slate-300 font-medium transition-all flex items-center space-x-1 cursor-pointer"
                              title="Abrir este arquivo no Editor de Código"
                            >
                              <FileCode className="w-3 h-3 text-emerald-400" />
                              <span>Abrir no Editor</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {change.oldContent !== undefined && (
                            <button
                              type="button"
                              onClick={() => handleRevert(change)}
                              disabled={revertingId === change.id}
                              className="px-2 py-1 rounded-md hover:bg-rose-950/40 text-[11px] text-rose-300 border border-transparent hover:border-rose-500/40 font-medium transition-all flex items-center space-x-1 cursor-pointer"
                              title="Desfazer esta alteração e restaurar conteúdo anterior"
                            >
                              <RotateCcw className={`w-3 h-3 ${revertingId === change.id ? 'animate-spin' : ''}`} />
                              <span>Reverter</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => copyToClipboard(change.diff, change.id)}
                            className="p-1.5 rounded-md hover:bg-card-border text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Copiar diff em formato unificado"
                          >
                            {copiedId === change.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Unified Diff Display */}
                    {isExpanded && (
                      <div className="p-3 bg-[#0a0c12] border-t border-card-border font-mono text-[11px] space-y-0.5 overflow-x-auto max-h-80 select-text">
                        {change.diff ? (
                          change.diff.split('\n').map((line, idx) => {
                            const isAdd = line.startsWith('+') && !line.startsWith('+++');
                            const isDel = line.startsWith('-') && !line.startsWith('---');
                            const isHdr = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');

                            return (
                              <div
                                key={idx}
                                className={`px-2 py-0.5 rounded whitespace-pre leading-5 ${
                                  isAdd
                                    ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                                    : isDel
                                    ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500'
                                    : isHdr
                                    ? 'text-cyan-400 font-semibold bg-cyan-950/20'
                                    : 'text-slate-400'
                                }`}
                              >
                                {line}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-slate-500 italic p-2">Diff não disponível para esta alteração.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
