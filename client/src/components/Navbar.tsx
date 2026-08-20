import React, { useState } from 'react';
import { 
  FolderGit2, 
  Sparkles, 
  Cpu, 
  Key, 
  PanelRightClose, 
  PanelRightOpen, 
  ChevronDown,
  Layers,
  BrainCircuit,
  Zap,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { AppConfig, OpenRouterModel, ProjectOverview, Routine } from '../types';
import { api } from '../api';

interface NavbarProps {
  config: AppConfig | null;
  currentProject: ProjectOverview | null;
  activeModel: string;
  activeRoutine: Routine | null;
  isRightPanelOpen: boolean;
  rightPanelTab: 'code' | 'memory' | 'terminal';
  isOverlayActive: boolean;
  onToggleRightPanel: () => void;
  onToggleOverlay: () => void;
  onSetRightPanelTab: (tab: 'code' | 'memory' | 'terminal') => void;
  onOpenModelModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenProjectModal: () => void;
  onSelectRoutine: (routine: Routine) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  currentProject,
  activeModel,
  activeRoutine,
  isRightPanelOpen,
  rightPanelTab,
  isOverlayActive,
  onToggleRightPanel,
  onToggleOverlay,
  onSetRightPanelTab,
  onOpenModelModal,
  onOpenSettingsModal,
  onOpenProjectModal,
  onSelectRoutine,
}) => {
  const [isCliDropdownOpen, setIsCliDropdownOpen] = useState(false);

  const configuredKeysCount = [
    config?.keys.openrouter,
    config?.keys.google,
    config?.keys.anthropic,
    config?.keys.openai
  ].filter(Boolean).length;

  const handleLaunchCli = async (agent: string) => {
    setIsCliDropdownOpen(false);
    try {
      await api.launchExternalTerminal(agent);
    } catch (err: any) {
      alert(`Erro ao abrir terminal CLI: ${err.message}`);
    }
  };

  return (
    <header className="h-14 border-b border-card-border bg-sidebar px-4 flex items-center justify-between select-none z-20">
      {/* Left: Brand & Project Selector */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-accent/40 shadow-lg shadow-accent/20 bg-card flex items-center justify-center">
            <img src="/logo.png" alt="Tellus Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-bold text-sm bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Tellus
            </span>
            <span className="text-[10px] text-accent-light block font-mono -mt-0.5">
              ai-memory engine
            </span>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-card-border" />

        {/* Project Selector Button */}
        <button
          onClick={onOpenProjectModal}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-card hover:bg-card-border/60 border border-card-border text-xs text-slate-200 transition-all group"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-accent-light group-hover:scale-110 transition-transform" />
          <span className="font-medium max-w-[160px] truncate">
            {currentProject ? currentProject.name : 'Selecionar Projeto...'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* Center: Active Model & Routine Switchers */}
      <div className="flex items-center space-x-2">
        {/* Model Picker Pill */}
        <button
          onClick={onOpenModelModal}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-panel hover:bg-card-border/70 border border-card-border text-xs text-slate-200 transition-all shadow-sm group"
        >
          <Cpu className="w-3.5 h-3.5 text-brand-cyan group-hover:text-accent-light transition-colors" />
          <div className="flex flex-col items-start text-left">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-none">
              Modelo Ativo
            </span>
            <span className="font-mono text-xs font-semibold text-slate-100 max-w-[200px] truncate">
              {activeModel.split('/').pop()}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
        </button>

        {/* Routine Selector Dropdown Pill */}
        {activeRoutine && (
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-xs text-accent-light">
            <Zap className="w-3.5 h-3.5 text-accent animate-pulse-subtle" />
            <span className="font-medium">{activeRoutine.name}</span>
          </div>
        )}
      </div>

      {/* Right: CLI Launcher, API Keys, View Modes & Panel Toggle */}
      <div className="flex items-center space-x-3">
        {/* Overlay Mode Toggle Button */}
        <button
          onClick={onToggleOverlay}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
            isOverlayActive
              ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan shadow-sm shadow-brand-cyan/10'
              : 'bg-card hover:bg-card-border/70 border-card-border text-slate-300'
          }`}
          title="Ativar widget flutuante sobreposto a outras janelas (VS Code, etc.)"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
          <span>Modo Sobreposto</span>
        </button>

        {/* Launch External CLI Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsCliDropdownOpen(!isCliDropdownOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-card hover:bg-card-border/70 border border-card-border text-xs text-slate-200 transition-all"
            title="Abrir terminal CMD / PowerShell com agentes CLI"
          >
            <Terminal className="w-3.5 h-3.5 text-brand-amber" />
            <span>Abrir CLI</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isCliDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-card border border-card-border rounded-xl shadow-2xl p-1.5 space-y-1 z-50 text-xs animate-in fade-in">
              <button
                onClick={() => handleLaunchCli('claude')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-card-border text-slate-200 flex items-center justify-between"
              >
                <span>Claude Code</span>
                <code className="text-[10px] text-accent-light font-mono">claude</code>
              </button>
              <button
                onClick={() => handleLaunchCli('gemini')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-card-border text-slate-200 flex items-center justify-between"
              >
                <span>Gemini CLI</span>
                <code className="text-[10px] text-brand-cyan font-mono">gemini</code>
              </button>
              <button
                onClick={() => handleLaunchCli('agy')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-card-border text-slate-200 flex items-center justify-between"
              >
                <span>Antigravity CLI</span>
                <code className="text-[10px] text-brand-emerald font-mono">agy</code>
              </button>
              <button
                onClick={() => handleLaunchCli('aider')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-card-border text-slate-200 flex items-center justify-between"
              >
                <span>Aider / Codex</span>
                <code className="text-[10px] text-brand-purple font-mono">aider</code>
              </button>
              <div className="h-[1px] bg-card-border my-1" />
              <button
                onClick={() => handleLaunchCli('powershell')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-card-border text-slate-300 flex items-center justify-between"
              >
                <span>PowerShell do Projeto</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          )}
        </div>

        {/* API Keys status */}
        <button
          onClick={onOpenSettingsModal}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
            configuredKeysCount > 0
              ? 'bg-brand-emerald/10 border-brand-emerald/30 text-emerald-300 hover:bg-brand-emerald/20'
              : 'bg-brand-amber/10 border-brand-amber/30 text-amber-300 hover:bg-brand-amber/20 animate-pulse'
          }`}
          title="Gerenciar Chaves de API (OpenRouter, Google, Claude, OpenAI)"
        >
          <Key className="w-3.5 h-3.5" />
          <span>
            {configuredKeysCount > 0 ? `${configuredKeysCount} Provedor(es) OK` : 'Configurar Chaves'}
          </span>
          {configuredKeysCount > 0 ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <AlertCircle className="w-3 h-3 text-amber-400" />
          )}
        </button>

        {/* Right Panel Tabs Controls */}
        <div className="flex items-center bg-card rounded-lg p-0.5 border border-card-border text-xs">
          <button
            onClick={() => {
              onSetRightPanelTab('code');
              if (!isRightPanelOpen) onToggleRightPanel();
            }}
            className={`px-2.5 py-1 rounded-md transition-all ${
              isRightPanelOpen && rightPanelTab === 'code'
                ? 'bg-accent text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Código
          </button>
          <button
            onClick={() => {
              onSetRightPanelTab('memory');
              if (!isRightPanelOpen) onToggleRightPanel();
            }}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
              isRightPanelOpen && rightPanelTab === 'memory'
                ? 'bg-accent text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Memória</span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
          </button>
          <button
            onClick={() => {
              onSetRightPanelTab('terminal');
              if (!isRightPanelOpen) onToggleRightPanel();
            }}
            className={`px-2.5 py-1 rounded-md transition-all ${
              isRightPanelOpen && rightPanelTab === 'terminal'
                ? 'bg-accent text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Terminal
          </button>
        </div>

        {/* Toggle Panel Button */}
        <button
          onClick={onToggleRightPanel}
          className="p-2 rounded-lg bg-card hover:bg-card-border text-slate-300 transition-colors border border-card-border"
          title={isRightPanelOpen ? 'Ocultar Painel Lateral' : 'Exibir Painel Lateral'}
        >
          {isRightPanelOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
