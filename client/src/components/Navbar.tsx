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
  Moon,
  Radio,
  Globe,
  Check,
  Plus,
  Wrench,
  Shield,
  Cloud,
  HelpCircle
} from 'lucide-react';
import { AppConfig, ProjectOverview, Routine, OpenRouterCredits } from '../types';
import { api } from '../api';

export interface LanguageOption {
  locale: string;
  language: string;
  country: string;
  flag: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { locale: 'pt-BR', language: 'Português (Brasil)', country: 'Brasil', flag: '🇧🇷', label: 'Português (BR)' },
  { locale: 'en-US', language: 'English (US)', country: 'Estados Unidos', flag: '🇺🇸', label: 'English (US)' },
  { locale: 'es-ES', language: 'Español', country: 'Espanha', flag: '🇪🇸', label: 'Español' },
  { locale: 'pt-PT', language: 'Português (Portugal)', country: 'Portugal', flag: '🇵🇹', label: 'Português (PT)' },
  { locale: 'ja-JP', language: '日本語', country: 'Japão', flag: '🇯🇵', label: '日本語' },
  { locale: 'de-DE', language: 'Deutsch', country: 'Alemanha', flag: '🇩🇪', label: 'Deutsch' },
  { locale: 'fr-FR', language: 'Français', country: 'França', flag: '🇫🇷', label: 'Français' },
];

