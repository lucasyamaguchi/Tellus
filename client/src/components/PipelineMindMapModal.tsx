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
  ShieldCheck
} from 'lucide-react';
import { AgentPipelineConfig, OpenRouterModel } from '../types';

interface PipelineMindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryModel: string;
  allModels: OpenRouterModel[];
  curatedModels: OpenRouterModel[];
  currentPipeline?: AgentPipelineConfig;
  onSavePipeline: (pipeline: AgentPipelineConfig) => void;
  onSelectPrimaryModel: (modelId: string) => void;
}

export const PipelineMindMapModal: React.FC<PipelineMindMapModalProps> = ({
  isOpen,
  onClose,
  primaryModel,
  allModels,
  curatedModels,
  currentPipeline,
  onSavePipeline,
  onSelectPrimaryModel
}) => {
  const modelsPool = allModels.length > 0 ? allModels : curatedModels;

  const [pipelineState, setPipelineState] = useState<AgentPipelineConfig>({
    primaryModel: currentPipeline?.primaryModel || primaryModel,
    plannerModel: currentPipeline?.plannerModel || '',
    codingModel: currentPipeline?.codingModel || '',
    reasoningModel: currentPipeline?.reasoningModel || '',
    fastToolsModel: currentPipeline?.fastToolsModel || ''
  });

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

        {/* Mind Map Canvas / Interactive Pipeline View */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-card-border bg-[#0d0e12]">
          
          {/* CENTRAL NODE: MASTER ORCHESTRATOR */}
          <div className="relative p-5 rounded-2xl bg-panel border-2 border-accent/50 shadow-xl shadow-accent/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-accent/25 border border-accent flex items-center justify-center shadow-lg shadow-accent/20">
                <Cpu className="w-6 h-6 text-accent-light animate-pulse-subtle" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-accent-light">
                    HUB CENTRAL • MODELO PRINCIPAL
                  </span>
                  <span className="text-[9px] font-mono bg-accent/20 text-accent-light px-1.5 py-0.2 rounded border border-accent/30">
                    Propaga para todos
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
              <select
                value={pipelineState.primaryModel}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                className="bg-card border border-card-border rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-accent cursor-pointer max-w-[220px]"
              >
                {modelsPool.map(m => (
                  <option key={m.id} value={m.id} className="bg-card text-slate-200">
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                      isCustom
                        ? 'bg-accent/20 border-accent text-accent-light font-semibold'
                        : 'bg-card border-card-border text-slate-500'
                    }`}>
                      {isCustom ? '✨ Personalizado' : '🔗 Herdado'}
                    </span>
                  </div>

                  {/* Active Model Indicator & Selector */}
                  <div className="p-2.5 rounded-xl bg-panel border border-card-border space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Modelo em Operação:</span>
                      <span className="text-slate-100 font-semibold truncate max-w-[200px]" title={effectiveModel}>
                        {effectiveModel.split('/').pop()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
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
                        {modelsPool.map(m => (
                          <option key={m.id} value={m.id} className="bg-card text-slate-200">
                            {m.name || m.id}
                          </option>
                        ))}
                      </select>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => setPipelineState(prev => ({ ...prev, [r.key]: '' }))}
                          className="p-1.5 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-400 hover:text-white transition-colors"
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
    </div>
  );
};
