import React, { useState } from 'react';
import { 
  X, 
  Cpu, 
  Sparkles, 
  Check, 
  Zap, 
  Brain, 
  Code2, 
  Terminal, 
  RotateCcw, 
  ChevronRight, 
  Network, 
  Layers, 
  Flame,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  ExternalLink,
  Key,
  Globe,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { AgentPipelineConfig, OpenRouterModel, AppConfig, ModelsResponse } from '../types';
import { api } from '../api';
import { ModelSelectorModal } from './ModelSelectorModal';

export interface ModelRoutingInfo {
  providerName: string;
  source: 'direct' | 'openrouter' | 'unconfigured';
  badgeText: string;
  badgeClass: string;
  isDirectKey: boolean;
}

export const getModelRoutingInfo = (modelId: string, config?: AppConfig | null): ModelRoutingInfo => {
  const cleanId = (modelId || '').toLowerCase().trim();

  // 1. Google / Gemini
  if (cleanId.startsWith('google/') || cleanId.startsWith('gemini')) {
    if (config?.keys?.google) {
      return {
        providerName: 'Google',
        source: 'direct',
        badgeText: 'Chave Direta Google',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        isDirectKey: true
      };
    }
  }

  // 2. Anthropic / Claude
  if (cleanId.startsWith('anthropic/') || cleanId.startsWith('claude')) {
    if (config?.keys?.anthropic) {
      return {
        providerName: 'Anthropic',
        source: 'direct',
        badgeText: 'Chave Direta Claude',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        isDirectKey: true
      };
    }
  }

  // 3. OpenAI / GPT
  if (cleanId.startsWith('openai/') || cleanId.startsWith('gpt-') || cleanId.startsWith('o1') || cleanId.startsWith('o3') || cleanId.startsWith('chatgpt')) {
    if (config?.keys?.openai) {
      return {
        providerName: 'OpenAI',
        source: 'direct',
        badgeText: 'Chave Direta OpenAI',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        isDirectKey: true
      };
    }
  }

  // 4. OpenRouter fallback
  if (config?.keys?.openrouter) {
    return {
      providerName: 'OpenRouter',
      source: 'openrouter',
      badgeText: 'Via OpenRouter API',
      badgeClass: 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30',
      isDirectKey: false
    };
  }

  return {
    providerName: 'Sem Chave',
    source: 'unconfigured',
    badgeText: 'Chave de API ausente',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    isDirectKey: false
  };
};

interface PipelineMindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryModel: string;
  allModels: OpenRouterModel[];
  curatedModels: OpenRouterModel[];
  currentPipeline?: AgentPipelineConfig;
  config?: AppConfig | null;
  onSavePipeline: (pipeline: AgentPipelineConfig) => void;
  onSelectPrimaryModel: (modelId: string) => void;
  onOpenSettings?: () => void;
  onModelsUpdated?: (models: ModelsResponse) => void;
}

