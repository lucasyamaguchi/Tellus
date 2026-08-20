import React, { useState, useEffect } from 'react';
import { X, Search, MessageSquareQuote, Quote, Clock, ArrowRight, User, Bot } from 'lucide-react';
import { api } from '../api';
import { QuotedMessage } from '../types';

interface MentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuote: (quote: QuotedMessage) => void;
}

export const MentionModal: React.FC<MentionModalProps> = ({
  isOpen,
  onClose,
  onSelectQuote,
}) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    api.searchMessages(search)
      .then(res => setResults(res))
      .catch(() => setResults([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-cyan/20 border border-brand-cyan/30 flex items-center justify-center">
              <MessageSquareQuote className="w-4 h-4 text-brand-cyan" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Citar Mensagem de Outro Chat</h3>
              <p className="text-[11px] text-slate-400">Conecte ideias e histórico de outras conversas neste chat.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-card-border bg-panel">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar mensagem por palavra-chave ou ver histórico..."
              className="w-full bg-background border border-card-border rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
        </div>

        {/* Messages Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-card-border">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Buscando mensagens...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhuma mensagem encontrada. Inicie mais conversas para que elas apareçam aqui.
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.messageId}
                onClick={() => {
                  onSelectQuote({
                    sessionId: item.sessionId,
                    sessionTitle: item.sessionTitle,
                    messageId: item.messageId,
                    role: item.role,
                    content: item.content,
                    timestamp: item.timestamp
                  });
                  onClose();
                }}
                className="p-3.5 rounded-xl border border-card-border bg-panel hover:bg-card-border/50 hover:border-accent cursor-pointer transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-brand-cyan">💬 {item.sessionTitle}</span>
                    <span>•</span>
                    <span className="flex items-center">
                      {item.role === 'user' ? (
                        <User className="w-3 h-3 mr-1 text-slate-300" />
                      ) : (
                        <Bot className="w-3 h-3 mr-1 text-accent-light" />
                      )}
                      {item.role === 'user' ? 'Você' : 'Agente'}
                    </span>
                  </div>
                  <span className="flex items-center">
                    <Clock className="w-2.5 h-2.5 mr-1" />
                    {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-slate-200 line-clamp-3 font-mono leading-relaxed bg-background/50 p-2 rounded-lg border border-card-border/60">
                  "{item.content}"
                </p>

                <div className="flex justify-end pt-1">
                  <span className="text-[10px] text-accent-light group-hover:underline flex items-center font-medium">
                    Citar nesta conversa <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
