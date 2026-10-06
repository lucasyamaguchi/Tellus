import React from 'react';
import { X, ExternalLink, Heart, Sparkles, BookOpen, Database, ShieldCheck, Cpu } from 'lucide-react';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-panel border border-card-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-card/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Sparkles className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                Créditos & Fundamentos Arquiteturais
              </h2>
              <p className="text-xs text-slate-400">
                Reconhecimento das bases e inspirações que tornaram o Tellus e o Notes Module possíveis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-card-border">
          {/* Main Statement */}
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex items-start space-x-3">
            <Heart className="w-5 h-5 text-accent-light shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-100 mb-1 text-sm">
                Construído sobre ombros de gigantes
              </p>
              <p className="text-slate-300">
                O <strong>Tellus Notes Module</strong> foi concebido para entregar uma experiência de cofre de conhecimento pessoal 100% local, privada e segura. A arquitetura de memória, organização e visualização integra conceitos pioneiros desenvolvidos e demonstrados por <strong>Fábio Akita</strong>.
              </p>
            </div>
          </div>

          {/* Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Frank MD Card */}
            <div className="p-4 rounded-xl bg-card border border-card-border hover:border-card-border/80 transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-slate-100 text-sm">Frank MD</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                    Conhecimento Local
                  </span>
                </div>
                <p className="text-slate-400 text-xs">
                  Inspirado na proposta do <strong>Frank</strong>: gestão inteligente de anotações em Markdown puro, estrutura hierárquica por pastas e integração profunda com cofres do Obsidian com suporte a wikilinks <code className="text-amber-300 font-mono">[[Nota]]</code> e navegação por grafos interativos.
                </p>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Criador: Fábio Akita</span>
                <span className="font-mono text-accent-light">Notas & Grafos</span>
              </div>
            </div>

            {/* AI-Memory Card */}
            <div className="p-4 rounded-xl bg-card border border-card-border hover:border-card-border/80 transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-100 text-sm">AI-Memory</span>
                  </div>
                  <a
                    href="https://github.com/akitaonrails/ai-memory"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                  >
                    <span>Repositório</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-slate-400 text-xs">
                  Baseado na arquitetura do repositório <strong>ai-memory</strong>: memória de agentes em duas camadas (contexto dinâmico de curto prazo + páginas de tópicos de longo prazo) com busca lexical ponderada BM25 zero-LLM ultra-rápida e retenção segura de backups.
                </p>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <a
                  href="https://github.com/akitaonrails/ai-memory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                >
                  github.com/akitaonrails/ai-memory
                </a>
              </div>
            </div>
          </div>

          {/* Core Principles & Privacy */}
          <div className="p-4 rounded-xl bg-card/60 border border-card-border space-y-3">
            <h3 className="font-semibold text-slate-200 flex items-center space-x-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-accent-light" />
              <span>Princípios de Privacidade e Segurança Local</span>
            </h3>
            <ul className="space-y-1.5 text-slate-400 text-[11px]">
              <li className="flex items-start space-x-2">
                <span className="text-accent">•</span>
                <span><strong>Privacidade Absoluta:</strong> Nenhuma nota é enviada para servidores ou nuvens públicas desnecessariamente; seus arquivos ficam no seu drive físico local.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-accent">•</span>
                <span><strong>Sanitização GitSafe Core:</strong> O sistema remove e redige credenciais, tokens JWT e chaves de API antes de gravar qualquer arquivo no cofre.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-accent">•</span>
                <span><strong>Isolamento de Execução:</strong> Agentes de IA funcionam exclusivamente no desktop sob sua supervisão direta.</span>
              </li>
            </ul>
          </div>

          {/* Ecosystem Thanks */}
          <div className="flex items-center justify-between text-slate-500 text-[11px] pt-2 border-t border-card-border">
            <div className="flex items-center space-x-2">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>Tellus Agentic Environment • Notes Module</span>
            </div>
            <span>v1.2.0 • 2026</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-card-border bg-card/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-xs transition-colors shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
