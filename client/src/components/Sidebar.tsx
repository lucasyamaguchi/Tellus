import React, { useState } from 'react';
import { 
  FolderTree, 
  Brain, 
  Bot, 
  MessageSquare,
  ChevronRight, 
  ChevronDown, 
  FileCode, 
  Folder, 
  FolderOpen, 
  BookOpen, 
  ShieldAlert, 
  CheckCircle, 
  ArrowRightLeft,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  FileText,
  Zap,
  FolderGit2,
  X,
  FolderSearch
} from 'lucide-react';
import { FileTreeItem, MemoryPage, Routine, ProjectOverview, ChatSessionMetadata } from '../types';

interface SidebarProps {
  currentProject: ProjectOverview | null;
  openProjects: ProjectOverview[];
  onCloseOpenProject: (path: string) => void;
  fileTree: FileTreeItem[];
  memoryPages: MemoryPage[];
  routines: Routine[];
  activeRoutine: Routine | null;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onSelectMemoryPage: (page: MemoryPage) => void;
  onSelectRoutine: (routine: Routine) => void;
  onOpenProjectModal: () => void;
  onSwitchProject: (path: string) => void;
  onOpenNotes?: () => void;
  onOpenSkills?: () => void;
  recentProjects: string[];
  sessions: ChatSessionMetadata[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentProject,
  openProjects,
  onCloseOpenProject,
  fileTree,
  memoryPages,
  routines,
  activeRoutine,
  selectedFile,
  onSelectFile,
  onSelectMemoryPage,
  onSelectRoutine,
  onOpenProjectModal,
  onSwitchProject,
  onOpenNotes,
  onOpenSkills,
  recentProjects,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'files' | 'projects' | 'memory' | 'routines'>('chats');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderFileTree = (items: FileTreeItem[], depth = 0) => {
    return (
      <div className="space-y-0.5" style={{ paddingLeft: depth > 0 ? '12px' : '0px' }}>
        {items.map((item) => {
          const isSelected = selectedFile === item.path;
          const isExpanded = !!expandedFolders[item.path];

          if (item.type === 'directory') {
            return (
              <div key={item.path} className="space-y-0.5">
                <button
                  onClick={() => toggleFolder(item.path)}
                  className="w-full flex items-center space-x-1.5 py-1 px-1.5 rounded text-xs text-slate-300 hover:text-white hover:bg-card-border/40 transition-colors text-left font-mono"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 text-accent-light shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-accent-light shrink-0" />
                  )}
                  <span className="truncate">{item.name}</span>
                </button>
                {isExpanded && item.children && renderFileTree(item.children, depth + 1)}
              </div>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => onSelectFile(item.path)}
              className={`w-full flex items-center space-x-2 py-1 px-2 rounded text-xs transition-colors text-left font-mono ${
                isSelected 
                  ? 'bg-accent/20 text-accent-light font-medium border-l-2 border-accent' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-card-border/30'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="w-full h-[calc(100vh-3.5rem)] border-r border-card-border bg-sidebar flex flex-col select-none overflow-hidden">
      {/* Top Workspace Header */}
      <div className="p-3 border-b border-card-border flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-hidden flex-1 mr-2">
          <div className="w-6 h-6 rounded bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <FolderGit2 className="w-3.5 h-3.5 text-accent-light" />
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-bold text-slate-200 block truncate">
              {currentProject ? currentProject.name : 'Nenhum Projeto'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate font-mono">
              {currentProject?.path || 'Local'}
            </span>
          </div>
        </div>

        <button
          onClick={onOpenProjectModal}
          className="p-1 rounded-lg bg-panel hover:bg-card-border border border-card-border text-slate-400 hover:text-white transition-colors"
          title="Abrir ou trocar projeto local"
        >
          <FolderPlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Switcher Icons */}
      <div className="grid grid-cols-5 border-b border-card-border bg-panel p-1 gap-0.5">
        <button
          onClick={() => setActiveTab('chats')}
          className={`py-1.5 rounded flex items-center justify-center text-xs transition-all ${
            activeTab === 'chats'
              ? 'bg-card text-accent-light font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Histórico de Conversas"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`py-1.5 rounded flex items-center justify-center text-xs transition-all ${
            activeTab === 'projects'
              ? 'bg-card text-accent-light font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Projetos Abertos"
        >
          <FolderGit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`py-1.5 rounded flex items-center justify-center text-xs transition-all ${
            activeTab === 'files'
              ? 'bg-card text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Explorador de Arquivos"
        >
          <FolderTree className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`py-1.5 rounded flex items-center justify-center text-xs transition-all ${
            activeTab === 'memory'
              ? 'bg-card text-brand-cyan font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Memória Contínua (.agentic)"
        >
          <Brain className="w-3.5 h-3.5 text-brand-cyan" />
        </button>
        <button
          onClick={() => setActiveTab('routines')}
          className={`py-1.5 rounded flex items-center justify-center text-xs transition-all ${
            activeTab === 'routines'
              ? 'bg-card text-accent-light font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Especialistas & Rotinas"
        >
          <Bot className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-card-border">
        {/* TAB 1: CHATS HISTORY & SESSIONS */}
        {activeTab === 'chats' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-1">
                Conversas ({sessions.length})
              </span>
              <button
                onClick={onNewSession}
                className="px-2 py-1 rounded-md bg-accent/20 hover:bg-accent hover:text-white text-accent-light text-[11px] font-medium flex items-center space-x-1 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>Novo Chat</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Nenhuma conversa salva ainda.
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = activeSessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`group rounded-xl p-2.5 transition-all flex items-start justify-between cursor-pointer border ${
                        isActive
                          ? 'bg-accent/15 border-accent text-white shadow-sm'
                          : 'bg-card border-card-border text-slate-300 hover:bg-card-border/40'
                      }`}
                      onClick={() => onSelectSession(s.id)}
                    >
                      <div className="overflow-hidden pr-2 flex-1">
                        <span className="font-semibold text-xs truncate block text-slate-100">
                          {s.title}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-mono">
                          {s.preview}
                        </span>
                        <div className="flex items-center space-x-2 text-[9px] text-slate-500 mt-1 font-mono">
                          <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                          <span>• {s.messageCount} msgs</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Deseja excluir este chat?')) {
                            onDeleteSession(s.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 transition-opacity"
                        title="Excluir chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PROJETOS ABERTOS (MULTI-PROJECT WORKSPACE) */}
        {activeTab === 'projects' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-1">
                Projetos Abertos ({openProjects.length})
              </span>
              <button
                onClick={onOpenProjectModal}
                className="px-2 py-1 rounded-md bg-accent/20 hover:bg-accent hover:text-white text-accent-light text-[11px] font-medium flex items-center space-x-1 transition-all"
                title="Abrir outro projeto e adicionar à lista"
              >
                <Plus className="w-3 h-3" />
                <span>Abrir Pasta</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              {openProjects.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Nenhum projeto aberto.
                </div>
              ) : (
                openProjects.map((p) => {
                  const isActive = currentProject?.path === p.path;
                  return (
                    <div
                      key={p.path}
                      onClick={() => onSwitchProject(p.path)}
                      className={`group rounded-xl p-2.5 transition-all flex items-start justify-between cursor-pointer border ${
                        isActive
                          ? 'bg-accent/15 border-accent text-white shadow-sm'
                          : 'bg-card border-card-border text-slate-300 hover:bg-card-border/40'
                      }`}
                    >
                      <div className="overflow-hidden pr-2 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <FolderGit2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-accent-light' : 'text-slate-400'}`} />
                          <span className="font-semibold text-xs truncate text-slate-100">
                            {p.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-mono">
                          {p.path}
                        </span>
                        {isActive && (
                          <span className="inline-block mt-1 text-[9px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                            ● Ativo Agora
                          </span>
                        )}
                      </div>

                      {/* Close Project Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseOpenProject(p.path);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 transition-opacity"
                        title="Fechar e remover este projeto dos abertos"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: FILES EXPLORER */}
        {activeTab === 'files' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-1">
              <span>Estrutura do Projeto</span>
            </div>
            {fileTree.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                Nenhum arquivo encontrado no projeto atual.
              </div>
            ) : (
              renderFileTree(fileTree)
            )}
          </div>
        )}

        {/* TAB 4: MEMORY WIKI (ai-memory) */}
        {activeTab === 'memory' && (
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 text-xs text-brand-cyan space-y-1">
              <div className="flex items-center space-x-1.5 font-semibold">
                <Brain className="w-4 h-4 text-brand-cyan" />
                <span>ai-memory Wiki Engine</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Decisões, gotchas e active_context mantidos em Markdown.
              </p>
            </div>

            {/* Active Context button */}
            <div className="space-y-1">
              <button
                onClick={() => onSelectMemoryPage({
                  category: 'general',
                  filename: 'active_context.md',
                  title: '🎯 Active Context (Estado Atual)',
                  content: currentProject?.activeContext || '',
                  lastModified: Date.now()
                })}
                className="w-full text-left p-2 rounded-lg bg-card hover:bg-card-border/60 border border-card-border transition-all flex items-center justify-between group"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse" />
                  <span className="text-xs font-semibold text-slate-200">
                    active_context.md
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Categorized Memory Pages */}
            {(['decisions', 'procedures', 'gotchas', 'handoffs'] as const).map(cat => {
              const pages = memoryPages.filter(p => p.category === cat);
              const labels = {
                decisions: { title: 'Decisões', icon: BookOpen, color: 'text-indigo-400' },
                procedures: { title: 'Procedimentos', icon: CheckCircle, color: 'text-emerald-400' },
                gotchas: { title: 'Gotchas & Erros', icon: ShieldAlert, color: 'text-rose-400' },
                handoffs: { title: 'Handoffs', icon: ArrowRightLeft, color: 'text-amber-400' }
              };
              const { title, icon: Icon, color } = labels[cat];

              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold px-1">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span>{title} ({pages.length})</span>
                  </div>
                  {pages.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic pl-5">Nenhum registro ainda</div>
                  ) : (
                    <div className="space-y-1 pl-2 border-l border-card-border">
                      {pages.map(page => (
                        <button
                          key={page.filename}
                          onClick={() => onSelectMemoryPage(page)}
                          className="w-full text-left py-1 px-2 rounded hover:bg-card-border/50 text-xs text-slate-300 transition-colors truncate block"
                        >
                          {page.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 5: SPECIALIST ROUTINES */}
        {activeTab === 'routines' && (
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-1">
              Especialistas Disponíveis
            </div>

            <div className="space-y-2">
              {routines.map((routine) => {
                const isActive = activeRoutine?.id === routine.id;
                return (
                  <div
                    key={routine.id}
                    onClick={() => onSelectRoutine(routine)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                      isActive
                        ? 'bg-accent/15 border-accent text-white shadow-sm'
                        : 'bg-card border-card-border text-slate-300 hover:bg-card-border/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-200">{routine.name}</span>
                      <span className="font-mono text-[10px] text-accent-light bg-panel px-1.5 py-0.5 rounded border border-card-border">
                        {routine.model.split('/').pop()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {routine.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

const FolderPlusIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <line x1="9" y1="13" x2="15" y2="13" />
  </svg>
);
