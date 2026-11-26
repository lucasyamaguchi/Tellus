import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, 
  BookOpen, 
  MessageSquare, 
  Bot, 
  Sparkles, 
  Network, 
  FolderGit2, 
  Plus, 
  Clock, 
  Send, 
  ArrowRight, 
  ExternalLink, 
  Lock, 
  Zap, 
  Globe, 
  FileText, 
  Folder, 
  RefreshCw,
  Flame,
  CheckCircle,
  HelpCircle,
  Settings
} from 'lucide-react';
import { 
  TelluNote, 
  ChatSessionMetadata, 
  ProjectOverview, 
  DirectoryAccessPolicy 
} from '../types';
import { api } from '../api';
import { InteractiveGraphCanvas } from './InteractiveGraphCanvas';

interface TellusHomeViewProps {
  currentProject: ProjectOverview | null;
  activeModel: string;
  sessions: ChatSessionMetadata[];
  onOpenNote: (titleOrPath: string) => void;
  onOpenNotesView: () => void;
  onSelectSession: (sessionId: string) => void;
  onStartQuickChat: (initialPrompt?: string) => void;
  onOpenProjectModal: () => void;
  onOpenConversationsView: () => void;
  onOpenProjectSettings?: () => void;
  effectiveSecurityPreset?: 'request_review' | 'default' | 'turbo';
  directoryAccessPolicy?: DirectoryAccessPolicy;
}

