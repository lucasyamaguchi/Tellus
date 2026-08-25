import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderGit2, 
  Sparkles, 
  Cpu, 
  Key, 
  PanelRightClose, 
  PanelRightOpen, 
  ChevronDown,
  Layers,
  Zap,
  Terminal,
  ExternalLink,
  Coins,
  FileText,
  RefreshCw,
  Bot,
  Network,
  Settings,
  MoreVertical,
  Code2,
  BrainCircuit,
  Sun,
  Moon
} from 'lucide-react';
import { AppConfig, ProjectOverview, Routine, OpenRouterCredits } from '../types';
import { api } from '../api';

interface NavbarProps {
  config: AppConfig | null;
  currentProject: ProjectOverview | null;
  activeModel: string;
  activeRoutine: Routine | null;
  mainViewMode: 'agent' | 'notes' | 'skills';
  isRightPanelOpen: boolean;
  rightPanelTab: 'code' | 'memory' | 'terminal';
  isOverlayActive: boolean;
  tokenEfficiency: boolean;
  hasCustomPipeline?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onSetMainViewMode: (mode: 'agent' | 'notes' | 'skills') => void;
  onToggleRightPanel: () => void;
  onToggleOverlay: () => void;
  onToggleTokenEfficiency: () => void;
  onOpenPipelineModal: () => void;
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
  mainViewMode,
  isRightPanelOpen,
  rightPanelTab,
  isOverlayActive,
  tokenEfficiency,
  hasCustomPipeline,
  theme,
  onToggleTheme,
  onSetMainViewMode,
  onToggleRightPanel,
  onToggleOverlay,
  onToggleTokenEfficiency,
  onOpenPipelineModal,
  onSetRightPanelTab,
  onOpenModelModal,
  onOpenSettingsModal,
  onOpenProjectModal,
  onSelectRoutine,
}) => {
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [credits, setCredits] = useState<OpenRouterCredits | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchCredits = async () => {
    if (!config?.keys.openrouter) return;
    setIsLoadingCredits(true);
    try {
      const data = await api.getOpenRouterCredits();
      setCredits(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingCredits(false);
    }
  };

  useEffect(() => {
    if (config?.keys.openrouter) {
      fetchCredits();
      const interval = setInterval(fetchCredits, 60000);
      return () => clearInterval(interval);
    }
  }, [config?.keys.openrouter]);

  // Click outside to close dropdown menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuDropdownOpen(false);
      }
    };
    if (isMenuDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuDropdownOpen]);

  const configuredKeysCount = [
    config?.keys.openrouter,
    config?.keys.google,
    config?.keys.anthropic,
    config?.keys.openai
  ].filter(Boolean).length;

  const handleLaunchCli = async (agent: string) => {
    setIsMenuDropdownOpen(false);
    try {
      await api.launchExternalTerminal(agent);
    } catch (err: any) {
      alert(`Erro ao abrir terminal CLI: ${err.message}`);
    }
  };

  return (
    <header className="h-14 border-b border-card-border bg-sidebar px-3.5 flex items-center justify-between select-none z-20 gap-3">
      {/* 1. Left Section: Logo & Clean View Switcher & Project Pill */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {/* Tellus Brand */}
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-accent/40 shadow-sm bg-card flex items-center justify-center">
            <img src="/logo.png" alt="Tellus Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-sm bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent hidden sm:inline font-mono">
            Tellus
          </span>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="flex items-center bg-card rounded-lg p-0.5 border border-card-border text-xs">
          <button
            onClick={() => onSetMainViewMode('agent')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
              mainViewMode === 'agent'
                ? 'bg-accent text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Agente & IDE</span>
          </button>

          <button
            onClick={() => onSetMainViewMode('notes')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
              mainViewMode === 'notes'
                ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="FrankMD Notes & Knowledge Vault estilo Notion"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Notas & Vault</span>
          </button>

          <button
            onClick={() => onSetMainViewMode('skills')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
              mainViewMode === 'skills'
                ? 'bg-accent text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Skills dos Agentes e Artefatos do Projeto"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Skills</span>
          </button>
        </div>

        {/* Project Selector Button */}
        <button
          onClick={onOpenProjectModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-card hover:bg-card-border/60 border border-card-border text-xs text-slate-300 transition-all max-w-[150px]"
          title={currentProject ? currentProject.path : 'Selecionar Projeto...'}
        >
          <FolderGit2 className="w-3.5 h-3.5 text-accent-light shrink-0" />
          <span className="font-medium truncate text-[11px]">
            {currentProject ? currentProject.name : 'Selecionar...'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
        </button>
      </div>

      {/* 2. Center Section: Unified AI Model & Pipeline Hub */}
      <div className="flex items-center space-x-1.5 bg-card/80 p-1 rounded-xl border border-card-border shadow-sm">
        {/* Active Model Pill */}
        <button
          onClick={onOpenModelModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-panel hover:bg-card-border/70 text-xs text-slate-200 transition-all group"
          title="Trocar modelo principal ou digitar modelo customizado do OpenRouter"
        >
          <Cpu className="w-3.5 h-3.5 text-brand-cyan group-hover:text-accent-light transition-colors" />
          <span className="font-mono text-xs font-semibold text-slate-100 max-w-[130px] truncate">
            {activeModel.split('/').pop()}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Multi-Agent Pipeline Map Button */}
        <button
          onClick={onOpenPipelineModal}
          className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg border text-xs transition-all ${
            hasCustomPipeline
              ? 'bg-brand-purple/20 border-brand-purple/50 text-brand-purple'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-panel'
          }`}
          title="Ver e orquestrar o Mind Map / Pipeline multi-modelo de especialistas"
        >
          <Network className={`w-3.5 h-3.5 ${hasCustomPipeline ? 'text-brand-purple' : 'text-slate-400'}`} />
          <span className="hidden lg:inline text-[11px] font-medium">Pipeline</span>
          {hasCustomPipeline && <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse" />}
        </button>

        {/* Token Efficiency Quick Toggle Icon */}
        <button
          onClick={onToggleTokenEfficiency}
          className={`p-1.5 rounded-lg border text-xs transition-all ${
            tokenEfficiency
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-panel'
          }`}
          title={`Modo Token Efficiency: ${tokenEfficiency ? 'ATIVADO (respostas diretas e sem enrolação)' : 'DESATIVADO'}`}
        >
          <Zap className={`w-3.5 h-3.5 ${tokenEfficiency ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-slate-400'}`} />
        </button>
      </div>

      {/* 3. Right Section: Live Balance, Right Panel Tabs & Consolidated Menu */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* OpenRouter Live Balance / Credit Monitor */}
        {config?.keys.openrouter && (
          <button
            onClick={fetchCredits}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-900/40 transition-all font-mono"
            title="Saldo da OpenRouter (clique para atualizar)"
          >
            <Coins className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold text-[11px]">
              {credits !== null ? `$${credits.remainingCredits.toFixed(2)}` : '...'}
            </span>
            <RefreshCw className={`w-2.5 h-2.5 text-emerald-400 ml-0.5 ${isLoadingCredits ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Right Panel View Tabs (Agent Mode) */}
        {mainViewMode === 'agent' && (
          <div className="flex items-center space-x-1 bg-card rounded-lg p-0.5 border border-card-border text-xs">
            <button
              onClick={() => {
                onSetRightPanelTab('code');
                if (!isRightPanelOpen) onToggleRightPanel();
              }}
              className={`px-2 py-1 rounded-md transition-all text-[11px] ${
                isRightPanelOpen && rightPanelTab === 'code'
                  ? 'bg-accent text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Editor de Código"
            >
              Código
            </button>
            <button
              onClick={() => {
                onSetRightPanelTab('memory');
                if (!isRightPanelOpen) onToggleRightPanel();
              }}
              className={`px-2 py-1 rounded-md transition-all text-[11px] ${
                isRightPanelOpen && rightPanelTab === 'memory'
                  ? 'bg-accent text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Memória & Contexto Ativo"
            >
              Memória
            </button>
            <button
              onClick={() => {
                onSetRightPanelTab('terminal');
                if (!isRightPanelOpen) onToggleRightPanel();
              }}
              className={`px-2 py-1 rounded-md transition-all text-[11px] ${
                isRightPanelOpen && rightPanelTab === 'terminal'
                  ? 'bg-accent text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Terminal Integrado"
            >
              Terminal
            </button>

            <button
              onClick={onToggleRightPanel}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              title={isRightPanelOpen ? 'Recolher Painel Lateral' : 'Abrir Painel Lateral'}
            >
              {isRightPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Consolidated Tools & Settings Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
            className={`p-1.5 rounded-lg border text-slate-300 transition-all ${
              isMenuDropdownOpen ? 'bg-card-border border-accent text-white' : 'bg-card hover:bg-card-border border-card-border'
            }`}
            title="Mais Opções, Chaves e Ferramentas CLI"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-card-border rounded-xl shadow-2xl p-1.5 space-y-1 z-50 text-xs animate-in fade-in">
              {/* API Keys Configuration */}
              <button
                onClick={() => {
                  setIsMenuDropdownOpen(false);
                  onOpenSettingsModal();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Key className="w-3.5 h-3.5 text-accent-light" />
                  <span>Chaves de API</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-panel border border-card-border text-slate-400 font-mono">
                  {configuredKeysCount}/4
                </span>
              </button>

              {/* Theme Toggle (Dark / Light) */}
              {onToggleTheme && (
                <button
                  onClick={() => {
                    setIsMenuDropdownOpen(false);
                    onToggleTheme();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                  title="Alternar entre tema escuro e tema claro"
                >
                  <div className="flex items-center space-x-2">
                    {theme === 'light' ? (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-accent-light" />
                    )}
                    <span>Tema: {theme === 'light' ? 'Claro' : 'Escuro'}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-panel border border-card-border text-slate-400 font-mono">
                    {theme === 'light' ? '☀️ Claro' : '🌙 Escuro'}
                  </span>
                </button>
              )}

              {/* Floating Overlay Mode Toggle */}
              <button
                onClick={() => {
                  setIsMenuDropdownOpen(false);
                  onToggleOverlay();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Widget Sobreposto</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isOverlayActive ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-slate-500'
                }`}>
                  {isOverlayActive ? 'ON' : 'OFF'}
                </span>
              </button>

              <div className="h-[1px] bg-card-border my-1" />

              {/* External CLI Agents Launchers */}
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Agentes CLI Externos
              </div>

              <button
                onClick={() => handleLaunchCli('claude')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-brand-amber" />
                  <span>Claude Code</span>
                </div>
                <code className="text-[10px] text-accent-light font-mono">claude</code>
              </button>

              <button
                onClick={() => handleLaunchCli('gemini')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Gemini CLI</span>
                </div>
                <code className="text-[10px] text-brand-cyan font-mono">gemini</code>
              </button>

              <button
                onClick={() => handleLaunchCli('agy')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-brand-emerald" />
                  <span>Antigravity CLI</span>
                </div>
                <code className="text-[10px] text-brand-emerald font-mono">agy</code>
              </button>

              <button
                onClick={() => handleLaunchCli('aider')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-brand-purple" />
                  <span>Aider / Codex</span>
                </div>
                <code className="text-[10px] text-brand-purple font-mono">aider</code>
              </button>

              <div className="h-[1px] bg-card-border my-1" />

              <button
                onClick={() => handleLaunchCli('powershell')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-300 flex items-center justify-between"
              >
                <span>Terminal PowerShell</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