interface NavbarProps {
  config: AppConfig | null;
  currentProject: ProjectOverview | null;
  activeModel: string;
  activeRoutine: Routine | null;
  mainViewMode: 'agent' | 'notes' | 'skills';
  isRightPanelOpen: boolean;
  rightPanelTab: 'code' | 'history' | 'memory' | 'terminal';
  isOverlayActive: boolean;
  tokenEfficiency: boolean;
  hasCustomPipeline?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenLiveVoice?: () => void;
  onSetMainViewMode: (mode: 'agent' | 'notes' | 'skills') => void;
  onToggleRightPanel: () => void;
  onToggleOverlay: () => void;
  onToggleTokenEfficiency: () => void;
  onOpenPipelineModal: () => void;
  onSetRightPanelTab: (tab: 'code' | 'history' | 'memory' | 'terminal') => void;
  onOpenModelModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenProjectModal: () => void;
  onSelectRoutine: (routine: Routine) => void;
  onSelectLanguage?: (lang: LanguageOption) => void;
  onNewChat?: () => void;
  onOpenSelfHealing?: () => void;
  onOpenPatchNotes?: () => void;
  onOpenOnboarding?: () => void;
  onOpenProjectSettings?: () => void;
  onConfigUpdated?: (newConfig: AppConfig) => void;
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
  onOpenLiveVoice,
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
  onSelectLanguage,
  onNewChat,
  onOpenSelfHealing,
  onOpenPatchNotes,
  onOpenOnboarding,
  onOpenProjectSettings,
  onConfigUpdated,
}) => {
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isToolsBarExpanded, setIsToolsBarExpanded] = useState(false);
  const [credits, setCredits] = useState<OpenRouterCredits | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const handleQuickUpdateAndRestart = async () => {
    if (isUpdatingApp) return;
    setIsUpdatingApp(true);
    try {
      await api.updateAndRestartApp();
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      alert(`Erro ao atualizar e reiniciar: ${err.message}`);
      setIsUpdatingApp(false);
    }
  };

  const handleQuickCloudSync = async () => {
    if (isSyncingCloud) return;
    setIsSyncingCloud(true);
    try {
      const res = await api.syncNow();
      if (config && res.syncConfig && onConfigUpdated) {
        onConfigUpdated({ ...config, syncConfig: res.syncConfig });
      }
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
    } catch (err: any) {
      alert(`Falha ao sincronizar nuvem: ${err.message}`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleSwitchAccountOrLocal = async (target: string) => {
    if (isSwitchingAccount) return;
    setIsSwitchingAccount(true);
    try {
      const res = await api.switchAccount(target);
      if (config && res.syncConfig && onConfigUpdated) {
        onConfigUpdated({ ...config, syncConfig: res.syncConfig });
      }
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
      setIsAccountDropdownOpen(false);
    } catch (err: any) {
      const pass = window.prompt(
        `Informe a Chave/Senha Mestra do Cofre para desbloquear as notas da conta "${target}":`
      );
      if (pass && pass.trim()) {
        try {
          const retry = await api.switchAccount(target, pass.trim());
          if (config && retry.syncConfig && onConfigUpdated) {
            onConfigUpdated({ ...config, syncConfig: retry.syncConfig });
          }
          window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
          setIsAccountDropdownOpen(false);
        } catch (retryErr: any) {
          alert(retryErr.message || 'Chave Mestra incorreta.');
        }
      }
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  const handleSetVaultScope = async (scope: 'all_accessible' | 'account_only' | 'local_only') => {
    try {
      const res = await api.setVaultViewScope(scope);
      if (config && res.syncConfig && onConfigUpdated) {
        onConfigUpdated({ ...config, syncConfig: res.syncConfig });
      }
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentLocale = config?.locale || 'pt-BR';
  const currentLangObj = LANGUAGE_OPTIONS.find(l => l.locale === currentLocale) || LANGUAGE_OPTIONS[0];

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
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    if (isMenuDropdownOpen || isLanguageDropdownOpen || isAccountDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuDropdownOpen, isLanguageDropdownOpen, isAccountDropdownOpen]);

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
    <div className="relative z-20 select-none shrink-0">
      <header className="h-12 border-b border-card-border/70 bg-sidebar/95 backdrop-blur-md px-4 flex items-center justify-between gap-3">
        {/* 1. Left Section: Brand + Notion/Goodnotes Clean View Switcher + Subtle Project Pill */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Tellus Brand */}
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-card-border/70 shadow-xs bg-white p-0.5 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Tellus Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-sm text-slate-100 hidden sm:inline tracking-tight">
              Tellus
            </span>
            <button
              onClick={onOpenPatchNotes}
              className="px-1.5 py-0.5 rounded-full bg-accent/15 hover:bg-accent/25 border border-accent/30 hover:border-accent/50 text-[10px] font-mono font-bold text-accent-light flex items-center space-x-1 transition-all cursor-pointer shadow-xs group"
              title="Ver Patch Notes & Capacidades da Versão 1.0.0"
            >
              <span>v1.0.0</span>
              <Sparkles className="w-2.5 h-2.5 group-hover:rotate-12 transition-transform text-accent-light" />
            </button>

            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                className="px-2 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/50 text-[10px] font-semibold text-emerald-300 flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
                title="Guia de Primeiro Uso (Como obter API Keys, OpenRouter, Fish Audio, Vault e Setup)"
              >
                <HelpCircle className="w-2.5 h-2.5 text-emerald-400" />
                <span className="hidden sm:inline">Guia de Início</span>
              </button>
            )}
          </div>

          <div className="h-4 w-[1px] bg-card-border/70 hidden sm:block" />

          {/* View Mode Segmented Controls — 60-30-10 Calm Surface */}
          <div className="flex items-center bg-card/70 rounded-lg p-0.5 border border-card-border/60 text-xs">
            <button
              onClick={() => onSetMainViewMode('agent')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                mainViewMode === 'agent'
                  ? 'bg-accent text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Agente</span>
            </button>

            <button
              onClick={() => onSetMainViewMode('notes')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                mainViewMode === 'notes'
                  ? 'bg-accent text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tellus Notes & Vault (Cadernos, Markdown e Folha Ink)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Notas</span>
            </button>

            <button
              onClick={() => onSetMainViewMode('skills')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                mainViewMode === 'skills'
                  ? 'bg-accent text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Skills dos Agentes e Artefatos do Projeto"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Skills</span>
            </button>
          </div>

          {/* Subtle Project Selector */}
          <button
            onClick={onOpenProjectModal}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg hover:bg-card/80 border border-transparent hover:border-card-border/70 text-xs text-slate-400 hover:text-slate-200 transition-all max-w-[160px] cursor-pointer"
            title={currentProject ? `Projeto ativo: ${currentProject.path}` : 'Selecionar Projeto...'}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-medium truncate text-[11px]">
              {currentProject ? currentProject.name : 'Projeto...'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
          </button>
        </div>

        {/* 2. Center Section: Calm Model Pill & Goodnotes-Style Expandable Tools Trigger */}
        <div className="flex items-center space-x-1.5">
          {/* Active Model Pill */}
          <button
            onClick={onOpenModelModal}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-card/70 hover:bg-card border border-card-border/60 text-xs text-slate-300 hover:text-white transition-all group cursor-pointer"
            title="Trocar modelo de IA principal"
          >
            <Cpu className="w-3.5 h-3.5 text-slate-400 group-hover:text-accent-light transition-colors" />
            <span className="font-mono text-[11px] font-medium text-slate-200 max-w-[140px] truncate">
              {activeModel.split('/').pop()}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {/* Primary Action: New Chat (only when in Agent mode, calm ghost/subtle pill) */}
          {onNewChat && mainViewMode === 'agent' && (
            <button
              onClick={onNewChat}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-card/70 hover:bg-card border border-card-border/60 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
              title="Iniciar um novo chat limpo"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline text-[11px]">Novo Chat</span>
            </button>
          )}

          {/* Goodnotes-Style Click-to-Expand Tools Toggle Pill */}
          <button
            onClick={() => setIsToolsBarExpanded(!isToolsBarExpanded)}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer ${
              isToolsBarExpanded
                ? 'bg-accent text-white border-accent shadow-sm'
                : 'bg-card/70 hover:bg-card border-card-border/70 text-slate-300 hover:text-white'
            }`}
            title="Clique para expandir ou recolher a barra de ferramentas rápidas (Voz, Pipeline, Token Efficiency, Painéis IDE, Auto-Manutenção, Atualizar)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[11px]">Ferramentas</span>
            {(hasCustomPipeline || tokenEfficiency) && !isToolsBarExpanded && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
            )}
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isToolsBarExpanded ? 'rotate-180' : ' opacity-60'}`} />
          </button>
        </div>

        {/* 3. Right Section: Cloud Account, Right Panel Toggle & More Menu */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Multi-Account & Local-Only Mode Switcher Dropdown */}
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
                config?.syncConfig?.googleAccount
                  ? 'bg-card/80 border-card-border/80 text-slate-200 hover:border-accent/50'
                  : 'bg-card/60 hover:bg-card border-card-border/60 text-slate-400 hover:text-slate-200'
              }`}
              title={
                config?.syncConfig?.googleAccount
                  ? `Conta Ativa: ${config.syncConfig.googleAccount.email}`
                  : 'Modo Local (Sem Conta) — Clique para gerenciar nuvem ou contas'
              }
            >
              <Cloud className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-bounce text-brand-cyan' : config?.syncConfig?.googleAccount ? 'text-accent-light' : 'text-slate-400'}`} />
              <span className="hidden xl:inline text-[11px] font-medium max-w-[110px] truncate">
                {isSyncingCloud
                  ? 'Sync...'
                  : config?.syncConfig?.googleAccount
                  ? config.syncConfig.googleAccount.email.split('@')[0]
                  : 'Local'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {isAccountDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-card border border-card-border rounded-2xl shadow-2xl p-3 space-y-2.5 z-50 text-xs animate-in fade-in">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-card-border pb-2">
                  <div className="flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-[12px]">Contas Cloud & Cofre Local</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    config?.syncConfig?.googleAccount
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {config?.syncConfig?.googleAccount ? '🔒 2FA E2EE' : '💻 Só Local'}
                  </span>
                </div>

                {/* Active Account or Local-Only Status */}
                {config?.syncConfig?.googleAccount ? (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{config.syncConfig.googleAccount.name}</div>
                        <div className="text-[11px] text-indigo-300 font-mono truncate">{config.syncConfig.googleAccount.email}</div>
                      </div>
                      <button
                        onClick={handleQuickCloudSync}
                        disabled={isSyncingCloud}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                        <span>{isSyncingCloud ? 'Sync...' : 'Sync Agora'}</span>
                      </button>
                    </div>

                    {/* Filter Scope for Notes */}
                    <div className="pt-1 border-t border-indigo-500/20">
                      <div className="text-[10px] text-slate-400 mb-1 font-semibold">Exibir no Cofre de Notas:</div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => handleSetVaultScope('all_accessible')}
                          className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                            (config.syncConfig.vaultViewScope || 'all_accessible') === 'all_accessible'
                              ? 'bg-indigo-500 text-white font-bold'
                              : 'bg-panel text-slate-400 hover:text-white'
                          }`}
                        >
                          Todas Acessíveis
                        </button>
                        <button
                          onClick={() => handleSetVaultScope('account_only')}
                          className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                            config.syncConfig.vaultViewScope === 'account_only'
                              ? 'bg-indigo-500 text-white font-bold'
                              : 'bg-panel text-slate-400 hover:text-white'
                          }`}
                        >
                          Só desta Conta
                        </button>
                        <button
                          onClick={() => handleSetVaultScope('local_only')}
                          className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                            config.syncConfig.vaultViewScope === 'local_only'
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-panel text-slate-400 hover:text-white'
                          }`}
                        >
                          Só Locais do PC
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-800/70 border border-card-border text-slate-300 text-[11px] leading-relaxed">
                    <strong>💻 Modo Somente Arquivos Locais:</strong><br />
                    Usando o Tellus sem conta conectada. Apenas as notas locais deste PC estão visíveis.
                  </div>
                )}

                {/* Saved Accounts List */}
                {Array.isArray(config?.syncConfig?.savedAccounts) && config!.syncConfig!.savedAccounts!.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Alternar entre Contas ({config!.syncConfig!.savedAccounts!.length})
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                      {config!.syncConfig!.savedAccounts!.map((acc) => {
                        const isCurrent =
                          config?.syncConfig?.googleAccount?.email?.toLowerCase() === acc.email.toLowerCase();
                        return (
                          <button
                            key={acc.email}
                            onClick={() => !isCurrent && handleSwitchAccountOrLocal(acc.email)}
                            disabled={isSwitchingAccount}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-indigo-500/20 border border-indigo-500/40 text-white'
                                : 'bg-panel hover:bg-card-border/70 border border-card-border/60 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-[11px] truncate">{acc.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">{acc.email}</div>
                            </div>
                            {isCurrent ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono shrink-0">
                                Ativa
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white font-semibold shrink-0">
                                Trocar
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-1 border-t border-card-border space-y-1.5">
                  {config?.syncConfig?.googleAccount && (
                    <button
                      onClick={() => handleSwitchAccountOrLocal('local_only')}
                      disabled={isSwitchingAccount}
                      className="w-full px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>💻 Sair e Usar Somente Arquivos Locais</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsAccountDropdownOpen(false);
                      onOpenSettingsModal();
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-panel hover:bg-card-border border border-card-border text-slate-200 hover:text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-brand-cyan" />
                    <span>Gerenciar Cloud, 2FA & Armazenamento</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel Quick Toggle (Agent Mode) */}
          {mainViewMode === 'agent' && (
            <button
              onClick={onToggleRightPanel}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isRightPanelOpen
                  ? 'bg-card border-card-border text-slate-200'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-card/60'
              }`}
              title={isRightPanelOpen ? 'Recolher Painel IDE Lateral' : 'Abrir Painel IDE Lateral (Código, Histórico, Memória, Terminal)'}
            >
              {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          )}

          {/* Language Dropdown Popover Anchor */}
          <div className="relative" ref={languageRef}>
            {isLanguageDropdownOpen && (
              <div className="absolute right-0 mt-6 w-52 bg-card border border-card-border rounded-xl shadow-2xl p-1.5 space-y-1 z-50 text-xs animate-in fade-in">
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-card-border/60 pb-1.5 mb-1">
                  <div className="flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-accent-light" />
                    <span>Idioma & Região</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 font-normal">
                    {currentLangObj.locale}
                  </span>
                </div>

                {LANGUAGE_OPTIONS.map((opt) => {
                  const isSelected = (config?.locale || 'pt-BR') === opt.locale;
                  return (
                    <button
                      key={opt.locale}
                      onClick={() => {
                        setIsLanguageDropdownOpen(false);
                        onSelectLanguage?.(opt);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-accent/20 text-white font-medium border border-accent/30'
                          : 'hover:bg-panel text-slate-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{opt.flag}</span>
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-light" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Consolidated Settings & CLI Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isMenuDropdownOpen
                  ? 'bg-card border-card-border text-white'
                  : 'border-transparent hover:bg-card/70 text-slate-400 hover:text-slate-200'
              }`}
              title="Configurações, Tema, Chaves de API e Agentes CLI"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-card border border-card-border rounded-xl shadow-2xl p-1.5 space-y-1 z-50 text-xs animate-in fade-in">
                {/* Language Shortcut */}
                <button
                  onClick={() => {
                    setIsMenuDropdownOpen(false);
                    setIsLanguageDropdownOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Idioma: {currentLangObj.label}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-panel border border-card-border text-slate-300 font-mono">
                    {currentLangObj.flag}
                  </span>
                </button>

                {/* API Keys Configuration */}
                <button
                  onClick={() => {
                    setIsMenuDropdownOpen(false);
                    onOpenSettingsModal();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span>Configurações & Chaves API</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-panel border border-card-border text-slate-400 font-mono">
                    {configuredKeysCount}/4
                  </span>
                </button>

                {/* Onboarding & Setup Guide */}
                {onOpenOnboarding && (
                  <button
                    onClick={() => {
                      setIsMenuDropdownOpen(false);
                      onOpenOnboarding();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Guia de Início & Chaves</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                      Setup
                    </span>
                  </button>
                )}

                {/* Project Settings */}
                {onOpenProjectSettings && (
                  <button
                    onClick={() => {
                      setIsMenuDropdownOpen(false);
                      onOpenProjectSettings();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      <span>Permissões do Projeto</span>
                    </div>
                  </button>
                )}

                {/* Theme Toggle */}
                {onToggleTheme && (
                  <button
                    onClick={() => {
                      setIsMenuDropdownOpen(false);
                      onToggleTheme();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      {theme === 'light' ? (
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>Tema: {theme === 'light' ? 'Claro' : 'Escuro'}</span>
                    </div>
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
                    <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                    <span>Widget Sobreposto</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isOverlayActive ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-slate-500'
                  }`}>
                    {isOverlayActive ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Quick Update & Restart */}
                <button
                  onClick={() => {
                    setIsMenuDropdownOpen(false);
                    handleQuickUpdateAndRestart();
                  }}
                  disabled={isUpdatingApp}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                    <span>Atualizar e Reiniciar Tellus</span>
                  </div>
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
                    <Terminal className="w-3.5 h-3.5 text-slate-400" />
                    <span>Claude Code</span>
                  </div>
                  <code className="text-[10px] text-slate-400 font-mono">claude</code>
                </button>

                <button
                  onClick={() => handleLaunchCli('gemini')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-400" />
                    <span>Gemini CLI</span>
                  </div>
                  <code className="text-[10px] text-slate-400 font-mono">gemini</code>
                </button>

                <button
                  onClick={() => handleLaunchCli('agy')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-400" />
                    <span>Antigravity CLI</span>
                  </div>
                  <code className="text-[10px] text-slate-400 font-mono">agy</code>
                </button>

                <button
                  onClick={() => handleLaunchCli('aider')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-panel text-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-400" />
                    <span>Aider / Codex</span>
                  </div>
                  <code className="text-[10px] text-slate-400 font-mono">aider</code>
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

      {/* Goodnotes-Style Expandable Quick Tools Strip (Progressive Disclosure on Click) */}
      {isToolsBarExpanded && (
        <div className="h-10 bg-card/95 backdrop-blur-md border-b border-card-border/80 px-4 flex items-center justify-center gap-2 overflow-x-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Group 1: AI & Voice Tools */}
          <div className="flex items-center gap-1">
            {onOpenLiveVoice && (
              <button
                onClick={onOpenLiveVoice}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full hover:bg-panel text-slate-300 hover:text-white text-xs transition-all cursor-pointer"
                title="Abrir Live Voice Chat em tempo real"
              >
                <Radio className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[11px] font-medium">Live Voice</span>
              </button>
            )}

            <button
              onClick={onOpenPipelineModal}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                hasCustomPipeline
                  ? 'bg-accent/20 text-accent-light font-medium'
                  : 'hover:bg-panel text-slate-300 hover:text-white'
              }`}
              title="Orquestrar Mind Map / Pipeline multi-modelo de especialistas"
            >
              <Network className="w-3.5 h-3.5" />
              <span className="text-[11px]">Pipeline Multi-IA</span>
            </button>

            <button
              onClick={onToggleTokenEfficiency}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                tokenEfficiency
                  ? 'bg-amber-500/20 text-amber-300 font-medium'
                  : 'hover:bg-panel text-slate-300 hover:text-white'
              }`}
              title={`Modo Token Efficiency: ${tokenEfficiency ? 'ATIVADO' : 'DESATIVADO'}`}
            >
              <Zap className={`w-3.5 h-3.5 ${tokenEfficiency ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
              <span className="text-[11px]">Token Efficiency</span>
            </button>

            {onOpenSelfHealing && (
              <button
                onClick={onOpenSelfHealing}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full hover:bg-panel text-slate-300 hover:text-white text-xs transition-all cursor-pointer"
                title="Auto-Manutenção: diagnosticar e corrigir problemas"
              >
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">Auto-Manutenção</span>
              </button>
            )}
          </div>

          {/* Group 2: IDE Side Panel Tabs (when in Agent Mode) */}
          {mainViewMode === 'agent' && (
            <>
              <div className="h-4 w-[1px] bg-card-border/80 mx-1 shrink-0" />
              <div className="flex items-center gap-1 bg-panel/70 rounded-full p-0.5 border border-card-border/60">
                {(['code', 'history', 'memory', 'terminal'] as const).map((tab) => {
                  const labels: Record<typeof tab, string> = {
                    code: 'Código',
                    history: 'Histórico',
                    memory: 'Memória',
                    terminal: 'Terminal',
                  };
                  const active = isRightPanelOpen && rightPanelTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        onSetRightPanelTab(tab);
                        if (!isRightPanelOpen) onToggleRightPanel();
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] transition-all cursor-pointer ${
                        active
                          ? 'bg-accent text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="h-4 w-[1px] bg-card-border/80 mx-1 shrink-0" />

          {/* Group 3: System Status, OpenRouter Balance, Update & Language */}
          <div className="flex items-center gap-1.5 shrink-0">
            {config?.keys.openrouter && (
              <button
                onClick={fetchCredits}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full hover:bg-panel text-xs text-slate-300 hover:text-white transition-all font-mono cursor-pointer"
                title="Saldo da OpenRouter (clique para atualizar)"
              >
                <Coins className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px]">
                  {credits !== null ? `$${credits.remainingCredits.toFixed(2)}` : '...'}
                </span>
                <RefreshCw className={`w-2.5 h-2.5 text-slate-400 ml-0.5 ${isLoadingCredits ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={handleQuickUpdateAndRestart}
              disabled={isUpdatingApp}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full hover:bg-panel text-slate-300 hover:text-white text-xs transition-all cursor-pointer"
              title="Atualizar e Reiniciar o Tellus"
            >
              <RefreshCw className={`w-3 h-3 text-emerald-400 ${isUpdatingApp ? 'animate-spin' : ''}`} />
              <span className="text-[11px]">{isUpdatingApp ? 'Atualizando...' : 'Atualizar'}</span>
            </button>

            <button
              onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
              className="flex items-center space-x-1 px-2 py-1 rounded-full hover:bg-panel text-slate-300 hover:text-white text-xs transition-all cursor-pointer"
              title={`Idioma: ${currentLangObj.label}`}
            >
              <span className="text-xs leading-none">{currentLangObj.flag}</span>
              <span className="font-mono text-[10px]">{currentLangObj.locale}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
