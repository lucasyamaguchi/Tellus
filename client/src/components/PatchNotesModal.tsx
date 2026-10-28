import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ShieldCheck, 
  Cloud, 
  BookOpen, 
  Edit3, 
  BrainCircuit, 
  Radio, 
  Network, 
  CheckCircle2, 
  ExternalLink, 
  Layers, 
  Lock, 
  Zap, 
  Cpu, 
  Terminal,
  FolderGit2,
  FileCode,
  Palette
} from 'lucide-react';

export interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'highlights' | 'notes' | 'cloud' | 'agent' | 'security'>('highlights');

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-card-border rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 select-text"
      >
        {/* Top Header */}
        <div className="p-5 border-b border-card-border bg-sidebar/95 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent to-brand-cyan flex items-center justify-center shadow-md shadow-accent/20 text-white shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-white tracking-tight">Tellus v1.0.0 — Patch Notes & Capacidades</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Release Oficial
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Central de Desenvolvimento Autônomo com Cofre de Conhecimento Híbrido, Multi-Cloud E2EE e Proteção GitSafe
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-card-border text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-5 pt-3 border-b border-card-border bg-sidebar/50 gap-2 shrink-0 overflow-x-auto select-none scrollbar-none">
          <button
            onClick={() => setActiveTab('highlights')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'highlights'
                ? 'border-accent text-accent-light'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Destaques da v1.0</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'notes'
                ? 'border-accent text-accent-light'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Tellus Notes & Ink</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'cloud'
                ? 'border-accent text-accent-light'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Sync & 2FA</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'border-accent text-accent-light'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>GitSafe & Segurança</span>
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'agent'
                ? 'border-accent text-accent-light'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Motor Agêntico & Memória</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-card-border flex-1">
          {/* TAB 1: HIGHLIGHTS */}
          {activeTab === 'highlights' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-panel border border-card-border space-y-2">
                <span className="text-[10px] uppercase font-bold text-accent-light font-mono block">
                  O Que o Tellus é Capaz de Fazer
                </span>
                <p className="text-slate-200 text-sm leading-relaxed">
                  O <strong>Tellus v1.0.0</strong> é o primeiro assistente agêntico que une desenvolvimento de código inteligente (VS Code style), gestão de conhecimento profundo estilo <strong>Notion + Goodnotes</strong> (anotações Markdown + escrita à mão digital), e sincronização multi-cloud segura com criptografia 2FA e blindagem ativa de segredos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-card border border-card-border space-y-2">
                  <div className="flex items-center space-x-2 text-accent-light font-bold">
                    <Edit3 className="w-4 h-4" />
                    <span>Cofre Tellus Notes & Canvas Digital</span>
                  </div>
                  <p className="text-slate-400">
                    Edite notas em Markdown puro, conecte ideias com <code>[[Wikilinks]]</code> e backlinks automáticos, e desenhe anotações manuais vetoriais sobre o texto ou em prancheta limpa.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-card-border space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                    <Cloud className="w-4 h-4" />
                    <span>Cloud Sync Multi-Provedor com 2FA</span>
                  </div>
                  <p className="text-slate-400">
                    Sincronize com Google Drive, OneDrive ou Nuvem Própria. Seus dados viajam com criptografia AES-256-GCM e exigem sua Chave Mestra 2FA para serem visualizados em outro PC.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-card-border space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>GitSafe Shield & Pre-Push Sanitizer</span>
                  </div>
                  <p className="text-slate-400">
                    Varredura automática contra vazamento acidental de chaves de API, senhas e tokens sensíveis antes de qualquer salvamento ou git push ao GitHub.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-card-border space-y-2">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold">
                    <Radio className="w-4 h-4" />
                    <span>Live Voice & Orquestração Multi-Modelo</span>
                  </div>
                  <p className="text-slate-400">
                    Estude notas conversando por voz em tempo real. Alterne instantaneamente entre modelos de planejamento, codificação e raciocínio profundo.
                  </p>
                </div>
              </div>

              {/* Automated Test Suite Badge */}
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-300 block">Confiabilidade & Qualidade Comprovada</span>
                    <span className="text-[11px] text-slate-400">Suíte de 87 testes automatizados executando em 15 módulos sem nenhuma falha.</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  87/87 Passados
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: TELLUS NOTES & INK */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-card-border space-y-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-accent-light" />
                  <span>Padronização do Tellus Notes (TellusMD)</span>
                </h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />
                    <span><strong>Nomenclatura 100% Padronizada:</strong> Todos os arquivos, contratos de API e componentes foram unificados para a marca <strong>Tellus</strong> (<code>TellusNoteView</code>, <code>tellusNoteEngine</code>, <code>TellusNote</code>), mantendo compatibilidade transparente com aliases legados.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />
                    <span><strong>Layout Ultra-Fluido e Sem Vazio:</strong> Resolvida a falha de contenção horizontal. Ao recolher a bandeja lateral, o painel do documento e o dashboard se expandem para ocupar 100% da largura útil sem barras pretas sem resize.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />
                    <span><strong>Digital Ink Canvas (Goodnotes Style):</strong> Prancheta de tinta vetorial sensível a pressão com ferramentas de caneta, marca-texto de precisão, borracha com raio ajustável e paleta de cores.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />
                    <span><strong>Wikilinks & Grafo Obsidian:</strong> Links interativos <code>[[Nome da Nota]]</code>, extração de referências reversas (backlinks) e renderização no grafo tridimensional.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />
                    <span><strong>Lixeira com Auto-Purge:</strong> Exclusão suave (soft-delete) com retenção configurável (30 dias a 1 ano) e restauração com um clique.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD SYNC & 2FA */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-card-border space-y-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-cyan-400" />
                  <span>Sincronização em Nuvem Multi-Dispositivo</span>
                </h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Escolha do Provedor de Nuvem:</strong> Suporte configurável para Google Drive, Microsoft OneDrive, Dropbox, WebDAV ou Servidor Local/Customizado sem expor IPs públicos.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Chave 2FA Criptografada:</strong> Ao configurar o cofre pela primeira vez, você define uma Chave Mestra 2FA. Em outros computadores, mesmo após logar na conta Google ou Microsoft, o Tellus exige a sua Chave Mestra para decifrar as anotações.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Monitoramento de Cota de Armazenamento:</strong> Exibição do tamanho ocupado pelo cofre, armazenamento total da nuvem e alertas automáticos antecipados ao atingir 85% e 95% do limite.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Modo Local Exclusivo:</strong> Opção de alternar contas ou desconectar completamente, mantendo todas as notas salvas com segurança no disco rígido do PC sem tráfego de rede.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: GITSAFE & SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-card-border space-y-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>GitSafe: Proteção Contínua contra Vazamento de Dados</span>
                </h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Ofuscação de Chaves de API em Tempo Real:</strong> Filtra automaticamente chaves do OpenAI (sk-proj-...), Anthropic (sk-ant-...), GitHub (ghp_...), Google Cloud, Fish Audio, AWS e senhas confidenciais.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Auditoria Pre-Push para o GitHub:</strong> O modal do GitSafe verifica o repositório antes de cada commit/push, conferindo regras do .gitignore, variáveis de ambiente e arquivos sensíveis.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Preservação de Conteúdo Legítimo:</strong> Código-fonte, URLs públicas, documentação e blocos normais de texto nunca são corrompidos pelo filtro.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: AGENTIC ENGINE */}
          {activeTab === 'agent' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-card-border space-y-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                  <span>Motor Agêntico, Memória & Skills</span>
                </h3>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Pipeline Multi-Modelo Especializado:</strong> Distribua tarefas entre Planner, Coder, Reasoning e Fast Tools para maximizar inteligência com economia de tokens.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Palácio de Memória (.agentic/palace/):</strong> Contexto de longo prazo que guarda o histórico de decisões técnicas, builds e handoffs de cada projeto de forma totalmente isolada.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Galeria de Skills:</strong> Importação de arquivos <code>SKILL.md</code> com categorização por escopo (global ou por projeto) e visualização de conexões em grafo.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-card-border bg-sidebar/90 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-400 font-mono">
            Tellus v1.0.0 • Engine Build {new Date().getFullYear()}
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all shadow-md shadow-accent/20 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatchNotesModal;
