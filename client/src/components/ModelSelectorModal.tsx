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
  Maximize2 
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
  const [tab, setTab] = useState<'curated' | 'all'>('curated');

  if (!isOpen) return null;

  const filterModels = (list: OpenRouterModel[]) => {
    if (!search.trim()) return list;
    const lower = search.toLowerCase();
    return list.filter(m => 
      m.id.toLowerCase().includes(lower) || 
      m.name.toLowerCase().includes(lower) ||
      (m.description && m.description.toLowerCase().includes(lower))
    );
  };

  const displayedModels = filterModels(tab === 'curated' ? curatedModels : allModels);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Catálogo de Modelos (OpenRouter & Diretos)</h3>
              <p className="text-[11px] text-slate-400">Escolha qualquer modelo para trabalhar mantendo a memória do projeto.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Tabs Bar */}
        <div className="p-4 border-b border-card-border bg-panel space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, id (ex: deepseek, claude, gpt, gemini)..."
              className="w-full bg-background border border-card-border rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTab('curated')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                tab === 'curated'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-card'
              }`}
            >
              ⭐ Modelos Recomendados ({curatedModels.length})
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                tab === 'all'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-card'
              }`}
            >
              🌐 Todos da OpenRouter ({allModels.length > 0 ? allModels.length : 'Carregando...'})
            </button>
          </div>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-card-border">
          {displayedModels.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum modelo encontrado correspondente à busca.
            </div>
          ) : (
            displayedModels.map((m) => {
              const isSelected = activeModel === m.id;
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
                  <div className="space-y-1.5 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-100">{m.name}</span>
                      <span className="font-mono text-[10px] text-slate-400 bg-panel px-1.5 py-0.5 rounded border border-card-border">
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
                        Janela: {formatTokens(m.context_length)} tokens
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
                      <div className="px-2.5 py-1 rounded-lg bg-panel hover:bg-accent hover:text-white border border-card-border text-[11px] text-slate-300 font-medium transition-colors">
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
