import React, { useState, useMemo } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Radio, 
  Trash2, 
  FolderGit2, 
  Globe, 
  Clock, 
  ArrowRight, 
  Sparkles,
  Bot,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { ChatSessionMetadata, ProjectOverview } from '../types';

interface ConversationsViewProps {
  sessions: ChatSessionMetadata[];
  currentProject: ProjectOverview | null;
  onSelectSession: (sessionId: string, projectPath?: string) => void;
  onNewStandaloneSession: (customTitle?: string) => void;
  onNewLiveVoiceStandaloneSession?: (mode?: 'voice_only' | 'mixed' | 'voice_output_only') => void;
  onStartSkillArchitectChat?: (initialIdea?: string) => void;
  onDeleteSession: (sessionId: string, projectPath?: string) => void;
  onSwitchToAgent: () => void;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  sessions,
  currentProject,
  onSelectSession,
  onNewStandaloneSession,
  onNewLiveVoiceStandaloneSession,
  onStartSkillArchitectChat,
  onDeleteSession,
  onSwitchToAgent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'standalone' | 'skills' | 'project'>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Group projects for filter dropdown
  const projectNames = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (!s.isStandalone && s.projectName && !s.isSkillArchitect) {
        set.add(s.projectName);
      }
    }
    return Array.from(set);
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let list = [...sessions];

    // Filter by type
    if (activeFilter === 'skills') {
      list = list.filter(s => s.isSkillArchitect || s.routineId === 'skill_architect');
    } else if (activeFilter === 'standalone') {
      list = list.filter(s => (s.isStandalone || !s.projectPath) && !s.isSkillArchitect && s.routineId !== 'skill_architect');
    } else if (activeFilter === 'project') {
      list = list.filter(s => !s.isStandalone && !!s.projectPath && !s.isSkillArchitect);
      if (selectedProjectFilter !== 'all') {
        list = list.filter(s => s.projectName === selectedProjectFilter);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => 
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.preview && s.preview.toLowerCase().includes(q)) ||
        (s.projectName && s.projectName.toLowerCase().includes(q)) ||
        (s.model && s.model.toLowerCase().includes(q))
      );
    }

    // Sort by recent updatedAt
    return list.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  }, [sessions, activeFilter, selectedProjectFilter, searchQuery]);

  const skillsCount = useMemo(() => {
    return sessions.filter(s => s.isSkillArchitect || s.routineId === 'skill_architect').length;
  }, [sessions]);

  const standaloneCount = useMemo(() => {
    return sessions.filter(s => (s.isStandalone || !s.projectPath) && !s.isSkillArchitect && s.routineId !== 'skill_architect').length;
  }, [sessions]);

  const projectCount = useMemo(() => {
    return sessions.filter(s => !s.isStandalone && !!s.projectPath && !s.isSkillArchitect).length;
  }, [sessions]);

  const formatTimestamp = (ts: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours} h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;

    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' }) + 
      ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Top Banner / Header */}
      <div className="px-6 py-5 border-b border-card-border/60 bg-gradient-to-r from-card/90 via-card/50 to-background/90 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold text-slate-100 tracking-tight">
                Central de Conversas & Estudos
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                {sessions.length} chats
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Abra conversas livres para tirar dúvidas, fazer brainstorming ou acesse chats vinculados a projetos.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {onNewLiveVoiceStandaloneSession && (
            <button
              onClick={() => onNewLiveVoiceStandaloneSession('mixed')}
              className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/50 text-red-300 text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Iniciar conversa por voz livre (sem projeto)"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-red-400" />
              <span>Live Voice Livre</span>
            </button>
          )}

          {onStartSkillArchitectChat && (
            <button
              onClick={() => onStartSkillArchitectChat()}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/30 to-cyan-600/30 hover:from-purple-600/45 hover:to-cyan-600/45 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Abrir chat para desenvolver uma nova skill com IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Forjar Nova Skill</span>
            </button>
          )}

          <button
            onClick={() => onNewStandaloneSession()}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-cyan-900/30 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conversa Livre</span>
          </button>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div className="px-6 py-3 border-b border-card-border/40 bg-card/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg transition-all font-medium flex items-center space-x-1.5 cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-700/80 text-white shadow-xs border border-slate-600/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-card/60'
            }`}
          >
            <span>Todas</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 text-slate-300">
              {sessions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('standalone')}
            className={`px-3 py-1 rounded-lg transition-all font-medium flex items-center space-x-1.5 cursor-pointer ${
              activeFilter === 'standalone'
                ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-card/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Conversas Livres</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300">
              {standaloneCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('skills')}
            className={`px-3 py-1 rounded-lg transition-all font-medium flex items-center space-x-1.5 cursor-pointer ${
              activeFilter === 'skills'
                ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-card/60'
            }`}
          >
            <span className="text-[12px]">🛠️</span>
            <span>Arquiteto de Skills</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300">
              {skillsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('project')}
            className={`px-3 py-1 rounded-lg transition-all font-medium flex items-center space-x-1.5 cursor-pointer ${
              activeFilter === 'project'
                ? 'bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-card/60'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Por Projeto</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300">
              {projectCount}
            </span>
          </button>

          {activeFilter === 'project' && projectNames.length > 1 && (
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="ml-2 bg-slate-900 border border-card-border/80 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-indigo-500/50"
            >
              <option value="all">Todos os Projetos</option>
              {projectNames.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] max-w-[320px] flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, conteúdo ou modelo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card/80 border border-card-border/80 focus:border-cyan-500/50 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredSessions.length === 0 ? (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-card-border/60 rounded-2xl bg-card/20">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3.5 shadow-inner">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              {searchQuery ? 'Nenhuma conversa corresponde aos filtros' : 'Nenhuma conversa encontrada nesta categoria'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-5">
              {searchQuery 
                ? 'Tente buscar por outras palavras-chave ou limpe a busca para visualizar todos os chats.'
                : 'Inicie uma conversa livre para tirar dúvidas gerais, estudar tópicos ou organizar conceitos sem precisar abrir um repositório.'}
            </p>
            <div className="flex items-center space-x-2">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-lg border border-card-border hover:bg-card/70 text-slate-300 text-xs transition-all cursor-pointer"
                >
                  Limpar Busca
                </button>
              )}
              <button
                onClick={() => onNewStandaloneSession()}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-cyan-900/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Primeira Conversa Livre</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => {
              const isStandalone = !!session.isStandalone || !session.projectPath;
              const isConfirmingDelete = deleteConfirmId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id, session.projectPath)}
                  className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                    isStandalone 
                      ? 'bg-gradient-to-b from-card/80 to-card/40 border-card-border/70 hover:border-cyan-500/40 hover:shadow-md hover:shadow-cyan-950/20' 
                      : 'bg-gradient-to-b from-card/80 to-card/40 border-card-border/70 hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-950/20'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {session.isSkillArchitect ? (
                        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40 text-purple-200 shadow-xs">
                          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                          <span>Arquiteto de Skill</span>
                        </div>
                      ) : isStandalone ? (
                        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                          <Globe className="w-3 h-3 text-cyan-400" />
                          <span>Conversa Livre</span>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 truncate max-w-[170px]"
                          title={`Projeto: ${session.projectName || 'Projeto'}`}
                        >
                          <FolderGit2 className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span className="truncate">{session.projectName || 'Projeto'}</span>
                        </div>
                      )}

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {session.isLiveVoice && (
                          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/20 border border-red-500/40 text-red-300">
                            <Radio className="w-2.5 h-2.5 animate-pulse text-red-400" />
                            <span>Voz</span>
                          </span>
                        )}

                        <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatTimestamp(session.updatedAt || session.createdAt)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-1 mb-1.5">
                      {session.title || 'Conversa sem título'}
                    </h3>

                    {/* Preview snippet */}
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {session.preview || 'Nenhuma mensagem recente'}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-card-border/40 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2 text-slate-500">
                      <span>{session.messageCount || 0} msgs</span>
                      {session.model && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[90px]" title={session.model}>
                            {session.model.split('/').pop()}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      {isConfirmingDelete ? (
                        <div 
                          className="flex items-center space-x-1 bg-red-950/80 border border-red-500/50 rounded px-1.5 py-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-red-200">Excluir?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id, session.projectPath);
                              setDeleteConfirmId(null);
                            }}
                            className="text-[10px] font-semibold text-red-400 hover:text-red-300 px-1"
                          >
                            Sim
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-200 px-1"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(session.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                          title="Excluir conversa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="p-1 text-slate-500 group-hover:text-cyan-400 transition-colors">
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
