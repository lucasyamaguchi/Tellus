import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  ShieldCheck, 
  Save, 
  Check, 
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { AppConfig } from '../types';
import { api } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onConfigUpdated: (newConfig: AppConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated,
}) => {
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setOpenrouterKey(config.keys.openrouter || '');
      setGoogleKey(config.keys.google || '');
      setAnthropicKey(config.keys.anthropic || '');
      setOpenaiKey(config.keys.openai || '');
      if (config.theme) setTheme(config.theme);
    }
  }, [config]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.updateConfig({
        theme,
        keys: {
          openrouter: openrouterKey.trim() || undefined,
          google: googleKey.trim() || undefined,
          anthropic: anthropicKey.trim() || undefined,
          openai: openaiKey.trim() || undefined,
        }
      });
      onConfigUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-card-border/80 shadow-sm flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Tellus" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Configuração de Chaves e Provedores</h3>
              <p className="text-[11px] text-slate-400">Armazenamento 100% local e seguro na sua máquina.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 bg-brand-cyan/10 border-b border-brand-cyan/20 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-brand-cyan">Privacidade Garantida:</strong> Suas chaves de API nunca passam por nenhum servidor de terceiros. As requisições saem diretamente do seu computador para a OpenRouter, Google, Anthropic ou OpenAI via HTTPS criptografado.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Theme Selector (Dark / Light) */}
          <div className="space-y-2 p-3 rounded-xl bg-panel border border-card-border">
            <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>Tema da Interface</span>
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center space-x-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-accent/20 border-accent text-accent-light shadow-sm'
                    : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Tema Escuro (Padrão)</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center space-x-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                  theme === 'light'
                    ? 'bg-accent/20 border-accent text-accent-light shadow-sm'
                    : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Tema Claro</span>
              </button>
            </div>
          </div>

          {/* OpenRouter Key & Live Balance */}
          <div className="space-y-2 p-3 rounded-xl bg-panel border border-card-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span>OpenRouter API Key</span>
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-accent-light hover:underline flex items-center space-x-1"
              >
                <span>Obter chave OpenRouter</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-card border border-card-border rounded-lg pl-3 pr-8 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
              />
              {openrouterKey && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-2.5 top-2.5" />
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Dá acesso a mais de 300 modelos (DeepSeek R1, Claude 3.7, Llama 3.3, Qwen 2.5, GPT-4o, etc.).
            </p>
          </div>

          {/* Google Gemini Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">Google Gemini API Key (Opcional)</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-accent-light flex items-center"
              >
                AI Studio <ExternalLink className="w-2.5 h-2.5 ml-1" />
              </a>
            </div>
            <input
              type="password"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Anthropic Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">Anthropic Claude API Key (Opcional)</label>
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-accent-light flex items-center"
              >
                Console <ExternalLink className="w-2.5 h-2.5 ml-1" />
              </a>
            </div>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>

          {/* OpenAI Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">OpenAI API Key (Opcional)</label>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-accent-light flex items-center"
              >
                OpenAI Platform <ExternalLink className="w-2.5 h-2.5 ml-1" />
              </a>
            </div>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-accent/25 transition-all"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Chaves'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
