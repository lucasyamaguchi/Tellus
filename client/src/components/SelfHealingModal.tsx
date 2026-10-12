import React, { useState } from 'react';
import { 
  Wrench, 
  Sparkles, 
  Bug, 
  CheckCircle2, 
  Cpu, 
  Terminal, 
  FolderGit2, 
  FileText, 
  X, 
  Play, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ProjectOverview } from '../types';

interface SelfHealingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: ProjectOverview | null;
  activeModel: string;
  currentViewMode: 'agent' | 'notes' | 'skills';
  activeNoteTitle?: string | null;
  onTriggerSelfHealing: (userDescription: string, contextSnapshot: string) => void;
}

const PRESET_ISSUES = [
  {
    icon: Bug,
    title: 'Bug na Interface / Renderização',
    prompt: 'Identifiquei um bug visual/de renderização na interface. Inspecione os componentes React do cliente e corrija a falha.'
  },
  {
    icon: FileText,
    title: 'Falha ao Abrir / Carregar Notas',
    prompt: 'A tela de notas apresentou comportamento anômalo ao carregar conteúdo. Inspecione o TelluNoteView e garanta que o DOM e estados sincronizem corretamente.'
  },
  {
    icon: Terminal,
    title: 'Executar e Corrigir Testes (npm test)',
    prompt: 'Rode a suíte de testes automatizados do Tellus (npm test), analise qualquer teste falhando e corrija o código até todos passarem.'
  },
  {
    icon: Sparkles,
    title: 'Otimização & Limpeza de Código',
    prompt: 'Realize uma verificação de auto-manutenção no código-fonte, garantindo tipagens corretas no TypeScript e removendo resíduos não utilizados.'
  }
];

export const SelfHealingModal: React.FC<SelfHealingModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  activeModel,
  currentViewMode,
  activeNoteTitle,
  onTriggerSelfHealing
}) => {
  const [description, setDescription] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (index: number) => {
    setSelectedPreset(index);
    setDescription(PRESET_ISSUES[index].prompt);
  };

  const handleStart = () => {
    const finalDescription = description.trim() || 'Execute um auto-diagnóstico completo do sistema Tellus, verifique integridade de testes e corrija eventuais bugs identificados.';
    
    const contextSnapshot = `
- Visão Atual: ${currentViewMode === 'notes' ? `TellusMD Notas (Nota ativa: "${activeNoteTitle || 'Nenhuma'}")` : currentViewMode === 'skills' ? 'Skills & Artefatos' : 'Workspace do Agente'}
- Projeto Ativo: ${currentProject?.name || 'Tellus'} (${currentProject?.path || 'Local'})
- Modelo Principal: ${activeModel}
`.trim();

    onTriggerSelfHealing(finalDescription, contextSnapshot);
    onClose();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-card-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-sm">
              <Wrench className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-100">Auto-Manutenção do Tellus</h3>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono text-[10px] font-semibold border border-sky-500/30">
                  Self-Healing Agent
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                O Tellus diagnostica e corrige seu próprio código-fonte de forma autônoma
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-xl hover:bg-card-border text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
          {/* Diagnostic Context Pill */}
          <div className="p-3 rounded-2xl bg-panel/70 border border-card-border/80 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
              Telemetria & Contexto do Momento:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="flex items-center space-x-2 text-slate-300">
                <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">
                  {currentViewMode === 'notes' 
                    ? `Nota: ${activeNoteTitle || 'Lista de Notas'}` 
                    : `Tela: ${currentViewMode}`}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{activeModel.split('/').pop()}</span>
              </div>
            </div>
          </div>

          {/* Quick Problem Presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
              Problemas Frequentes (Selecione para preencher rápido):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_ISSUES.map((issue, idx) => {
                const Icon = issue.icon;
                const isSelected = selectedPreset === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(idx)}
                    className={`p-2.5 rounded-xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-card/70 border-card-border hover:bg-card hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs leading-tight">{issue.title}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">Clique para aplicar</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Description Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
              Detalhes do Problema ou Instrução de Correção:
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que você notou (ex: 'A tela de notas ficou preta ao iniciar', 'O botão X não está salvando')..."
              className="w-full bg-card border border-card-border rounded-2xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Capabilities Notice */}
          <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-500/30 text-sky-200 text-[11px] flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              O Tellus alternará imediatamente para o chat, inspecionará os arquivos em <code className="text-sky-300 font-mono">client/</code> e <code className="text-sky-300 font-mono">server/</code>, rodará a suíte de testes automatizados e fará a correção diretamente no código.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-card-border bg-sidebar flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-card-border text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center space-x-2 transition-all shadow-md cursor-pointer"
          >
            <span>Iniciar Auto-Manutenção</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
