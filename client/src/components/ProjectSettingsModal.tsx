import React, { useState, useEffect } from 'react';
import { 
  X, 
  Shield, 
  Lock, 
  Zap, 
  Globe, 
  FileText, 
  Terminal, 
  Wifi, 
  Box, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Check, 
  AlertTriangle,
  Settings
} from 'lucide-react';
import { 
  ProjectSettings, 
  ExecutionSecurityPreset, 
  PlanReviewPolicy, 
  DEFAULT_PROJECT_SETTINGS 
} from '../types';
import { api } from '../api';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath?: string;
  projectName?: string;
  onSettingsSaved?: (newSettings: ProjectSettings) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  projectPath,
  projectName = 'Projeto Atual',
  onSettingsSaved
}) => {
  const [settings, setSettings] = useState<ProjectSettings>({ ...DEFAULT_PROJECT_SETTINGS });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [newDeniedPath, setNewDeniedPath] = useState<string>('');
  const [newDeniedCmd, setNewDeniedCmd] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setSaveSuccess(false);

    api.getProjectSettings(projectPath)
      .then((data) => {
        if (isMounted) {
          setSettings(data);
        }
      })
      .catch((err) => {
        console.error('Falha ao carregar configurações do projeto:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectPath]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await api.saveProjectSettings(settings, projectPath);
      setSettings(saved);
      setSaveSuccess(true);
      onSettingsSaved?.(saved);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      alert('Erro ao salvar as configurações do projeto.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Tem certeza que deseja restaurar as configurações padrão de segurança deste projeto?')) {
      setSettings({ ...DEFAULT_PROJECT_SETTINGS });
    }
  };

  const handleAddDeniedPath = () => {
    const trimmed = newDeniedPath.trim();
    if (!trimmed) return;
    if (!settings.fileAccess.deniedPaths.includes(trimmed)) {
      setSettings({
        ...settings,
        fileAccess: {
          ...settings.fileAccess,
          deniedPaths: [...settings.fileAccess.deniedPaths, trimmed]
        }
      });
    }
    setNewDeniedPath('');
  };

  const handleRemoveDeniedPath = (index: number) => {
    setSettings({
      ...settings,
      fileAccess: {
        ...settings.fileAccess,
        deniedPaths: settings.fileAccess.deniedPaths.filter((_, i) => i !== index)
      }
    });
  };

  const handleAddDeniedCmd = () => {
    const trimmed = newDeniedCmd.trim();
    if (!trimmed) return;
    if (!settings.terminal.deniedCommands.includes(trimmed)) {
      setSettings({
        ...settings,
        terminal: {
          ...settings.terminal,
          deniedCommands: [...settings.terminal.deniedCommands, trimmed]
        }
      });
    }
    setNewDeniedCmd('');
  };

  const handleRemoveDeniedCmd = (index: number) => {
    setSettings({
      ...settings,
      terminal: {
        ...settings.terminal,
        deniedCommands: settings.terminal.deniedCommands.filter((_, i) => i !== index)
      }
    });
  };

  const securityPresets: Array<{
    id: ExecutionSecurityPreset;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    colorClass: string;
  }> = [
    {
      id: 'turbo',
      title: 'Turbo Mode',
      subtitle: 'Run all commands without restrictions.',
      icon: <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />,
      colorClass: 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    },
    {
      id: 'default',
      title: 'Default',
      subtitle: 'Ask before sensitive operations.',
      icon: <Lock className="w-4 h-4 text-emerald-400" />,
      colorClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    },
    {
      id: 'request_review',
      title: 'Request Review',
      subtitle: 'Every command requires approval.',
      icon: <Shield className="w-4 h-4 text-sky-400" />,
      colorClass: 'border-sky-500/40 bg-sky-500/10 text-sky-300'
    },
    {
      id: 'inherit',
      title: 'Use Global Settings',
      subtitle: 'Inherit the system-wide security setting.',
      icon: <Globe className="w-4 h-4 text-indigo-400" />,
      colorClass: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between bg-sidebar/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-accent/20 border border-accent/40 text-accent-light">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>Project Settings</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-panel border border-card-border text-slate-400 font-mono font-normal">
                  {projectName}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Local configuration for this workspace. Stored in .agentic/project_settings.json
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Carregando configurações do projeto...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-card-border">
            {/* 1. AGENT SETTINGS */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Shield className="w-4 h-4 text-accent-light" />
                <span>Agent Settings</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Security Preset
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {securityPresets.map((preset) => {
                    const isSelected = settings.securityPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSettings({ ...settings, securityPreset: preset.id })}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 cursor-pointer ${
                          isSelected
                            ? `${preset.colorClass} shadow-xs`
                            : 'bg-panel/60 border-card-border hover:bg-panel text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0">{preset.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{preset.title}</span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-accent-light shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                            {preset.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. AGENT BEHAVIOR */}
            <div className="space-y-3 pt-3 border-t border-card-border/60">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Agent Behavior</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Plan Review Policy
                </label>
                <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                  Whether the agent asks you to review its documents. Type <code className="text-accent-light bg-sidebar px-1 py-0.5 rounded font-mono">/</code> and select <code className="text-accent-light bg-sidebar px-1 py-0.5 rounded font-mono">plan</code> to have the agent generate a plan.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, planReviewPolicy: 'always_proceed' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.planReviewPolicy === 'always_proceed'
                        ? 'bg-accent/20 border-accent text-white shadow-xs'
                        : 'bg-panel/60 border-card-border hover:bg-panel text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Always Proceed</span>
                      {settings.planReviewPolicy === 'always_proceed' && (
                        <Check className="w-3.5 h-3.5 text-accent-light" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Agent creates the plan and immediately proceeds with implementation without asking.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, planReviewPolicy: 'always_review' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.planReviewPolicy === 'always_review'
                        ? 'bg-accent/20 border-accent text-white shadow-xs'
                        : 'bg-panel/60 border-card-border hover:bg-panel text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Always Review</span>
                      {settings.planReviewPolicy === 'always_review' && (
                        <Check className="w-3.5 h-3.5 text-accent-light" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Agent halts after creating the plan, presenting it in the chat for your approval.
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. LOCAL PERMISSIONS */}
            <div className="space-y-4 pt-3 border-t border-card-border/60">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Local Permissions</span>
              </div>

              {/* File Access Rules */}
              <div className="bg-sidebar/40 p-3.5 rounded-xl border border-card-border/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">File Access Rules</h4>
                    <p className="text-[11px] text-slate-400">Controle a capacidade do agente ler e gravar arquivos neste workspace.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.fileAccess.readAllowed}
                      onChange={(e) => setSettings({
                        ...settings,
                        fileAccess: { ...settings.fileAccess, readAllowed: e.target.checked }
                      })}
                      className="rounded border-card-border text-accent focus:ring-accent"
                    />
                    <span className="text-slate-300">Allow File Reads</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.fileAccess.writeAllowed}
                      onChange={(e) => setSettings({
                        ...settings,
                        fileAccess: { ...settings.fileAccess, writeAllowed: e.target.checked }
                      })}
                      className="rounded border-card-border text-accent focus:ring-accent"
                    />
                    <span className="text-slate-300">Allow File Writes & Edits</span>
                  </label>
                </div>

                {/* Denied Paths */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                    Denied Paths & Patterns (arquivos ou pastas estritamente bloqueados)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {settings.fileAccess.deniedPaths.map((p, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-panel border border-card-border text-[11px] text-slate-300 font-mono"
                      >
                        <span>{p}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDeniedPath(idx)}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newDeniedPath}
                      onChange={(e) => setNewDeniedPath(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDeniedPath())}
                      placeholder="Ex: .env, *.pem, secrets.json"
                      className="flex-1 bg-card border border-card-border rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleAddDeniedPath}
                      className="px-2.5 py-1 rounded-lg bg-card-border/60 hover:bg-card-border text-xs text-slate-300 flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Terminal & Commands */}
              <div className="bg-sidebar/40 p-3.5 rounded-xl border border-card-border/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-accent-light" />
                      <span>Terminal Commands</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Permissão para rodar comandos locais e lista negra de instruções perigosas.</p>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.terminal.allowed}
                      onChange={(e) => setSettings({
                        ...settings,
                        terminal: { ...settings.terminal, allowed: e.target.checked }
                      })}
                      className="rounded border-card-border text-accent focus:ring-accent"
                    />
                    <span className="text-xs text-slate-300 font-medium">Allow Terminal Execution</span>
                  </label>
                </div>

                {/* Denied Commands */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                    Denied Commands (comandos bloqueados antes da execução)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {settings.terminal.deniedCommands.map((cmd, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-red-950/40 border border-red-800/40 text-[11px] text-red-300 font-mono"
                      >
                        <span>{cmd}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDeniedCmd(idx)}
                          className="hover:text-red-200 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newDeniedCmd}
                      onChange={(e) => setNewDeniedCmd(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDeniedCmd())}
                      placeholder="Ex: rm -rf, drop database, format"
                      className="flex-1 bg-card border border-card-border rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleAddDeniedCmd}
                      className="px-2.5 py-1 rounded-lg bg-card-border/60 hover:bg-card-border text-xs text-slate-300 flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Network Access & Sandbox / MCP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Network */}
                <div className="bg-sidebar/40 p-3.5 rounded-xl border border-card-border/70 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <Wifi className="w-3.5 h-3.5 text-sky-400" />
                    <span>Network Access</span>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={settings.network.allowed}
                      onChange={(e) => setSettings({
                        ...settings,
                        network: { ...settings.network, allowed: e.target.checked }
                      })}
                      className="rounded border-card-border text-accent focus:ring-accent"
                    />
                    <span className="text-slate-300">Allow Web Scraping & Requests</span>
                  </label>
                </div>

                {/* Sandbox & MCP */}
                <div className="bg-sidebar/40 p-3.5 rounded-xl border border-card-border/70 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <Box className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Sandbox & MCP Tools</span>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={settings.sandboxAndMcp.allowOutsideSandbox}
                      onChange={(e) => setSettings({
                        ...settings,
                        sandboxAndMcp: { ...settings.sandboxAndMcp, allowOutsideSandbox: e.target.checked }
                      })}
                      className="rounded border-card-border text-accent focus:ring-accent"
                    />
                    <span className="text-slate-300">Allow Outside Sandbox</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={settings.sandboxAndMcp.enableMcp}
                      onChange={(e) => setSettings({
                        ...settings,
                        sandboxAndMcp: { ...settings.sandboxAndMcp, enableMcp: e.target.checked }
                      })}
                      className="rounded border-card-border text-accent focus:ring-accent"
                    />
                    <span className="text-slate-300">Enable MCP Tools</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-card-border flex items-center justify-between bg-sidebar/50 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl hover:bg-card-border text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Restaurar todas as opções para os padrões recomendados"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrões</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl hover:bg-card-border text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-light text-white text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <span>Salvar Configurações</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
