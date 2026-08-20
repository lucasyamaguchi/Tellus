import React, { useState } from 'react';
import { X, FolderPlus, FolderGit2, ArrowRight } from 'lucide-react';

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
  const [projectPathInput, setProjectPathInput] = useState('');

  if (!isOpen) return null;

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectPathInput.trim()) return;
    onOpenProject(projectPathInput.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <FolderGit2 className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Abrir ou Criar Projeto Local</h3>
              <p className="text-[11px] text-slate-400">Cada projeto possui sua própria base de memória (.agentic/).</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleOpen} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200">
              Caminho Completo da Pasta do Projeto
            </label>
            <input
              type="text"
              value={projectPathInput}
              onChange={(e) => setProjectPathInput(e.target.value)}
              placeholder="Ex: E:\Die-Sonne\Projects\MeuNovoApp"
              className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
            />
            <span className="text-[10px] text-slate-500 block">
              Se a pasta não existir, ela será criada automaticamente e o wiki de memória será inicializado.
            </span>
          </div>

          {recentProjects.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-400 block">
                Projetos Recentes:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {recentProjects.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onOpenProject(p);
                      onClose();
                    }}
                    className="w-full p-2.5 rounded-xl bg-panel hover:bg-card-border/60 border border-card-border text-left text-xs text-slate-200 transition-all flex items-center justify-between group"
                  >
                    <span className="truncate font-mono">{p}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent-light group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2">
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
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Abrir Projeto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
