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
  Filter,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  Gift,
  Flame
} from 'lucide-react';
import { OpenRouterModel } from '../types';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  curatedModels: OpenRouterModel[];
  allModels: OpenRouterModel[];
  activeModel: string;
  onSelectModel: (modelId: string) => void;
  title?: string;
  subtitle?: string;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  curatedModels,
  allModels,
  activeModel,
  onSelectModel,
  title,
  subtitle
}) => {
  const [search, setSearch] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>('all');
  const [selectedPriceTier, setSelectedPriceTier] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'context-desc' | 'name-asc'>('price-asc');

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
      } else if (cleanId.startsWith('llama')) {
        cleanId = `meta-llama/${cleanId}`;
      } else if (cleanId.startsWith('mistral') || cleanId.startsWith('mixtral')) {
        cleanId = `mistralai/${cleanId}`;
      } else if (cleanId.startsWith('grok')) {
        cleanId = `x-ai/${cleanId}`;
      }
    }

    onSelectModel(cleanId);
    onClose();
  };

  const modelsPool = allModels.length > 0 ? allModels : curatedModels;

  const getModelPricePerM = (m: OpenRouterModel) => {
    const prompt = parseFloat(m.pricing?.prompt || '0') * 1000000;
    const comp = parseFloat(m.pricing?.completion || '0') * 1000000;
    return { prompt, comp, avg: (prompt + comp) / 2 };
  };

  const filterAndSortModels = () => {
    let list = [...modelsPool].filter(m => !m.id.endsWith(':batch') && !m.id.includes(':batch'));

    // 1. Provider Filter
    if (selectedProviderFilter !== 'all') {
      list = list.filter(m => 
        m.id.toLowerCase().startsWith(selectedProviderFilter.toLowerCase()) ||
        m.id.toLowerCase().includes(selectedProviderFilter.toLowerCase())
      );
    }

    // 2. Price Tier Filter
    if (selectedPriceTier !== 'all') {
      list = list.filter(m => {
        const { avg, prompt } = getModelPricePerM(m);
        const isFree = m.id.includes(':free') || (avg === 0 && prompt === 0);
        if (selectedPriceTier === 'free') return isFree;
        if (selectedPriceTier === 'ultra-low') return !isFree && avg < 0.50;
        if (selectedPriceTier === 'mid') return avg >= 0.50 && avg <= 3.00;
        if (selectedPriceTier === 'premium') return avg > 3.00;
        return true;
      });
    }

    // 3. Search Filter
    if (search.trim()) {
      const lower = search.toLowerCase();
      list = list.filter(m => 
        m.id.toLowerCase().includes(lower) || 
        m.name.toLowerCase().includes(lower) ||
        (m.description && m.description.toLowerCase().includes(lower))
      );
    }

    // 4. Sorting
    list.sort((a, b) => {
      const priceA = getModelPricePerM(a);
      const priceB = getModelPricePerM(b);

      if (sortBy === 'price-asc') {
        return priceA.avg - priceB.avg;
      }
      if (sortBy === 'price-desc') {
        return priceB.avg - priceA.avg;
      }
      if (sortBy === 'context-desc') {
        return (b.context_length || 0) - (a.context_length || 0);
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return list;
  };

  const displayedModels = filterAndSortModels();

  const providerFilters = [
    { id: 'all', label: 'Todos os Provedores' },
    { id: 'openai', label: 'OpenAI (GPT / Luna / o3)' },
    { id: 'anthropic', label: 'Anthropic (Claude)' },
    { id: 'google', label: 'Google (Gemini)' },
    { id: 'deepseek', label: 'DeepSeek (R1 / V3)' },
    { id: 'meta-llama', label: 'Meta (Llama 3)' },
    { id: 'mistralai', label: 'Mistral AI' },
    { id: 'x-ai', label: 'xAI (Grok)' }
  ];

  const priceTiers = [
    { id: 'all', label: 'Todos os Preços' },
    { id: 'free', label: '🎁 Gratuitos ($0.00)' },
    { id: 'ultra-low', label: '🪙 Ultra Econômicos (< $0.50/M)' },
    { id: 'mid', label: '⚖️ Médio Custo ($0.50 - $3/M)' },
    { id: 'premium', label: '🚀 Premium (> $3.00/M)' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in select-none">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                <span>{title || 'Catálogo Completo & Filtro de Preço por Token'}</span>
                <span className="text-[10px] font-mono font-normal bg-panel px-2 py-0.5 rounded border border-card-border text-emerald-400">
                  {modelsPool.length} modelos
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {subtitle || 'Ordene por menor valor de token, filtre por faixa de custo ou digite qualquer ID customizado.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Custom Model Input Box */}
        <div className="p-3 border-b border-card-border bg-[#0f1117] flex items-center space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={customModelInput}
              onChange={(e) => setCustomModelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUseCustomModel()}
              placeholder="Digite qualquer ID de modelo (ex: openai/gpt-5.6-luna-pro, google/gemini-2.0-flash-001)..."
              className="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={handleUseCustomModel}
            disabled={!customModelInput.trim()}
            className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shrink-0"
          >
            <span>Usar este Modelo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search, Sort and Filters Bar */}
        <div className="p-3.5 border-b border-card-border bg-panel space-y-2.5">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, ID ou provedor..."
                className="w-full bg-background border border-card-border rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1.5 shrink-0 bg-card border border-card-border rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-accent-light" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer font-medium"
              >
                <option value="price-asc" className="bg-card text-slate-200">🪙 Preço: Menor → Maior</option>
                <option value="price-desc" className="bg-card text-slate-200">💎 Preço: Maior → Menor</option>
                <option value="context-desc" className="bg-card text-slate-200">🧠 Contexto: Maior → Menor</option>
                <option value="name-asc" className="bg-card text-slate-200">🔤 Nome (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Price Tier Filter Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Preço:</span>
            {priceTiers.map(pt => (
              <button
                key={pt.id}
                onClick={() => setSelectedPriceTier(pt.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  selectedPriceTier === pt.id
                    ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 bg-card border border-card-border'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* Provider Filter Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Provedor:</span>
            {providerFilters.map(pf => (
              <button
                key={pf.id}
                onClick={() => setSelectedProviderFilter(pf.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
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
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2 scrollbar-thin scrollbar-thumb-card-border">
          {displayedModels.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum modelo encontrado com os filtros e faixa de preço selecionados.
            </div>
          ) : (
            displayedModels.map((m) => {
              const isSelected = activeModel === m.id || activeModel.endsWith(m.id);
              const formatTokens = (num: number) => {
                if (!num) return '128k';
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                return `${Math.round(num / 1000)}k`;
              };

              const price = getModelPricePerM(m);
              const isFree = m.id.includes(':free') || (price.avg === 0 && price.prompt === 0);

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    onSelectModel(m.id);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                    isSelected
                      ? 'bg-accent/15 border-accent shadow-md shadow-accent/10'
                      : 'bg-card border-card-border hover:border-slate-600 hover:bg-card-border/40'
                  }`}
                >
                  <div className="space-y-1 pr-4 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-xs text-slate-100">{m.name}</span>
                      <span className="font-mono text-[10px] text-brand-cyan bg-panel px-2 py-0.5 rounded border border-card-border">
                        {m.id}
                      </span>

                      {/* Price Badge */}
                      {isFree ? (
                        <span className="text-[10px] font-mono font-bold bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Gift className="w-2.5 h-2.5" />
                          <span>GRÁTIS ($0.00)</span>
                        </span>
                      ) : (
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                          price.avg < 0.50
                            ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                            : price.avg <= 3.00
                            ? 'bg-amber-950/40 border-amber-800/40 text-amber-300'
                            : 'bg-purple-950/40 border-purple-800/40 text-purple-300'
                        }`}>
                          ${price.prompt.toFixed(2)} / ${price.comp.toFixed(2)} por 1M tokens
                        </span>
                      )}
                    </div>

                    {m.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-4 text-[10px] text-slate-400 font-mono pt-1">
                      <span className="flex items-center text-brand-cyan">
                        <Maximize2 className="w-3 h-3 mr-1" />
                        Contexto: {formatTokens(m.context_length)} tokens
                      </span>
                      <span className="flex items-center text-slate-400">
                        <DollarSign className="w-3 h-3 mr-0.5 text-emerald-400" />
                        Prompt: ${price.prompt.toFixed(2)}/M | Saída: ${price.comp.toFixed(2)}/M
                      </span>
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