export const PipelineMindMapModal: React.FC<PipelineMindMapModalProps> = ({
  isOpen,
  onClose,
  primaryModel,
  allModels,
  curatedModels,
  currentPipeline,
  config,
  onSavePipeline,
  onSelectPrimaryModel,
  onOpenSettings,
  onModelsUpdated
}) => {
  const [localAllModels, setLocalAllModels] = useState<OpenRouterModel[]>(allModels);
  const modelsPool = localAllModels.length > 0 ? localAllModels : (allModels.length > 0 ? allModels : curatedModels);

  React.useEffect(() => {
    if (allModels.length > 0) {
      setLocalAllModels(allModels);
    }
  }, [allModels]);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleRefreshCatalog = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await api.refreshModels();
      if (res && res.all && Array.isArray(res.all)) {
        setLocalAllModels(res.all);
        setRefreshMessage(`Catálogo atualizado com sucesso (${res.all.length} modelos sincronizados)`);
        if (onModelsUpdated) {
          onModelsUpdated(res);
        }
      } else {
        setRefreshMessage('Catálogo sincronizado.');
      }
    } catch (err: any) {
      setRefreshMessage(`Erro ao sincronizar catálogo: ${err?.message || 'Falha de conexão'}`);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 4500);
    }
  };

  const [pipelineState, setPipelineState] = useState<AgentPipelineConfig>({
    primaryModel: currentPipeline?.primaryModel || primaryModel,
    plannerModel: currentPipeline?.plannerModel || '',
    codingModel: currentPipeline?.codingModel || '',
    reasoningModel: currentPipeline?.reasoningModel || '',
    fastToolsModel: currentPipeline?.fastToolsModel || ''
  });

  // State to open ModelSelectorModal for a specific target node
  const [pickingTarget, setPickingTarget] = useState<'primary' | 'plannerModel' | 'codingModel' | 'reasoningModel' | 'fastToolsModel' | null>(null);
  const [inlineSearch, setInlineSearch] = useState<string>('');

  // Keep pipeline synchronized when primaryModel or currentPipeline updates
  React.useEffect(() => {
    if (isOpen) {
      setPipelineState({
        primaryModel: primaryModel || currentPipeline?.primaryModel || '',
        plannerModel: currentPipeline?.plannerModel || '',
        codingModel: currentPipeline?.codingModel || '',
        reasoningModel: currentPipeline?.reasoningModel || '',
        fastToolsModel: currentPipeline?.fastToolsModel || ''
      });
    }
  }, [isOpen, primaryModel, currentPipeline]);

  if (!isOpen) return null;

  const handlePrimaryChange = (newPrimary: string) => {
    const cleanPrimary = newPrimary.replace(/:batch$/i, '').trim();
    setPipelineState(prev => ({
      ...prev,
      primaryModel: cleanPrimary
    }));
    onSelectPrimaryModel(cleanPrimary);
  };

  const handleResetAllToPrimary = () => {
    setPipelineState({
      primaryModel: pipelineState.primaryModel,
      plannerModel: '',
      codingModel: '',
      reasoningModel: '',
      fastToolsModel: ''
    });
  };

  const handleSave = () => {
    onSavePipeline(pipelineState);
    onClose();
  };

  const handleModelSelectedFromPicker = (selectedModelId: string) => {
    const cleanId = selectedModelId.replace(/:batch$/i, '').trim();
    if (pickingTarget === 'primary') {
      handlePrimaryChange(cleanId);
    } else if (pickingTarget) {
      setPipelineState(prev => ({
        ...prev,
        [pickingTarget]: cleanId
      }));
    }
    setPickingTarget(null);
  };

  const roles = [
    {
      key: 'plannerModel' as const,
      title: 'Estruturação & Planner',
      icon: Brain,
      color: 'text-brand-purple',
      bgGlow: 'bg-brand-purple/10 border-brand-purple/30',
      description: 'Planejamento de alto nível, decomposição de tarefas complexas e regras do sistema.',
      suggested: ['openai/gpt-4o', 'openai/gpt-5.6-luna-pro', 'deepseek/deepseek-r1']
    },
    {
      key: 'codingModel' as const,
      title: 'Coding & Implementação',
      icon: Code2,
      color: 'text-brand-emerald',
      bgGlow: 'bg-brand-emerald/10 border-brand-emerald/30',
      description: 'Edição precisa de código, criação de arquivos, refatorações cirúrgicas e features.',
      suggested: ['anthropic/claude-3.7-sonnet', 'openai/gpt-4o', 'deepseek/deepseek-r1']
    },
    {
      key: 'reasoningModel' as const,
      title: 'Deep Thinking & Debugging',
      icon: Flame,
      color: 'text-brand-amber',
      bgGlow: 'bg-brand-amber/10 border-brand-amber/30',
      description: 'Raciocínio lógico profundo, resolução de bugs complexos e análise de stack trace.',
      suggested: ['deepseek/deepseek-r1', 'openai/o3-mini', 'anthropic/claude-3.7-sonnet']
    },
    {
      key: 'fastToolsModel' as const,
      title: 'Fast Tools & Terminal',
      icon: Zap,
      color: 'text-brand-cyan',
      bgGlow: 'bg-brand-cyan/10 border-brand-cyan/30',
      description: 'Execução ágil de comandos, leitura de arquivos em massa e checagens rápidas.',
      suggested: ['google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct', 'openai/gpt-4o-mini']
    }
  ];

  const getTargetModalTitle = () => {
    switch (pickingTarget) {
      case 'primary': return 'Selecionar Modelo Principal (Hub Central)';
      case 'plannerModel': return 'Selecionar Modelo para Estruturação & Planner';
      case 'codingModel': return 'Selecionar Modelo para Coding & Implementação';
      case 'reasoningModel': return 'Selecionar Modelo para Deep Thinking & Debugging';
      case 'fastToolsModel': return 'Selecionar Modelo para Fast Tools & Terminal';
      default: return 'Catálogo Completo de Modelos';
    }
  };

  const getActiveModelForPicker = () => {
    if (pickingTarget === 'primary') return pipelineState.primaryModel;
    if (pickingTarget) return pipelineState[pickingTarget] || pipelineState.primaryModel;
    return primaryModel;
  };

  // Filtered pool for inline dropdowns based on inlineSearch
  const filteredModelsPool = inlineSearch.trim()
    ? modelsPool.filter(m => 
        m.id.toLowerCase().includes(inlineSearch.toLowerCase()) ||
        (m.name && m.name.toLowerCase().includes(inlineSearch.toLowerCase()))
      )
    : modelsPool;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="bg-card border border-card-border rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center shadow-inner">
              <Network className="w-5 h-5 text-accent-light" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                <span>Mind Map & Pipeline Multi-Agente</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/20 border border-accent/30 text-accent-light">
                  Orquestração Visual
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Por padrão, o modelo principal opera todas as etapas. Você pode especializar agentes individuais para cada tarefa.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Keys & Catalog Live Status Banner */}
        <div className="px-5 py-2 bg-panel/80 border-b border-card-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
              <Key className="w-3.5 h-3.5 text-accent-light" />
              <span>Chaves:</span>
            </span>

            {/* OpenRouter badge */}
            <span 
              className={`inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                config?.keys?.openrouter 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
              title={config?.keys?.openrouter ? 'OpenRouter API Key configurada e ativa' : 'Chave OpenRouter ausente'}
            >
              <Globe className="w-2.5 h-2.5" />
              <span>OpenRouter: {config?.keys?.openrouter ? 'Ativa' : 'Ausente'}</span>
            </span>

            {/* OpenAI badge */}
            <span 
              className={`inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                config?.keys?.openai 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title={config?.keys?.openai ? 'OpenAI Direct Key configurada (executa direto)' : 'Sem chave direta OpenAI (fallback OpenRouter)'}
            >
              <span>OpenAI: {config?.keys?.openai ? 'Ativa (Direta)' : 'Inativa'}</span>
            </span>

            {/* Claude badge */}
            <span 
              className={`inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                config?.keys?.anthropic 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title={config?.keys?.anthropic ? 'Claude Direct Key configurada (executa direto)' : 'Sem chave direta Claude (fallback OpenRouter)'}
            >
              <span>Claude: {config?.keys?.anthropic ? 'Ativa (Direta)' : 'Inativa'}</span>
            </span>

            {/* Google Gemini badge */}
            <span 
              className={`inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                config?.keys?.google 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title={config?.keys?.google ? 'Google Gemini Key configurada (executa direto)' : 'Sem chave direta Google (fallback OpenRouter)'}
            >
              <span>Google: {config?.keys?.google ? 'Ativa (Direta)' : 'Inativa'}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[11px] text-accent-light hover:text-white underline hover:no-underline font-medium transition-colors flex items-center space-x-1"
                title="Configurar chaves de API nas configurações globais"
              >
                <span>Configurar Chaves</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={handleRefreshCatalog}
              disabled={isRefreshing}
              className="px-2.5 py-1 rounded-lg bg-card hover:bg-card-border border border-card-border text-[11px] font-mono text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all disabled:opacity-50"
              title="Buscar adições e novas versões de modelos no OpenRouter em tempo real"
            >
              <RefreshCw className={`w-3 h-3 text-accent-light ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Atualizando...' : `Atualizar Catálogo (${modelsPool.length})`}</span>
            </button>
          </div>
        </div>

        {refreshMessage && (
          <div className="px-5 py-1.5 bg-accent/15 border-b border-accent/30 text-accent-light text-xs font-mono flex items-center justify-between animate-in fade-in">
            <span>{refreshMessage}</span>
            <button onClick={() => setRefreshMessage(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* Global Quick Search Filter Bar */}
        <div className="px-5 py-2.5 bg-panel border-b border-card-border flex items-center justify-between gap-3 text-xs">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inlineSearch}
              onChange={(e) => setInlineSearch(e.target.value)}
              placeholder="Filtrar modelos rápidos (ex: gpt-4o, claude, luna, deepseek, gemini)..."
              className="w-full bg-card border border-card-border rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-accent"
            />
            {inlineSearch && (
              <button
                onClick={() => setInlineSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setPickingTarget('primary')}
              className="px-3 py-1.5 rounded-xl bg-accent/20 hover:bg-accent border border-accent/40 text-accent-light hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
              title="Abrir catálogo com filtros de preço por token, provedor e busca avançada"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Catálogo com Filtros & Preços</span>
            </button>
          </div>
        </div>

        {/* Mind Map Canvas / Interactive Pipeline View */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-card-border bg-[#0d0e12]">
          
          {/* CENTRAL NODE: MASTER ORCHESTRATOR */}
          {(() => {
            const primaryRouting = getModelRoutingInfo(pipelineState.primaryModel, config);
            return (
              <div className="relative p-5 rounded-2xl bg-panel border-2 border-accent/50 shadow-xl shadow-accent/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-accent/25 border border-accent flex items-center justify-center shadow-lg shadow-accent/20">
                    <Cpu className="w-6 h-6 text-accent-light animate-pulse-subtle" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-accent-light">
                        HUB CENTRAL • MODELO PRINCIPAL
                      </span>
                      <span className="text-[9px] font-mono bg-accent/20 text-accent-light px-1.5 py-0.2 rounded border border-accent/30">
                        Propaga para todos
                      </span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border flex items-center space-x-1 ${primaryRouting.badgeClass}`}>
                        {primaryRouting.isDirectKey ? <Key className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                        <span>{primaryRouting.badgeText} ({primaryRouting.providerName})</span>
                      </span>
                    </div>
                    <h4 className="font-bold text-base text-slate-100 font-mono">
                      {pipelineState.primaryModel}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Modelo default aplicado a todas as rotinas e sub-tarefas não customizadas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPickingTarget('primary')}
                    className="px-3 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-accent/20 transition-all"
                    title="Pesquisar e filtrar modelo no catálogo"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Pesquisar Modelo</span>
                  </button>

                  <select
                    value={pipelineState.primaryModel}
                    onChange={(e) => handlePrimaryChange(e.target.value)}
                    className="bg-card border border-card-border rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-accent cursor-pointer max-w-[200px]"
                  >
                    {filteredModelsPool.map(m => (
                      <option key={m.id} value={m.id} className="bg-card text-slate-200">
                        {m.name || m.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })()}

          {/* Animated Connecting Indicator */}
          <div className="flex items-center justify-center space-x-3 text-[11px] font-mono text-slate-500">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-card-border to-transparent" />
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-card border border-card-border text-slate-400">
              <Layers className="w-3.5 h-3.5 text-accent-light" />
              <span>Pipeline de Especialização por Função</span>
            </span>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-card-border to-transparent" />
          </div>

          {/* 4 SPECIALIST NODES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((r) => {
              const Icon = r.icon;
              const isCustom = !!pipelineState[r.key];
              const effectiveModel = pipelineState[r.key] || pipelineState.primaryModel;
              const effectiveRouting = getModelRoutingInfo(effectiveModel, config);

              return (
                <div 
                  key={r.key}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 ${
                    isCustom 
                      ? 'bg-card/90 border-accent/50 shadow-md shadow-accent/5' 
                      : 'bg-card/40 border-card-border hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${r.bgGlow}`}>
                        <Icon className={`w-4 h-4 ${r.color}`} />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-200 block">
                          {r.title}
                        </span>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          {r.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border flex items-center space-x-1 ${effectiveRouting.badgeClass}`}>
                        {effectiveRouting.isDirectKey ? <Key className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                        <span>{effectiveRouting.badgeText}</span>
                      </span>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                        isCustom
                          ? 'bg-accent/20 border-accent text-accent-light font-semibold'
                          : 'bg-card border-card-border text-slate-500'
                      }`}>
                        {isCustom ? '✨ Personalizado' : '🔗 Herdado'}
                      </span>
                    </div>
                  </div>

                  {/* Active Model Indicator & Selector */}
                  <div className="p-2.5 rounded-xl bg-panel border border-card-border space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-400">Modelo em Operação:</span>
                        <span className="text-[9px] text-slate-500 font-mono">({effectiveRouting.providerName})</span>
                      </div>
                      <span className="text-slate-100 font-semibold truncate max-w-[180px]" title={effectiveModel}>
                        {effectiveModel.split('/').pop()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setPickingTarget(r.key)}
                        className="px-2.5 py-1.5 rounded-lg bg-accent/15 hover:bg-accent text-accent-light hover:text-white border border-accent/30 text-xs font-semibold flex items-center space-x-1 transition-all shrink-0"
                        title="Abrir pesquisa e filtros para este agente"
                      >
                        <Search className="w-3 h-3" />
                        <span>Buscar</span>
                      </button>

                      <select
                        value={pipelineState[r.key] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPipelineState(prev => ({
                            ...prev,
                            [r.key]: val
                          }));
                        }}
                        className="w-full bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-accent cursor-pointer truncate"
                      >
                        <option value="" className="bg-card text-slate-400">
                          (Herdar Modelo Principal: {pipelineState.primaryModel.split('/').pop()})
                        </option>
                        {filteredModelsPool.map(m => (
                          <option key={m.id} value={m.id} className="bg-card text-slate-200">
                            {m.name || m.id}
                          </option>
                        ))}
                      </select>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => setPipelineState(prev => ({ ...prev, [r.key]: '' }))}
                          className="p-1.5 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-400 hover:text-white transition-colors shrink-0"
                          title="Restaurar para herdar modelo principal"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Quick Suggested Models */}
                    <div className="flex items-center space-x-1 pt-1 overflow-x-auto scrollbar-none text-[10px] font-mono">
                      <span className="text-slate-500 shrink-0">Sugestões:</span>
                      {r.suggested.map(sm => (
                        <button
                          key={sm}
                          type="button"
                          onClick={() => setPipelineState(prev => ({ ...prev, [r.key]: sm }))}
                          className={`px-1.5 py-0.5 rounded border transition-all truncate ${
                            pipelineState[r.key] === sm
                              ? 'bg-accent/25 border-accent text-accent-light font-bold'
                              : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                          }`}
                          title={`Definir para ${sm}`}
                        >
                          {sm.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-card-border flex items-center justify-between bg-sidebar">
          <button
            type="button"
            onClick={handleResetAllToPrimary}
            className="px-3.5 py-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-colors flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Redefinir Tudo para o Modelo Principal</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-accent/25 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Pipeline de Agentes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: Reusable Rich Model Selector with Providers, Price Tiers & Search Filters */}
      {pickingTarget && (
        <ModelSelectorModal
          isOpen={!!pickingTarget}
          onClose={() => setPickingTarget(null)}
          curatedModels={curatedModels}
          allModels={allModels}
          activeModel={getActiveModelForPicker()}
          onSelectModel={handleModelSelectedFromPicker}
          title={getTargetModalTitle()}
          subtitle="Busque por nome, filtre por provedor (OpenAI, Anthropic, Google, DeepSeek) ou ordene por menor valor de token."
        />
      )}
    </div>
  );
};
