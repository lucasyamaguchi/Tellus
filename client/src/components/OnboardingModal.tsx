import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Key, 
  Volume2, 
  FolderKanban, 
  Cloud, 
  CheckCircle2, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  Copy, 
  Check, 
  HelpCircle,
  Laptop,
  Lock,
  Cpu,
  FileCode,
  BookOpen
} from 'lucide-react';
import { AppConfig } from '../types';
import { api } from '../api';

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onConfigUpdated: (newConfig: AppConfig) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [openrouterKey, setOpenrouterKey] = useState<string>(config?.keys?.openrouter || '');
  const [fishAudioKey, setFishAudioKey] = useState<string>(config?.keys?.fishAudio || '');
  const [googleKey, setGoogleKey] = useState<string>(config?.keys?.google || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveKeys = async () => {
    setIsSaving(true);
    try {
      const updated = await api.updateConfig({
        keys: {
          ...config?.keys,
          openrouter: openrouterKey.trim() || undefined,
          fishAudio: fishAudioKey.trim() || undefined,
          google: googleKey.trim() || undefined,
        }
      });
      onConfigUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Falha ao salvar chaves no onboarding:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalSteps = 5;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-card-border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 select-text"
      >
        {/* Header com Stepper */}
        <div className="p-5 border-b border-card-border bg-sidebar/95 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent to-brand-cyan flex items-center justify-center shadow-md shadow-accent/20 text-white shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">Primeiro Uso — Guia de Inicialização do Tellus</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent-light border border-accent/30">
                  Passo {currentStep} de {totalSteps}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure suas chaves, diretórios e integrações para funcionamento imediato
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

        {/* Progress Bar */}
        <div className="w-full bg-slate-800/80 h-1">
          <div 
            className="bg-gradient-to-r from-accent to-brand-cyan h-1 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed">
          {/* PASSO 1: Boas-vindas e Visão Geral */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-accent/10 via-card-border/20 to-panel border border-card-border space-y-3">
                <div className="flex items-center space-x-2 text-accent-light font-bold text-base">
                  <ShieldCheck className="w-5 h-5 text-accent-light" />
                  <span>Bem-vindo ao Tellus — Seu Ambiente Agêntico 100% Local</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  O <strong>Tellus</strong> foi projetado para máxima autonomia, privacidade e produtividade. Ao contrário de plataformas em nuvem fechadas, 
                  <strong> nenhum dado ou anotação sua passa por servidores intermediários</strong>. Todo o processamento, cofre de anotações e workspace de código rodam localmente na sua máquina.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-panel/70 border border-card-border space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                    <Key className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-white">Chaves Próprias (BYOK)</h4>
                  <p className="text-[11px] text-slate-400">
                    Você conecta diretamente suas chaves de API sem mensalidades inflacionadas ou restrições de provedor.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-panel/70 border border-card-border space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-white">Cofre de Conhecimento</h4>
                  <p className="text-[11px] text-slate-400">
                    Compatível nativamente com Obsidian Markdown, caligrafia digital com Apple Pencil/Wacom e lixeira segura.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-panel/70 border border-card-border space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center justify-center font-bold">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-white">Tellus Code Studio</h4>
                  <p className="text-[11px] text-slate-400">
                    Editor Monaco completo com atalhos VS Code, Prettier (Shift+Alt+F) e ícones Material por extensão.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-2.5">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Para começar a usar a IA, você precisará de pelo menos uma chave de API (recomendamos a <strong>OpenRouter</strong> para acesso a centenas de modelos por centavos).
                </span>
              </div>
            </div>
          )}

          {/* PASSO 2: OpenRouter Setup */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Cpu className="w-5 h-5 text-indigo-400" />
                    <span>Passo 1: Obter Chave OpenRouter (Recomendado)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    O OpenRouter é um hub seguro que disponibiliza Claude 3.5 Sonnet, DeepSeek R1, Gemini 2.5 Flash, GPT-4o e mais de 300 modelos com pagamento por uso real.
                  </p>
                </div>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <span>Abrir OpenRouter</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Guia Passo a Passo */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-panel/70 border border-card-border space-y-2">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Como Criar sua Chave em 3 Minutos:</span>
                  <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5">
                    <li>Acesse <strong className="text-white">openrouter.ai</strong> e crie ou entre na sua conta (via Google ou e-mail).</li>
                    <li>Vá para a aba <strong className="text-white">Keys</strong> ou acesse diretamente <code className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">openrouter.ai/keys</code>.</li>
                    <li>Clique em <strong className="text-white">Create Key</strong>, dê um nome como <code className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">Tellus-Desktop</code> e copie a chave gerada (<code className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">sk-or-v1-...</code>).</li>
                    <li>Recarregue um valor simbólico (ex: $5 dólares duram meses para uso rotineiro).</li>
                  </ol>
                </div>

                {/* Input Direto */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Cole sua Chave OpenRouter:</span>
                    <span className="text-[10px] text-slate-400 font-normal">Armazenada de forma segura e local</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="password"
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                      placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-panel border border-card-border text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent font-mono"
                    />
                    <button
                      onClick={handleSaveKeys}
                      disabled={isSaving || !openrouterKey.trim()}
                      className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5 shrink-0"
                    >
                      {saveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Salva!</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isSaving ? 'Salvando...' : 'Salvar Chave'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Dica de modelos recomendados */}
                <div className="p-3 rounded-xl bg-card border border-card-border/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-200">Modelos mais econômicos recomendados:</div>
                    <div><span className="text-emerald-400 font-mono">google/gemini-2.5-flash</span> (rápido, ~$0.00045/lote) e <span className="text-indigo-400 font-mono">deepseek/deepseek-r1</span> (raciocínio analítico).</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: Fish Audio Setup */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Volume2 className="w-5 h-5 text-emerald-400" />
                    <span>Passo 2: Voz Natural com Fish Audio (TTS & Orbe)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    O Tellus utiliza o Fish Audio para síntese de voz ultra-realista no Orbe de Voz interativo e leitura de anotações.
                  </p>
                </div>
                <a
                  href="https://fish.audio"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <span>Abrir Fish Audio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-panel/70 border border-card-border space-y-2">
                  <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Como Configurar o Fish Audio:</span>
                  <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5">
                    <li>Acesse <strong className="text-white">fish.audio</strong> e crie sua conta gratuita.</li>
                    <li>Clique no seu perfil no canto superior direito e vá em <strong className="text-white">API / Developer</strong>.</li>
                    <li>Gere um novo <strong className="text-white">API Token</strong> e cole-o no campo abaixo.</li>
                    <li>O plano gratuito oferece centenas de gerações por mês para uso pessoal.</li>
                  </ol>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Cole sua Chave Fish Audio:</span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional para voz natural e Orbe</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="password"
                      value={fishAudioKey}
                      onChange={(e) => setFishAudioKey(e.target.value)}
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-panel border border-card-border text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent font-mono"
                    />
                    <button
                      onClick={handleSaveKeys}
                      disabled={isSaving || !fishAudioKey.trim()}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5 shrink-0"
                    >
                      {saveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Salva!</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isSaving ? 'Salvando...' : 'Salvar Chave'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-card-border/80 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Vozes personalizadas:</span> Você pode alternar entre vozes masculinas, femininas ou clonadas diretamente no menu do Orbe de Voz no chat.
                </div>
              </div>
            </div>
          )}

          {/* PASSO 4: Cofre TellusMD e Workspace */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <FolderKanban className="w-5 h-5 text-amber-400" />
                  <span>Passo 3: Cofre de Notas & Workspace de Projetos</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  O Tellus organiza seus arquivos em diretórios padronizados na sua pasta de Documentos do Windows/Linux/Mac.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-panel/70 border border-card-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-accent-light" />
                      <span>Cofre de Conhecimento Padrão (TellusMD Vault)</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Automático
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Localização padrão: <code className="px-1.5 py-0.5 rounded bg-slate-800 text-accent-light font-mono">~/Documents/Tellus Vault</code>
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Você pode abrir esta pasta diretamente no <strong>Obsidian</strong> caso queira. O Tellus cria automaticamente a hierarquia com <code className="text-slate-300">00_Inbox</code>, <code className="text-slate-300">Estudos</code>, <code className="text-slate-300">Projetos</code> e a lixeira segura <code className="text-slate-300">.backups</code>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-panel/70 border border-card-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center space-x-2">
                      <FileCode className="w-4 h-4 text-sky-400" />
                      <span>Workspace de Código & Projetos (Tellus Code Studio)</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                      Personalizável
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Localização padrão: <code className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono">~/Documents/Tellus Workspace</code>
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Você pode alternar de projeto clicando no botão do projeto na barra de navegação ou clicando com o botão direito nos arquivos para abrir no Editor Monaco ou pedir ajuda à IA.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 5: Cloud Sync e Conclusão */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Cloud className="w-5 h-5 text-sky-400" />
                  <span>Passo 4: Sincronização em Nuvem Segura (Opcional)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Mantenha suas notas sincronizadas entre notebooks e desktops com criptografia ponta a ponta (AES-256-GCM).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-panel/70 border border-card-border space-y-3">
                <div className="flex items-center space-x-2 text-white font-bold text-xs">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Criptografia 2FA com Chave Mestra Local</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ao ativar a sincronização em nuvem nas Configurações, o Tellus encripta seus arquivos localmente antes de enviá-los ao Google Drive ou OneDrive. Nem mesmo o provedor da nuvem consegue ler o conteúdo de suas notas ou projetos.
                </p>
              </div>

              {/* Dicas de Atalhos Rápidos */}
              <div className="p-4 rounded-xl bg-card border border-card-border space-y-2.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Atalhos Essenciais do Tellus:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-panel/60 flex items-center justify-between">
                    <span className="text-slate-300">Formatar Código (Prettier)</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent-light font-mono text-[10px]">Shift + Alt + F</kbd>
                  </div>
                  <div className="p-2 rounded-lg bg-panel/60 flex items-center justify-between">
                    <span className="text-slate-300">Alternar Modo Notas / IDE</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent-light font-mono text-[10px]">Barra Superior</kbd>
                  </div>
                  <div className="p-2 rounded-lg bg-panel/60 flex items-center justify-between">
                    <span className="text-slate-300">Menu de Contexto de Arquivo</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent-light font-mono text-[10px]">Botão Direito</kbd>
                  </div>
                  <div className="p-2 rounded-lg bg-panel/60 flex items-center justify-between">
                    <span className="text-slate-300">Orbe de Voz em Tempo Real</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent-light font-mono text-[10px]">Ícone de Microfone</kbd>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Configuração concluída! O Tellus está pronto para ser utilizado na sua máquina.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer com Navegação de Passos */}
        <div className="p-4 border-t border-card-border bg-sidebar/95 flex items-center justify-between shrink-0 select-none">
          <div>
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2 rounded-xl bg-panel hover:bg-card-border border border-card-border text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep < totalSteps ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-accent/20 transition-all cursor-pointer"
              >
                <span>Próximo Passo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  localStorage.setItem('tellus_onboarding_completed', 'true');
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Iniciar Tellus Agora</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
