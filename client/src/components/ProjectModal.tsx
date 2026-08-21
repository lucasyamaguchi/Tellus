import React, { useState, useEffect, useRef } from 'react';
import { X, FolderPlus, FolderGit2, ArrowRight, FolderSearch, HardDrive, Check } from 'lucide-react';
import { api } from '../api';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  recentProjects: string[];
  onOpenProject: (path: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  recentProjects,
  onOpenProject,
}) => {
  const [projectPathInput, setProjectPathInput] = useState(currentPath || '');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProjectPathInput(currentPath || '');
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

  const quickPresets = [
    'e:\\Die-Sonne\\Projects',
    currentPath,
    'C:\\Users\\Lusca\\Projects'
  ].filter(Boolean);

  const uniquePresets = Array.from(new Set(quickPresets));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in select-none">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <FolderGit2 className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Abrir ou Criar Projeto Local</h3>
              <p className="text-[11px] text-slate-400">
                Selecione ou digite a pasta onde o agente/chat deve iniciar.
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

        {/* Form Body */}
        <form onSubmit={handleOpen} className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Caminho da Pasta do Projeto:</span>
              <span className="text-[10px] text-slate-400 font-mono">Digitação manual ou Seletor nativo</span>
            </label>

            {/* Input with Browse Button */}
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={projectPathInput}
                  onChange={(e) => setProjectPathInput(e.target.value)}
                  placeholder="Ex: E:\Die-Sonne\Projects\MeuNovoApp"
                  className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent shadow-inner"
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={handlePickDirectory}
                disabled={isBrowsing}
                className="px-3.5 py-2.5 rounded-xl bg-panel hover:bg-card-border border border-card-border text-accent-light hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm shrink-0"
                title="Abrir janela nativa do Windows para escolher a pasta"
              >
                <FolderSearch className="w-4 h-4" />
                <span>{isBrowsing ? 'Escolhendo...' : 'Procurar Pasta'}</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 block leading-relaxed">
              💡 Se a pasta não existir, o Tellus criará o diretório e inicializará a memória <code className="text-brand-amber font-mono">.agentic/</code> automaticamente.
            </span>
          </div>

          {/* Quick Preset Directories */}
          {uniquePresets.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Sugestões Rápidas:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {uniquePresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setProjectPathInput(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all truncate max-w-xs ${
                      projectPathInput === preset
                        ? 'bg-accent/20 border-accent text-accent-light'
                        : 'bg-card hover:bg-card-border border-card-border text-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Projects List */}
          {recentProjects.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Histórico de Projetos Recentes:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-card-border">
                {recentProjects.map((p) => {
                  const isCurrent = p === currentPath;
                  return (
                    <div
                      key={p}
                      onClick={() => {
                        onOpenProject(p);
                        onClose();
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between group cursor-pointer ${
                        isCurrent
                          ? 'bg-accent/15 border-accent text-white'
                          : 'bg-panel hover:bg-card-border/60 border-card-border text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <FolderGit2 className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-accent-light' : 'text-slate-400'}`} />
                        <span className="truncate font-mono">{p}</span>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 shrink-0 flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Ativo</span>
                        </span>
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent-light group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-card-border flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!projectPathInput.trim()}
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-accent/25 transition-all disabled:bg-card-border disabled:text-slate-500"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Abrir Projeto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
