import React, { useState, useEffect, useRef } from 'react';
import { X, FolderPlus, FolderGit2, ArrowRight, FolderSearch, HardDrive, Check, Sparkles, RefreshCw, Globe } from 'lucide-react';
import { api } from '../api';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  recentProjects: string[];
  onOpenProject: (path: string) => void;
  onCloseProject?: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  recentProjects,
  onOpenProject,
  onCloseProject,
}) => {
  const [projectPathInput, setProjectPathInput] = useState(currentPath || '');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [projectsRoot, setProjectsRoot] = useState<string>('');
  const [discoveredProjects, setDiscoveredProjects] = useState<Array<{
    name: string;
    path: string;
    isCurrent: boolean;
    isOpen: boolean;
    hasAgentic: boolean;
    lastModified: number;
    modulesCount: number;
    artifactsCount: number;
  }>>([]);
  const [isLoadingDiscovered, setIsLoadingDiscovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDiscovered = async () => {
    setIsLoadingDiscovered(true);
    try {
      const data = await api.getDiscoveredProjects();
      setProjectsRoot(data.projectsRoot || '');
      setDiscoveredProjects(data.projects || []);
    } catch {}
    finally {
      setIsLoadingDiscovered(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setProjectPathInput(currentPath || '');
      loadDiscovered();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, currentPath]);

  if (!isOpen) return null;

  const handleOpen = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!projectPathInput.trim()) return;
    onOpenProject(projectPathInput.trim());
    onClose();
  };

  const handlePickDirectory = async () => {
    setIsBrowsing(true);
    try {
      const picked = await api.pickDirectory();
      if (picked) {
        setProjectPathInput(picked);
      }
    } catch (err: any) {
      alert(`Erro ao abrir seletor de pasta: ${err.message}`);
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleChangeRoot = async () => {
    try {
      const picked = await api.pickDirectory();
      if (picked) {
        await api.setProjectsRoot(picked);
        loadDiscovered();
      }
    } catch (err: any) {
      alert(`Erro ao alterar diretório raiz de projetos: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in select-none">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-card-border/80 shadow-sm flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Tellus" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Gerenciador de Projetos do Tellus</h3>
              <p className="text-[11px] text-slate-400">
                Selecione um projeto detectado na sua pasta padrão ou abra qualquer pasta local.
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Projects Root Bar */}
          <div className="p-3 rounded-xl bg-[#0b0e14] border border-card-border/80 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block font-mono">
                Diretório Raiz Padrão:
              </span>
              <span className="text-xs font-mono text-cyan-300 truncate block mt-0.5" title={projectsRoot}>
                {projectsRoot || 'Detectando diretório raiz...'}
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={loadDiscovered}
                className="p-1.5 rounded-lg bg-panel hover:bg-card border border-card-border text-slate-400 hover:text-white transition-all"
                title="Recarregar projetos da pasta"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiscovered ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleChangeRoot}
                className="px-2.5 py-1.5 rounded-lg bg-panel hover:bg-card border border-card-border text-xs text-slate-300 hover:text-white transition-all font-semibold"
                title="Mudar pasta raiz padrão onde todos os seus projetos ficam"
              >
                Alterar Raiz
              </button>
            </div>
          </div>

          {/* Discovered Projects Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-accent-light" />
                <span>Projetos Encontrados ({discoveredProjects.length}):</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Clique para alternar o projeto ativo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-card-border">
              {discoveredProjects.map((p) => {
                const isCurrent = p.isCurrent;
                return (
                  <div
                    key={p.path}
                    onClick={() => {
                      onOpenProject(p.path);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border transition-all text-left group cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      isCurrent
                        ? 'bg-accent/20 border-accent ring-1 ring-accent/50 shadow-md'
                        : 'bg-card/70 hover:bg-card border-card-border/80 hover:border-accent/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <FolderGit2 className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-accent-light' : 'text-slate-400'}`} />
                        <span className="font-bold text-xs text-white truncate">{p.name}</span>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                          Ativo
                        </span>
                      ) : p.hasAgentic ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/30">
                          Tellus
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{p.modulesCount} pastas</span>
                      <span>•</span>
                      <span>{p.artifactsCount} artefatos</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all ml-auto" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Manual Path or Folder Picker Form */}
          <form onSubmit={handleOpen} className="space-y-3 pt-2 border-t border-card-border/80">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Abrir Outra Pasta / Novo Diretório:</span>
            </label>

            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={projectPathInput}
                  onChange={(e) => setProjectPathInput(e.target.value)}
                  placeholder="Ex: C:\Projetos\MeuApp ou E:\Die-Sonne\Projects\MeuProjeto"
                  className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent shadow-inner"
                />
              </div>

              <button
                type="button"
                onClick={handlePickDirectory}
                disabled={isBrowsing}
                className="px-3.5 py-2 rounded-xl bg-panel hover:bg-card-border border border-card-border text-accent-light hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                title="Abrir seletor nativo do Windows"
              >
                <FolderSearch className="w-4 h-4" />
                <span>{isBrowsing ? 'Escolhendo...' : 'Procurar'}</span>
              </button>

              <button
                type="submit"
                disabled={!projectPathInput.trim()}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-accent/25 transition-all disabled:bg-card-border disabled:text-slate-500 cursor-pointer shrink-0"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Abrir</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-card-border bg-sidebar flex items-center justify-between">
          {onCloseProject && currentPath ? (
            <button
              type="button"
              onClick={() => {
                onCloseProject();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl border border-cyan-500/30 hover:bg-cyan-950/40 text-cyan-300 text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Usar Modo Conversa Livre (Sem Projeto)</span>
            </button>
          ) : <div /> }
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
