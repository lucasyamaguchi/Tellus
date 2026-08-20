import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  BookOpen, 
  CheckCircle, 
  ShieldAlert, 
  ArrowRightLeft, 
  Save, 
  Plus, 
  RefreshCw,
  Sparkles,
  FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MemoryPage } from '../types';
import { api } from '../api';

interface MemoryInspectorProps {
  activeMemoryPage: MemoryPage | null;
  activeContext: string;
  onRefreshMemory: () => void;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({
  activeMemoryPage,
  activeContext,
  onRefreshMemory,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCreatingHandoff, setIsCreatingHandoff] = useState<boolean>(false);

  useEffect(() => {
    if (activeMemoryPage) {
      setEditorContent(activeMemoryPage.content);
    } else {
      setEditorContent(activeContext);
    }
    setIsEditing(false);
  }, [activeMemoryPage, activeContext]);

  const handleSaveActiveContext = async () => {
    setIsSaving(true);
    try {
      if (!activeMemoryPage || activeMemoryPage.filename === 'active_context.md') {
        await api.updateActiveContext(editorContent);
      } else {
        await api.writeMemoryPage({
          category: activeMemoryPage.category,
          filename: activeMemoryPage.filename,
          title: activeMemoryPage.title,
          content: editorContent,
          tags: activeMemoryPage.tags
        });
      }
      setIsEditing(false);
      onRefreshMemory();
    } catch (err: any) {
      alert(`Erro ao salvar memória: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickHandoff = async () => {
    setIsCreatingHandoff(true);
    try {
      await api.createHandoff({
        fromModel: 'User / Interface',
        summary: 'Snapshot manual gerado na interface para preservar o estado antes de troca de contexto.',
        nextSteps: ['Continuar execução da tarefa conforme active_context.md']
      });
      onRefreshMemory();
      alert('Snapshot de Handoff criado com sucesso em .agentic/memory/handoffs/!');
    } catch (err: any) {
      alert(`Erro ao gerar handoff: ${err.message}`);
    } finally {
      setIsCreatingHandoff(false);
    }
  };

  const currentTitle = activeMemoryPage ? activeMemoryPage.title : '🎯 Active Context (Estado Atual)';

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Header Bar */}
      <div className="h-11 border-b border-card-border bg-panel px-4 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-2 text-xs">
          <Brain className="w-4 h-4 text-brand-cyan" />
          <span className="font-semibold text-slate-100 truncate max-w-[200px]">
            {currentTitle}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleQuickHandoff}
            disabled={isCreatingHandoff}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-card hover:bg-card-border border border-card-border text-[11px] text-brand-emerald transition-all"
            title="Criar snapshot de Handoff para transição entre modelos"
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span>Gerar Handoff</span>
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2.5 py-1 rounded-md bg-card hover:bg-card-border border border-card-border text-[11px] text-slate-300 transition-all"
          >
            {isEditing ? 'Visualizar' : 'Editar Markdown'}
          </button>

          {isEditing && (
            <button
              onClick={handleSaveActiveContext}
              disabled={isSaving}
              className="flex items-center space-x-1 px-3 py-1 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-card-border">
        {isEditing ? (
          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            className="w-full h-full min-h-[400px] bg-background border border-card-border rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-accent resize-none leading-relaxed"
            placeholder="Edite a memória em Markdown..."
          />
        ) : (
          <div className="prose prose-invert max-w-none text-xs leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {editorContent || activeContext || '_Nenhum conteúdo gravado nesta página._'}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-card-border bg-panel/50 text-[10px] text-slate-400 flex items-center justify-between">
        <span>Local: <code className="text-slate-300">.agentic/memory/</code></span>
        <span>Versionável via Git</span>
      </div>
    </div>
  );
};
