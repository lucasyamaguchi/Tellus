import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Save, FileCode, Check, RefreshCw } from 'lucide-react';
import { api } from '../api';

interface CodeViewerProps {
  filePath: string | null;
  onFileSaved?: () => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ filePath, onFileSaved }) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!filePath) {
      setContent('');
      return;
    }

    setIsLoading(true);
    api.readFile(filePath)
      .then((res) => {
        setContent(res.content || '');
      })
      .catch((err) => {
        setContent(`// Erro ao carregar arquivo: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [filePath]);

  const handleSave = async () => {
    if (!filePath) return;
    setIsSaving(true);
    try {
      await api.writeFile(filePath, content);
      setSaveSuccess(true);
      if (onFileSaved) onFileSaved();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`Erro ao salvar arquivo: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguage = (path: string | null): string => {
    if (!path) return 'typescript';
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.go')) return 'go';
    if (path.endsWith('.sql')) return 'sql';
    return 'plaintext';
  };

  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-3 bg-panel">
        <FileCode className="w-10 h-10 stroke-1 text-slate-600" />
        <div>
          <p className="text-xs font-medium text-slate-400">Nenhum arquivo aberto</p>
          <p className="text-[11px] text-slate-500">Selecione um arquivo no explorador lateral para visualizar e editar o código.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Top File Bar */}
      <div className="h-10 border-b border-card-border bg-sidebar px-3 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2 text-xs text-slate-300 font-mono">
          <FileCode className="w-3.5 h-3.5 text-accent-light" />
          <span className="font-medium text-slate-100">{filePath}</span>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            saveSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-accent hover:bg-accent-hover text-white shadow-sm'
          }`}
        >
          {saveSuccess ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Salvo!</span>
            </>
          ) : isSaving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Salvar</span>
            </>
          )}
        </button>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Carregando arquivo...
          </div>
        ) : (
          <Editor
            height="100%"
            language={getLanguage(filePath)}
            theme="vs-dark"
            value={content}
            onChange={(val) => setContent(val || '')}
            options={{
              fontSize: 13,
              fontFamily: "'Fira Code', 'Consolas', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              tabSize: 2,
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
};
