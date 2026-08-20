import React, { useState, useEffect } from 'react';
import { X, Monitor, AppWindow, RefreshCw, Check, Eye } from 'lucide-react';
import { WindowSource } from '../types';
import { api } from '../api';

interface WindowPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWindow: (windowId: string, windowName: string) => void;
}

export const WindowPickerModal: React.FC<WindowPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectWindow,
}) => {
  const [windows, setWindows] = useState<WindowSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWindows = async () => {
    setIsLoading(true);
    try {
      const list = await api.listWindows();
      setWindows(list);
    } catch {
      setWindows([{ id: 'primary', name: 'Tela Inteira', processName: 'desktop', title: 'Tela Inteira' }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWindows();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-cyan/20 border border-brand-cyan/30 flex items-center justify-center">
              <Eye className="w-4 h-4 text-brand-cyan" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Escolha a Janela para Compartilhar com a IA</h3>
              <p className="text-[11px] text-slate-400">Selecione o VS Code, Navegador ou Tela para inspeção visual de erros e código.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchWindows}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-slate-200 transition-colors"
              title="Atualizar lista de janelas abertas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Windows Grid / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-card-border">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Detectando janelas ativas...
            </div>
          ) : windows.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhuma janela detectada. Você pode capturar a tela inteira.
            </div>
          ) : (
            windows.map((win) => {
              const isPrimary = win.id === 'primary';
              return (
                <div
                  key={win.id}
                  onClick={() => {
                    onSelectWindow(win.id, win.title);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl border border-card-border bg-panel hover:bg-card-border/50 hover:border-brand-cyan cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3 overflow-hidden pr-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isPrimary 
                        ? 'bg-accent/20 border border-accent/30 text-accent-light' 
                        : 'bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan'
                    }`}>
                      {isPrimary ? (
                        <Monitor className="w-5 h-5" />
                      ) : (
                        <AppWindow className="w-5 h-5" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <span className="font-semibold text-xs text-slate-100 block truncate">
                        {win.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {win.processName ? `Processo: ${win.processName}.exe` : 'Desktop'}
                      </span>
                    </div>
                  </div>

                  <button className="px-3 py-1 rounded-lg bg-card group-hover:bg-brand-cyan group-hover:text-black font-semibold text-xs text-slate-300 border border-card-border group-hover:border-transparent transition-all shrink-0">
                    Capturar
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
