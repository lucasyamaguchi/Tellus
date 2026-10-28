import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  Brain, 
  Bot, 
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
  FolderGit2,
  X,
  Filter,
  Search,
  Edit3,
  Sparkles,
  Wand2,
  Copy
} from 'lucide-react';
import { FileTreeItem, MemoryPage, Routine, ProjectOverview, ChatSessionMetadata } from '../types';
import { MaterialFileIcon } from './MaterialFileIcon';
import { api } from '../api';

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
  onAskAI?: (prompt: string, filePath?: string) => void;
  onRefreshFileTree?: () => void;
}

function pathBasename(p: string): string {
  if (!p) return 'Projeto';
  const clean = p.replace(/[\\/]+$/, '');
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return 'agora';
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
  recentProjects,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onAskAI,
  onRefreshFileTree
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'files' | 'memory' | 'routines'>('projects');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileTreeItem } | null>(null);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleProject = (path: string) => {
    setCollapsedProjects(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const normKey = (p: string) => (p || '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');

  // Build Project Groups containing their respective chat sessions
  interface ProjectGroup {
    path: string;
    name: string;
    isCurrent: boolean;
    sessions: ChatSessionMetadata[];
  }

  const projectMap = new Map<string, ProjectGroup>();

  // 1. Current Project
  if (currentProject) {
    projectMap.set(normKey(currentProject.path), {
      path: currentProject.path,
      name: currentProject.name || pathBasename(currentProject.path),
      isCurrent: true,
      sessions: []
    });
  }

  // 2. Open / Active Projects
  for (const p of openProjects) {
    const k = normKey(p.path);
    if (!projectMap.has(k)) {
      projectMap.set(k, {
        path: p.path,
        name: p.name || pathBasename(p.path),
        isCurrent: currentProject ? normKey(currentProject.path) === k : false,
        sessions: []
      });
    }
  }

  // Calculate Inactive Projects (recent projects not currently in open/active projects)
  const inactiveProjects = recentProjects.filter(rPath => {
    const nR = normKey(rPath);
    const isOpen = openProjects.some(op => normKey(op.path) === nR);
    const isCur = currentProject ? normKey(currentProject.path) === nR : false;
    return !isOpen && !isCur;
  });

  // 3. Distribute sessions into projects with path normalization
  for (const s of sessions) {
    const targetProjPath = s.projectPath || currentProject?.path;
    if (targetProjPath) {
      const k = normKey(targetProjPath);
      let group = projectMap.get(k);
      if (!group) {
        // Only if project is active or has chats, register it
        group = {
          path: targetProjPath,
          name: s.projectName || pathBasename(targetProjPath),
          isCurrent: currentProject ? normKey(currentProject.path) === k : false,
          sessions: []
        };
        projectMap.set(k, group);
      }
      group.sessions.push(s);
    } else if (currentProject) {
      projectMap.get(normKey(currentProject.path))?.sessions.push(s);
    }
  }

  const projectGroups = Array.from(projectMap.values());
  // Sort: current project first, then projects with recent sessions, then alphabetically
  projectGroups.sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    const aLatest = a.sessions[0]?.updatedAt || 0;
    const bLatest = b.sessions[0]?.updatedAt || 0;
    if (aLatest !== bLatest) return bLatest - aLatest;
    return a.name.localeCompare(b.name);
  });

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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ 
                      x: Math.min(e.clientX, window.innerWidth - 250), 
                      y: Math.min(e.clientY, window.innerHeight - 280), 
                      item 
                    });
                  }}
                  className="w-full flex items-center space-x-1.5 py-1 px-1.5 rounded text-xs text-slate-300 hover:text-white hover:bg-card-border/40 transition-colors text-left font-mono group"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  <MaterialFileIcon filename={item.name} isDirectory={true} isOpen={isExpanded} size={14} />
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
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ 
                  x: Math.min(e.clientX, window.innerWidth - 250), 
                  y: Math.min(e.clientY, window.innerHeight - 280), 
                  item 
                });
              }}
              className={`w-full flex items-center space-x-2 py-1 px-2 rounded text-xs transition-colors text-left font-mono ${
                isSelected 
                  ? 'bg-accent/20 text-accent-light font-medium border-l-2 border-accent' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-card-border/30'
              }`}
            >
              <MaterialFileIcon filename={item.name} isDirectory={false} size={14} />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="w-full h-full border-r border-card-border bg-sidebar flex flex-col select-none overflow-hidden">
      {/* Top Section Header: Projects with filter and new project action buttons (Matching reference UI) */}
      <div className="px-3 pt-3 pb-2 border-b border-card-border flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200 tracking-tight">
          Projects
        </span>
        <div className="flex items-center space-x-1 text-slate-400">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-1 rounded-md hover:bg-card-border hover:text-white transition-colors ${
              isFilterOpen ? 'text-accent-light bg-card-border' : ''
            }`}
            title="Filtrar projetos e conversas"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onOpenProjectModal}
            className="p-1 rounded-md hover:bg-card-border hover:text-white transition-colors"
            title="Abrir pasta de projeto"
          >
            <FolderPlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar (collapsible) */}
      {isFilterOpen && (
        <div className="px-3 py-2 border-b border-card-border bg-panel animate-in fade-in">
          <div className="relative">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtrar projetos ou chats..."
              className="w-full bg-card border border-card-border rounded-lg pl-7 pr-7 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent"
              autoFocus
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1.5" />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Switcher Icons */}
      <div className="grid grid-cols-4 border-b border-card-border bg-panel p-1 gap-0.5">
        <button
          onClick={() => setActiveTab('projects')}
          className={`py-1.5 rounded flex items-center justify-center text-xs transition-all ${
            activeTab === 'projects'
              ? 'bg-card text-accent-light font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Projetos & Chats"
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
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-card-border">
        {/* TAB 1: PROJECTS WITH CHATS NESTED INSIDE (REFERENCE UI) */}
        {activeTab === 'projects' && (
          <div className="space-y-1.5">
            {projectGroups.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs space-y-2">
                <p>Nenhum projeto aberto.</p>
                <button
                  type="button"
                  onClick={onOpenProjectModal}
                  className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent hover:text-white text-accent-light text-xs font-medium inline-flex items-center space-x-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Abrir Projeto</span>
                </button>
              </div>
            ) : (
              projectGroups
                .filter(group => {
                  if (!searchFilter.trim()) return true;
                  const q = searchFilter.toLowerCase();
                  const matchesName = group.name.toLowerCase().includes(q) || group.path.toLowerCase().includes(q);
                  const matchesChat = group.sessions.some(s => s.title.toLowerCase().includes(q) || (s.preview && s.preview.toLowerCase().includes(q)));
                  return matchesName || matchesChat;
                })
                .map((group) => {
                  const isExpanded = !collapsedProjects[group.path];
                  const filteredSessions = group.sessions.filter(s => {
                    if (!searchFilter.trim()) return true;
                    const q = searchFilter.toLowerCase();
                    return group.name.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || (s.preview && s.preview.toLowerCase().includes(q));
                  });

                  return (
                    <div key={group.path} className="space-y-0.5">
                      {/* Project Header Row (Folder + Project Name) */}
                      <div
                        onClick={() => toggleProject(group.path)}
                        className={`group flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          group.isCurrent 
                            ? 'hover:bg-card-border/40' 
                            : 'hover:bg-card-border/30'
                        }`}
                        title={group.path}
                      >
                        <div className="flex items-center space-x-2 overflow-hidden flex-1">
                          <Folder className={`w-3.5 h-3.5 shrink-0 ${group.isCurrent ? 'text-sky-400' : 'text-slate-400'}`} />
                          <span className={`truncate font-medium ${group.isCurrent ? 'text-sky-400 font-semibold' : 'text-slate-300 group-hover:text-white'}`}>
                            {group.name}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {/* Quick New Chat Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (group.isCurrent) {
                                onNewSession();
                              } else {
                                onSwitchProject(group.path);
                                setTimeout(() => onNewSession(), 120);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-card-border text-slate-400 hover:text-white transition-opacity"
                            title={`Novo Chat em ${group.name}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          
                          {/* Close/Inactivate project from open list (if not current) */}
                          {!group.isCurrent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCloseOpenProject(group.path);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-card-border text-slate-500 hover:text-amber-400 transition-opacity"
                              title="Inativar projeto (remover da barra lateral)"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}

                          <span className="text-slate-500">
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Indented Chat Sessions Underneath Project */}
                      {isExpanded && (
                        <div className="pl-5 space-y-0.5">
                          {filteredSessions.length === 0 ? (
                            <div className="py-1 px-2 text-[11px] text-slate-500 italic flex items-center justify-between">
                              <span>Sem chats recentes</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!group.isCurrent) onSwitchProject(group.path);
                                  setTimeout(() => onNewSession(), 100);
                                }}
                                className="text-[10px] text-accent-light hover:underline font-sans not-italic"
                              >
                                + Iniciar
                              </button>
                            </div>
                          ) : (
                            filteredSessions.map((s) => {
                              const isActive = activeSessionId === s.id;
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => {
                                    if (!group.isCurrent) {
                                      onSwitchProject(group.path);
                                    }
                                    onSelectSession(s.id);
                                  }}
                                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                                    isActive
                                      ? 'bg-[#282a2e] text-white font-semibold shadow-xs border border-white/10'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-card-border/30'
                                  }`}
                                  title={`${s.title}\n${s.preview}`}
                                >
                                  <div className="overflow-hidden pr-2 flex-1 flex items-center space-x-1.5">
                                    {s.isLiveVoice && (
                                      <span className="text-[10px] shrink-0" title="Live Voice">🎙️</span>
                                    )}
                                    <span className="truncate">
                                      {s.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {formatRelativeTime(s.updatedAt)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Deseja excluir esta conversa?')) {
                                          onDeleteSession(s.id);
                                        }
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 text-slate-500 transition-opacity"
                                      title="Excluir chat"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}

            {/* INACTIVE PROJECTS SECTION (Brings back projects anytime) */}
            {inactiveProjects.length > 0 && (
              <div className="pt-2 mt-2 border-t border-card-border/60">
                <button
                  type="button"
                  onClick={() => setShowInactive(!showInactive)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-card-border/30 rounded-lg transition-colors group"
                >
                  <span className="flex items-center space-x-1.5 font-medium">
                    <FolderGit2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                    <span>Projetos Inativos ({inactiveProjects.length})</span>
                  </span>
                  {showInactive ? (
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  )}
                </button>

                {showInactive && (
                  <div className="pl-2 pt-1 space-y-1">
                    {inactiveProjects.map(inPath => (
                      <div
                        key={inPath}
                        className="flex items-center justify-between py-1 px-2 rounded-lg bg-card-border/20 hover:bg-card-border/40 text-xs transition-colors"
                      >
                        <span className="truncate text-slate-300 font-medium text-[11px]" title={inPath}>
                          {pathBasename(inPath)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSwitchProject(inPath)}
                          className="px-2 py-0.5 text-[10px] bg-accent/20 hover:bg-accent text-accent-light hover:text-white rounded font-medium transition-all ml-2 shrink-0 flex items-center space-x-1"
                          title="Reativar projeto na barra lateral"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Reativar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FILES EXPLORER */}
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

        {/* TAB 3: MEMORY WIKI (ai-memory) */}
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

        {/* TAB 4: SPECIALIST ROUTINES */}
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

      {/* Right-Click Context Menu for Files and Folders */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-64 rounded-xl bg-[#141821]/95 border border-card-border shadow-2xl p-1.5 text-xs text-slate-200 backdrop-blur-md animate-in fade-in zoom-in-95 space-y-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Material Icon */}
          <div className="flex items-center space-x-2 px-2 py-1.5 border-b border-card-border/50 text-slate-400 font-mono text-[11px] truncate">
            <MaterialFileIcon filename={contextMenu.item.name} isDirectory={contextMenu.item.type === 'directory'} size={14} />
            <span className="font-semibold text-slate-200 truncate">{contextMenu.item.name}</span>
          </div>

          {contextMenu.item.type !== 'directory' && (
            <button
              onClick={() => {
                onSelectFile(contextMenu.item.path);
                setContextMenu(null);
              }}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-accent-light" />
              <span>Abrir no Tellus Studio</span>
            </button>
          )}

          <div className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase font-bold text-accent-light tracking-wider flex items-center space-x-1">
            <Bot className="w-3 h-3 text-cyan-400" />
            <span>Inteligência Artificial</span>
          </div>

          <button
            onClick={() => {
              const target = contextMenu.item.path;
              const isDir = contextMenu.item.type === 'directory';
              setContextMenu(null);
              if (onAskAI) {
                onAskAI(
                  isDir 
                    ? `Inspecione o diretório "${target}" e todos os seus arquivos. Me explique claramente qual o propósito desse diretório, o que cada arquivo faz e como ele se integra ao projeto.`
                    : `Analise o arquivo "${target}" e me explique detalhadamente o que ele faz, suas principais funções, dependências e responsabilidades na arquitetura.`,
                  target
                );
              }
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2 transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Do que se trata? (Explicar)</span>
          </button>

          <button
            onClick={() => {
              const target = contextMenu.item.path;
              const isDir = contextMenu.item.type === 'directory';
              setContextMenu(null);
              if (onAskAI) {
                onAskAI(
                  isDir
                    ? `Analise os arquivos e a estrutura dentro do diretório "${target}". Sugira melhorias de organização, modularidade, boas práticas e performance.`
                    : `Revise minuciosamente o código do arquivo "${target}". Sugira melhorias práticas de arquitetura, legibilidade, tratamento de erros e performance com exemplos de código.`,
                  target
                );
              }
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sugerir Melhorias com IA</span>
          </button>

          <button
            onClick={() => {
              const target = contextMenu.item.path;
              const isDir = contextMenu.item.type === 'directory';
              setContextMenu(null);
              if (onAskAI) {
                onAskAI(
                  isDir
                    ? `Dentro do diretório "${target}", preciso que você implemente: `
                    : `No arquivo "${target}", preciso que você implemente: `,
                  target
                );
              }
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Implementar Funcionalidade...</span>
          </button>

          <button
            onClick={() => {
              const target = contextMenu.item.path;
              const isDir = contextMenu.item.type === 'directory';
              setContextMenu(null);
              if (onAskAI) {
                onAskAI(
                  isDir
                    ? `Faça uma varredura crítica nos arquivos do diretório "${target}" procurando vulnerabilidades, possíveis bugs, exceções não tratadas e problemas de concorrência ou tipagem.`
                    : `Faça uma análise crítica no arquivo "${target}" procurando bugs, vulnerabilidades de segurança, edge cases não tratados e erros de tipagem.`,
                  target
                );
              }
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Diagnóstico & Procurar Bugs</span>
          </button>

          <div className="border-t border-card-border/50 my-1" />

          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.item.path);
              setContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-300 flex items-center space-x-2 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copiar Caminho</span>
          </button>

          <button
            onClick={async () => {
              const target = contextMenu.item.path;
              const isDir = contextMenu.item.type === 'directory';
              setContextMenu(null);
              if (confirm(`Tem certeza que deseja excluir ${isDir ? 'o diretório' : 'o arquivo'} "${target}"?`)) {
                try {
                  await api.deleteFile(target);
                  if (onRefreshFileTree) onRefreshFileTree();
                } catch (err: any) {
                  alert(`Erro ao excluir: ${err.message}`);
                }
              }
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 flex items-center space-x-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Excluir {contextMenu.item.type === 'directory' ? 'Diretório' : 'Arquivo'}</span>
          </button>
        </div>
      )}
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
