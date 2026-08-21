import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Cpu, 
  Sparkles, 
  Check, 
  Zap, 
  Brain, 
  DollarSign, 
  Maximize2,
  Plus,
  ArrowRight,
  Filter
} from 'lucide-react';
import { OpenRouterModel } from '../types';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  curatedModels: OpenRouterModel[];
  allModels: OpenRouterModel[];
  activeModel: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  curatedModels,
  allModels,
  activeModel,
  onSelectModel
}) => {
  const [search, setSearch] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>('all');

  if (!isOpen) return null;

  const handleUseCustomModel = () => {
    let cleanId = customModelInput.trim();
    if (!cleanId) return;

    // Auto-prefix if missing provider namespace
    if (!cleanId.includes('/')) {
      if (cleanId.startsWith('gpt-') || cleanId.startsWith('o1') || cleanId.startsWith('o3') || cleanId.startsWith('chatgpt')) {
        cleanId = `openai/${cleanId}`;
      } else if (cleanId.startsWith('claude')) {
        cleanId = `anthropic/${cleanId}`;
      } else if (cleanId.startsWith('gemini')) {
        cleanId = `google/${cleanId}`;
      } else if (cleanId.startsWith('deepseek')) {
        cleanId = `deepseek/${cleanId}`;
      }
    }

    onSelectModel(cleanId);
    onClose();
  };

  const modelsPool = allModels.length > 0 ? allModels : curatedModels;

  const filterModels = () => {
    let list = modelsPool;

    // Provider filter
    if (selectedProviderFilter !== 'all') {
      if (selectedProviderFilter === 'free') {
        list = list.filter(m => m.id.includes(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0'));
      } else {
        list = list.filter(m => 
          m.id.toLowerCase().startsWith(selectedProviderFilter.toLowerCase()) ||
          m.id.toLowerCase().includes(selectedProviderFilter.toLowerCase())
        );
      }
    }

    // Search filter
    if (search.trim()) {
      const lower = search.toLowerCase();
      list = list.filter(m => 
        m.id.toLowerCase().includes(lower) || 
        m.name.toLowerCase().includes(lower) ||
        (m.description && m.description.toLowerCase().includes(lower))
      );
    }

    return list;
  };

  const displayedModels = filterModels();

  const providerFilters = [
    { id: 'all', label: 'Todos os Modelos' },
    { id: 'openai', label: 'OpenAI (GPT / Luna / o3)' },
    { id: 'anthropic', label: 'Anthropic (Claude)' },
    { id: 'google', label: 'Google (Gemini)' },
    { id: 'deepseek', label: 'DeepSeek (R1 / V3)' },
    { id: 'meta-llama', label: 'Meta (Llama 3)' },
    { id: 'mistralai', label: 'Mistral AI' },
    { id: 'x-ai', label: 'xAI (Grok)' },
    { id: 'free', label: '🎁 Gratuitos' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Catálogo Completo de Modelos (OpenRouter & Custom)</h3>
              <p className="text-[11px] text-slate-400">
                Selecione qualquer um dos {modelsPool.length} modelos disponíveis ou digite um ID customizado.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Custom Model Input Box */}
        <div className="p-3.5 border-b border-card-border bg-[#090b10] flex items-center space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={customModelInput}
              onChange={(e) => setCustomModelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUseCustomModel()}
              placeholder="Digite qualquer ID de modelo (ex: openai/gpt-5.6-luna-pro, anthropic/claude-3.7-sonnet)..."
              className="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={handleUseCustomModel}
            disabled={!customModelInput.trim()}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shrink-0"
          >
            <span>Usar este Modelo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search & Provider Chips */}
        <div className="p-4 border-b border-card-border bg-panel space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar entre 400+ modelos por nome, ID ou recurso..."
              className="w-full bg-background border border-card-border rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {providerFilters.map(pf => (
              <button
                key={pf.id}
                onClick={() => setSelectedProviderFilter(pf.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  selectedProviderFilter === pf.id
                    ? 'bg-accent text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 bg-card border border-card-border'
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-card-border">
          {displayedModels.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum modelo encontrado com os filtros atuais.
            </div>
          ) : (
            displayedModels.map((m) => {
              const isSelected = activeModel === m.id || activeModel.endsWith(m.id);
              const formatTokens = (num: number) => {
                if (!num) return '128k';
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                return `${Math.round(num / 1000)}k`;
              };

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    onSelectModel(m.id);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                    isSelected
                      ? 'bg-accent/15 border-accent shadow-md shadow-accent/10'
                      : 'bg-card border-card-border hover:border-slate-600 hover:bg-card-border/40'
                  }`}
                >
                  <div className="space-y-1.5 pr-4 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-100">{m.name}</span>
                      <span className="font-mono text-[10px] text-brand-cyan bg-panel px-2 py-0.5 rounded border border-card-border">
                        {m.id}
                      </span>
                    </div>

                    {m.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-mono pt-1">
                      <span className="flex items-center text-brand-cyan">
                        <Maximize2 className="w-3 h-3 mr-1" />
                        Contexto: {formatTokens(m.context_length)} tokens
                      </span>
                      {m.pricing && (
                        <span className="flex items-center text-emerald-400">
                          <DollarSign className="w-3 h-3 mr-0.5" />
                          Prompt: ${parseFloat(m.pricing.prompt || '0') * 1000000}/M
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="px-3 py-1 rounded-lg bg-panel hover:bg-accent hover:text-white border border-card-border text-[11px] text-slate-300 font-medium transition-colors">
                        Selecionar
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
