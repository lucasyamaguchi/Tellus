import React, { useState } from 'react';
import { 
  Eye, 
  Sparkles, 
  X, 
  Maximize2, 
  Send, 
  Camera, 
  Check, 
  RefreshCw,
  AppWindow,
  Brain
} from 'lucide-react';
import { api } from '../api';
import { Attachment } from '../types';

interface FloatingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSendQuickCommand: (prompt: string, attachment?: Attachment) => void;
  onOpenWindowPicker: () => void;
}

export const FloatingOverlay: React.FC<FloatingOverlayProps> = ({
  isOpen,
  onClose,
  onSendQuickCommand,
  onOpenWindowPicker
}) => {
  const [prompt, setPrompt] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedAttachment, setCapturedAttachment] = useState<Attachment | null>(null);

  if (!isOpen) return null;

  const handleQuickCapture = async () => {
    setIsCapturing(true);
    try {
      const capture = await api.captureScreen();
      setCapturedAttachment(capture);
    } catch (err: any) {
      alert(`Erro ao capturar tela: ${err.message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSend = () => {
    if (!prompt.trim() && !capturedAttachment) return;
    onSendQuickCommand(
      prompt.trim() || 'Analise o que está visível na tela capturada, identifique os erros ou código e aplique as correções.',
      capturedAttachment || undefined
    );
    setPrompt('');
    setCapturedAttachment(null);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
      <div className="w-84 bg-card/95 backdrop-blur-md border border-accent/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Drag Bar & Header */}
        <div className="p-3 bg-sidebar border-b border-card-border flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse" />
            <span className="text-xs font-bold bg-gradient-to-r from-accent-light to-brand-cyan bg-clip-text text-transparent">
              Tellus (Sempre no Topo)
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-card-border text-slate-400 hover:text-white transition-colors"
              title="Fechar Modo Sobreposto"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-3 space-y-3">
          {/* Quick Capture Options */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleQuickCapture}
              disabled={isCapturing}
              className="p-2 rounded-xl bg-panel hover:bg-accent/20 border border-card-border hover:border-accent/40 text-xs text-slate-200 transition-all flex items-center justify-center space-x-1.5 font-medium"
            >
              {isCapturing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-cyan" />
                  <span>Capturando...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Capturar Tela</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenWindowPicker}
              className="p-2 rounded-xl bg-panel hover:bg-brand-cyan/20 border border-card-border hover:border-brand-cyan/40 text-xs text-slate-200 transition-all flex items-center justify-center space-x-1.5 font-medium"
            >
              <AppWindow className="w-3.5 h-3.5 text-accent-light" />
              <span>Escolher Janela</span>
            </button>
          </div>

          {/* Captured Preview */}
          {capturedAttachment && (
            <div className="relative rounded-xl border border-brand-cyan/40 bg-black/40 p-2 flex items-center space-x-2">
              <img
                src={capturedAttachment.previewUrl}
                alt="Captured"
                className="w-12 h-12 object-cover rounded-lg border border-card-border"
              />
              <div className="flex-1 overflow-hidden">
                <span className="text-[11px] font-semibold text-brand-cyan block truncate">
                  Janela Capturada
                </span>
                <span className="text-[10px] text-slate-400 block truncate font-mono">
                  Pronta para inspeção
                </span>
              </div>
              <button
                onClick={() => setCapturedAttachment(null)}
                className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-rose-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Input Box */}
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Instrução (ex: 'corrija os erros do VS Code')..."
              className="w-full bg-background border border-card-border rounded-xl pl-3 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSend}
              disabled={!prompt.trim() && !capturedAttachment}
              className="absolute right-1.5 top-1.5 p-1 rounded-lg bg-accent hover:bg-accent-hover text-white disabled:bg-card-border disabled:text-slate-600 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
