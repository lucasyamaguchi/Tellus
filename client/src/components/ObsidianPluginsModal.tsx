import React, { useState, useEffect } from 'react';
import { 
  Puzzle, 
  X, 
  Check, 
  Download, 
  RefreshCw, 
  FolderPlus, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Database,
  GitBranch,
  PenTool,
  Trello,
  Table,
  Sliders,
  CheckCircle,
  FileCode
} from 'lucide-react';
import { api } from '../api';
import { ObsidianPluginInfo, RecommendedObsidianPlugin } from '../types';

interface ObsidianPluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customVaultDir?: string;
}

export const ObsidianPluginsModal: React.FC<ObsidianPluginsModalProps> = ({
  isOpen,
  onClose,
  customVaultDir
}) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'recommendations'>('installed');
  const [plugins, setPlugins] = useState<ObsidianPluginInfo[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedObsidianPlugin[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [installingRepo, setInstallingRepo] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import folder prompt
  const [isImportingLocal, setIsImportingLocal] = useState<boolean>(false);
  const [localDirInput, setLocalDirInput] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const [installed, recs] = await Promise.all([
        api.getObsidianPlugins(customVaultDir),
        api.getObsidianRecommendations(customVaultDir)
      ]);
      setPlugins(installed);
      setRecommendations(recs);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Falha ao carregar plugins' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, customVaultDir]);

  if (!isOpen) return null;

  const handleToggle = async (pluginId: string, currentEnabled: boolean) => {
    setTogglingId(pluginId);
    setStatusMessage(null);
    try {
      await api.toggleObsidianPlugin(pluginId, !currentEnabled, customVaultDir);
      setPlugins(prev => prev.map(p => p.id === pluginId ? { ...p, enabled: !currentEnabled } : p));
      setStatusMessage({ 
        type: 'success', 
        text: `Plugin "${pluginId}" foi ${!currentEnabled ? 'ativado' : 'desativado'} com sucesso.` 
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao alterar estado do plugin' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleInstallFromGitHub = async (repo: string) => {
    setInstallingRepo(repo);
    setStatusMessage(null);
    try {
      const result = await api.installObsidianPluginFromGitHub(repo, customVaultDir);
      setStatusMessage({ 
        type: 'success', 
        text: `Plugin "${result.plugin.name || repo}" instalado com sucesso no Vault!` 
      });
      await loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao baixar e instalar plugin do GitHub' });
    } finally {
      setInstallingRepo(null);
    }
  };

  const handleImportLocal = async () => {
    if (!localDirInput.trim()) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const result = await api.importObsidianPlugin(localDirInput.trim(), customVaultDir);
      setStatusMessage({ 
        type: 'success', 
        text: `Plugin "${result.plugin.name}" importado com sucesso da pasta local!` 
      });
      setLocalDirInput('');
      setIsImportingLocal(false);
      await loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao importar plugin da pasta local' });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'queries': return <Database className="w-4 h-4 text-sky-400" />;
      case 'git': return <GitBranch className="w-4 h-4 text-emerald-400" />;
      case 'diagrams': return <PenTool className="w-4 h-4 text-amber-400" />;
      case 'organization': return <Trello className="w-4 h-4 text-purple-400" />;
      case 'tables': return <Table className="w-4 h-4 text-cyan-400" />;
      default: return <Sliders className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in select-none">
      <div className="bg-[#0b0e14] border border-card-border/90 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-card-border/80 bg-card/50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent/20 to-purple-600/20 border border-accent/40 flex items-center justify-center text-accent-light shrink-0 shadow-md">
              <Puzzle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-100">Plugins Comunitários do Obsidian</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 border border-accent/35 text-accent-light font-semibold">
                  TellusMD Vault
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Total compatibilidade com plugins do Obsidian (.obsidian/plugins): instale direto do GitHub ou importe de pastas locais.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-card-border text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector & Actions */}
        <div className="px-5 pt-3 pb-2 border-b border-card-border/60 bg-card/30 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTab === 'installed'
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'bg-panel hover:bg-card-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Puzzle className="w-3.5 h-3.5" />
              <span>Instalados no Vault ({plugins.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTab === 'recommendations'
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'bg-panel hover:bg-card-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Recomendações Curadas ({recommendations.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsImportingLocal(!isImportingLocal)}
              className="px-2.5 py-1.5 rounded-xl bg-panel hover:bg-card-border border border-card-border text-[11px] font-semibold text-slate-300 hover:text-white flex items-center space-x-1 transition-all cursor-pointer"
              title="Importar plugin de pasta no disco"
            >
              <FolderPlus className="w-3.5 h-3.5 text-accent-light" />
              <span>Importar Pasta Local</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-xl bg-panel hover:bg-card-border border border-card-border text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Recarregar plugins"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Local Folder Import Strip */}
        {isImportingLocal && (
          <div className="p-3 bg-panel/80 border-b border-card-border/80 flex items-center gap-2 animate-in slide-in-from-top-2">
            <input
              type="text"
              value={localDirInput}
              onChange={(e) => setLocalDirInput(e.target.value)}
              placeholder="Caminho absoluto da pasta do plugin (contendo manifest.json e main.js)..."
              className="flex-1 bg-card border border-card-border focus:border-accent rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
            />
            <button
              onClick={handleImportLocal}
              disabled={!localDirInput.trim() || loading}
              className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Importar</span>
            </button>
            <button
              onClick={() => setIsImportingLocal(false)}
              className="p-1.5 rounded-xl hover:bg-card-border text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Status Toast */}
        {statusMessage && (
          <div className={`p-3 text-xs flex items-center space-x-2 border-b animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin scrollbar-thumb-card-border select-text">
          
          {/* TAB 1: INSTALLED PLUGINS */}
          {activeTab === 'installed' && (
            <div className="space-y-3">
              {plugins.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-card-border/80 rounded-2xl bg-panel/30">
                  <Puzzle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-300">Nenhum plugin instalado em .obsidian/plugins</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Você pode instalar plugins comunitários populares na aba "Recomendações Curadas" ou importar uma pasta local com seu plugin.
                  </p>
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className="mt-4 px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold inline-flex items-center space-x-1.5 shadow-md shadow-accent/25 hover:bg-accent-hover transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Explorar Recomendações</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {plugins.map((plugin) => (
                    <div 
                      key={plugin.id}
                      className="p-4 rounded-2xl bg-card border border-card-border/80 hover:border-accent/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-xs text-slate-100">{plugin.name}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel border border-card-border text-slate-400">
                            v{plugin.version}
                          </span>
                          {plugin.author && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              por {plugin.author}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
                          {plugin.description || 'Plugin comunitário do Obsidian.'}
                        </p>
                        <div className="flex items-center gap-1.5 pt-1 text-[10px] font-mono text-slate-500">
                          <span className={`px-1.5 py-0.5 rounded ${plugin.hasMainJs ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                            main.js
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${plugin.hasStylesCss ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-slate-800 text-slate-500'}`}>
                            styles.css
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${plugin.hasDataJson ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-500'}`}>
                            data.json
                          </span>
                        </div>
                      </div>

                      {/* Toggle Button */}
                      <div className="flex items-center space-x-3 shrink-0">
                        <button
                          type="button"
                          disabled={togglingId === plugin.id}
                          onClick={() => handleToggle(plugin.id, plugin.enabled)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                            plugin.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                              : 'bg-panel hover:bg-card-border text-slate-400 hover:text-white border border-card-border'
                          }`}
                        >
                          {togglingId === plugin.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : plugin.enabled ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Ativo no Vault</span>
                            </>
                          ) : (
                            <>
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Inativo</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CURATED RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <div className="space-y-3">
              <div className="p-3 bg-panel/50 border border-card-border/60 rounded-xl text-xs text-slate-400">
                Plugins selecionados por alta sinergia com o Tellus, grafos de conhecimento, estudos e produtividade de desenvolvimento. O download baixa os arquivos de release oficiais diretamente para <code className="text-accent-light font-mono text-[11px]">.obsidian/plugins/</code>.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl bg-card border border-card-border/80 hover:border-accent/40 transition-all flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          {getCategoryIcon(rec.category)}
                          <h4 className="font-bold text-xs text-slate-100">{rec.name}</h4>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-panel border border-card-border text-slate-400 uppercase">
                          {rec.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {rec.description}
                      </p>

                      <div className="p-2.5 rounded-xl bg-panel/60 border border-card-border/60 text-[10px] text-slate-400">
                        <span className="font-semibold text-accent-light block mb-0.5">Sinergia com Tellus:</span>
                        {rec.whyUsefulForTellus}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-card-border/40">
                      <a
                        href={`https://github.com/${rec.repo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-slate-500 hover:text-accent-light font-mono flex items-center space-x-1"
                      >
                        <span>github.com/{rec.repo}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <button
                        type="button"
                        disabled={rec.installed || installingRepo === rec.repo}
                        onClick={() => handleInstallFromGitHub(rec.repo)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                          rec.installed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                            : 'bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/25 disabled:opacity-40'
                        }`}
                      >
                        {installingRepo === rec.repo ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Instalando...</span>
                          </>
                        ) : rec.installed ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Já Instalado</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Instalar no Vault</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-card-border/80 bg-card/60 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            Vault: {customVaultDir || 'Tellus Vault Padrão'}/.obsidian/plugins
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-panel hover:bg-card-border border border-card-border text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