export const TellusHomeView: React.FC<TellusHomeViewProps> = ({
  currentProject,
  activeModel,
  sessions,
  onOpenNote,
  onOpenNotesView,
  onSelectSession,
  onStartQuickChat,
  onOpenProjectModal,
  onOpenConversationsView,
  onOpenProjectSettings,
  effectiveSecurityPreset = 'default',
  directoryAccessPolicy = 'ask_permission'
}) => {
  const [notes, setNotes] = useState<TelluNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState<boolean>(true);
  const [quickInput, setQuickInput] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock in real time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent notes
  const fetchRecentNotes = async () => {
    setIsLoadingNotes(true);
    try {
      const list = await api.listNotes();
      setNotes(list || []);
    } catch (err) {
      console.error('Falha ao buscar notas recentes na Home:', err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchRecentNotes();
    const handleVaultUpdated = () => fetchRecentNotes();
    window.addEventListener('tellus:vault-updated', handleVaultUpdated);
    return () => window.removeEventListener('tellus:vault-updated', handleVaultUpdated);
  }, []);

  // Top 5 most recent notes
  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [notes]);

  // Top 2 most recent chats (valid with messages or explicit titles)
  const recentChats = useMemo(() => {
    return [...sessions]
      .filter(s => s && s.id && s.title && s.title !== 'Novo Chat')
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .slice(0, 2);
  }, [sessions]);

  const handleQuickSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;
    onStartQuickChat(trimmed);
    setQuickInput('');
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleQuickSubmit();
    }
  };

  const formatRelativeTime = (timestamp?: string | number) => {
    if (!timestamp) return 'Recente';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours} h`;
    if (diffDays === 1) return 'ontem';
    if (diffDays < 7) return `há ${diffDays} dias`;
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  const cleanSnippet = (content?: string) => {
    if (!content) return 'Nota sem conteúdo.';
    return content
      .replace(/^---[\s\S]*?---/, '') // remove frontmatter
      .replace(/#+\s+/g, '') // remove markdown headings
      .replace(/\[\[(.*?)\]\]/g, '$1') // wikilinks to raw text
      .trim()
      .slice(0, 120);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c0d12] text-slate-100 overflow-y-auto select-none p-4 md:p-6 space-y-6">
      {/* 1. Welcome & Workspace Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#11141c] p-4 md:p-5 rounded-xl border border-white/8 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base md:text-lg font-bold tracking-tight text-white">
                Tellus Home
              </h1>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                Workspace Central
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Visão consolidada do workspace, grafos de conhecimento, notas recentes e início rápido.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Active Project Pill */}
          <button
            onClick={onOpenProjectModal}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#151822] hover:bg-[#1a1f2c] border border-white/8 text-slate-200 hover:text-white transition-all cursor-pointer shadow-xs group"
            title="Alterar ou abrir projeto no workspace"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-blue-400 group-hover:scale-105 transition-transform" />
            <span className="font-medium">{currentProject ? currentProject.name : 'Nenhum Projeto Aberto'}</span>
            <span className="text-[10px] text-slate-500 font-mono">trocar</span>
          </button>

          {/* Directory Access Policy Badge */}
          {onOpenProjectSettings && (
            <button
              onClick={onOpenProjectSettings}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                directoryAccessPolicy === 'unrestricted'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
              }`}
              title="Configuração de segurança e escopo de diretórios. Clique para alterar."
            >
              {directoryAccessPolicy === 'unrestricted' ? (
                <>
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Seguir com Tudo</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-blue-400" />
                  <span>Pedir Permissão</span>
                </>
              )}
            </button>
          )}

          {/* Real-time Clock */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#151822] border border-white/8 text-slate-400 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      {/* 2. Top Section: Grafos & 5 Notas Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Knowledge & Topology Graph (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col h-[420px] bg-[#11141c] rounded-xl border border-white/8 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/8 bg-[#141822]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Network className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Grafo de Conhecimento & Topologia
              </h3>
            </div>
            <button
              onClick={onOpenNotesView}
              className="flex items-center space-x-1 text-[11px] font-medium text-blue-400 hover:text-white transition-colors cursor-pointer group"
              title="Abrir visualização completa do grafo no Notes"
            >
              <span>Explorar Grafo Completo</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>

          <div className="flex-1 relative w-full h-full">
            <InteractiveGraphCanvas
              embeddedMode={true}
              onOpenNote={(noteTitle) => onOpenNote(noteTitle)}
            />
          </div>
        </div>

        {/* Right: 5 Notas Recentes (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col h-[420px] bg-[#11141c] rounded-xl border border-white/8 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/8 bg-[#141822]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                5 Notas Recentes
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onOpenNote('Nova Nota')}
                className="p-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium flex items-center space-x-1 transition-all cursor-pointer"
                title="Criar uma nova anotação no Vault"
              >
                <Plus className="w-3 h-3" />
                <span>Nova</span>
              </button>
              <button
                onClick={onOpenNotesView}
                className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Ver todos os cadernos e notas"
              >
                Ver Todas ↗
              </button>
            </div>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-card-border">
            {isLoadingNotes ? (
              <div className="h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                <span className="text-xs font-mono">Carregando notas recentes...</span>
              </div>
            ) : recentNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2">
                <FileText className="w-8 h-8 opacity-40 text-slate-400" />
                <p className="text-xs">Nenhuma nota criada ainda no Vault.</p>
                <button
                  onClick={() => onOpenNote('Primeira Nota')}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Criar Primeira Nota
                </button>
              </div>
            ) : (
              recentNotes.map((note) => (
                <div
                  key={note.id || note.title}
                  onClick={() => onOpenNote(note.title)}
                  className="p-3 rounded-lg bg-[#141822] hover:bg-[#181d2a] border border-white/6 hover:border-blue-500/30 transition-all cursor-pointer group shadow-xs flex flex-col justify-between space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-sm">📄</span>
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                        {note.title}
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {formatRelativeTime(note.updatedAt || note.createdAt)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {cleanSnippet(note.content)}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md bg-[#0e1118] border border-white/6 text-slate-400 flex items-center space-x-1">
                      <Folder className="w-2.5 h-2.5 text-blue-400" />
                      <span>{note.folder || 'Geral'}</span>
                    </span>
                    <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 font-medium">
                      <span>Abrir</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Bottom Section: 2 Últimos Chats & Chat Rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 2 Últimos Chats Realizados (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col bg-[#11141c] rounded-xl border border-white/8 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/8 bg-[#141822]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                2 Últimos Chats Realizados
              </h3>
            </div>
            <button
              onClick={onOpenConversationsView}
              className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Abrir central de conversas"
            >
              Ver Todas ↗
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
            {recentChats.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <MessageSquare className="w-8 h-8 opacity-40 mx-auto" />
                <p className="text-xs">Nenhum chat recente registrado.</p>
                <button
                  onClick={() => onStartQuickChat()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Iniciar Nova Conversa
                </button>
              </div>
            ) : (
              recentChats.map((chat) => {
                const isStandalone = !!chat.isStandalone || !chat.projectPath;
                return (
                  <div
                    key={chat.id}
                    onClick={() => onSelectSession(chat.id)}
                    className="p-3.5 rounded-lg bg-[#141822] hover:bg-[#181d2a] border border-white/6 hover:border-blue-500/30 transition-all cursor-pointer group shadow-xs flex flex-col space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        {isStandalone ? (
                          <div className="p-1 rounded-md bg-blue-500/10 text-blue-300">
                            <Globe className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-300">
                            <FolderGit2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <h4 className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors truncate">
                          {chat.title}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {formatRelativeTime(chat.updatedAt || chat.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-md font-medium border ${
                          isStandalone 
                            ? 'bg-blue-950/40 border-blue-800/40 text-blue-300' 
                            : 'bg-indigo-950/40 border-indigo-800/40 text-indigo-300'
                        }`}>
                          {isStandalone ? 'Conversa Livre' : (chat.projectName || 'Projeto')}
                        </span>
                        <span className="font-mono text-slate-500">
                          {chat.model ? chat.model.split('/').pop() : activeModel.split('/').pop()}
                        </span>
                      </div>
                      <span className="text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                        <span>Continuar</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            <button
              onClick={() => onStartQuickChat()}
              className="w-full py-2 rounded-lg bg-[#141822] hover:bg-[#181d2a] border border-white/6 text-xs text-slate-300 hover:text-white font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Abrir Novo Chat Livre</span>
            </button>
          </div>
        </div>

        {/* Right: Chat Rápido (Quick Chat - Sem projeto vinculado) (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col bg-[#11141c] rounded-xl border border-white/8 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/8 bg-[#141822]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Chat Rápido
              </h3>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center space-x-1">
                <Globe className="w-2.5 h-2.5" />
                <span>Conversa Livre (Sem Projeto)</span>
              </span>
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                '💡 Dúvida Rápida',
                '📚 Explicar Conceito',
                '🚀 Iniciar Novo Tema',
                '📝 Ideia ou Brainstorming'
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setQuickInput(prev => prev ? `${prev} ${chip.replace(/^[^\s]+\s*/, '')}` : chip.replace(/^[^\s]+\s*/, ''))}
                  className="px-2.5 py-1 rounded-md bg-[#141822] hover:bg-[#181d2a] border border-white/6 hover:border-blue-500/30 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Prompt Input Form */}
            <form onSubmit={handleQuickSubmit} className="space-y-2.5">
              <div className="relative">
                <textarea
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={handleQuickKeyDown}
                  placeholder="Tire uma dúvida rápida, cole um trecho de código ou inicie um novo tema sem vínculo a nenhum projeto... (Ctrl+Enter para enviar)"
                  rows={4}
                  className="w-full bg-[#0e1118] border border-white/10 focus:border-blue-500/50 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none resize-none transition-all leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-mono text-slate-400">Modelo: {activeModel.split('/').pop()}</span>
                </div>

                <button
                  type="submit"
                  disabled={!quickInput.trim()}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
                    quickInput.trim()
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs active:scale-95'
                      : 'bg-[#141822] border border-white/6 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Enviar</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
