import React, { useState, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { 
  Save, 
  Check, 
  RefreshCw, 
  History, 
  Sparkles, 
  Wand2, 
  Bot, 
  X, 
  Maximize2, 
  Minimize2, 
  WrapText, 
  MapPin, 
  Code2, 
  Settings2,
  FileCode,
  Copy,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';
import { MaterialFileIcon } from './MaterialFileIcon';

export interface TellusCodeStudioProps {
  filePath: string | null;
  openFiles?: string[];
  onSelectFile?: (path: string) => void;
  onCloseFile?: (path: string) => void;
  onFileSaved?: () => void;
  onOpenHistory?: () => void;
  onAskAI?: (prompt: string, filePath?: string) => void;
}

export const TellusCodeStudio: React.FC<TellusCodeStudioProps> = ({
  filePath,
  openFiles = [],
  onSelectFile,
  onCloseFile,
  onFileSaved,
  onOpenHistory,
  onAskAI
}) => {
  // File contents cache: { [filePath]: { content: string, original: string, isDirty: boolean } }
  const [fileContents, setFileContents] = useState<{ [path: string]: { content: string; original: string; isDirty: boolean } }>({});
  const [activeFile, setActiveFile] = useState<string | null>(filePath);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [formatSuccess, setFormatSuccess] = useState<boolean>(false);
  const [formatOnSave, setFormatOnSave] = useState<boolean>(true);
  
  // Editor view options (VS Code toggles)
  const [minimapEnabled, setMinimapEnabled] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [fontSize, setFontSize] = useState<number>(13);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [showAiMenu, setShowAiMenu] = useState<boolean>(false);

  const editorRef = useRef<any>(null);

  // Sync activeFile with prop
  useEffect(() => {
    if (filePath && filePath !== activeFile) {
      setActiveFile(filePath);
    }
  }, [filePath]);

  // Load file content when activeFile changes
  useEffect(() => {
    if (!activeFile) return;

    // Check if already in cache
    if (fileContents[activeFile]) return;

    setIsLoading(true);
    api.readFile(activeFile)
      .then((res) => {
        const loadedContent = res.content || '';
        setFileContents(prev => ({
          ...prev,
          [activeFile]: {
            content: loadedContent,
            original: loadedContent,
            isDirty: false
          }
        }));
      })
      .catch((err) => {
        setFileContents(prev => ({
          ...prev,
          [activeFile]: {
            content: `// Erro ao carregar arquivo: ${err.message}`,
            original: '',
            isDirty: false
          }
        }));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeFile]);

  // Current active file's state
  const currentItem = activeFile ? fileContents[activeFile] : null;
  const currentContent = currentItem ? currentItem.content : '';
  const isDirty = currentItem ? currentItem.isDirty : false;

  // Handle Code Change
  const handleContentChange = (newVal: string | undefined) => {
    if (!activeFile) return;
    const val = newVal || '';
    setFileContents(prev => {
      const orig = prev[activeFile]?.original || '';
      return {
        ...prev,
        [activeFile]: {
          content: val,
          original: orig,
          isDirty: val !== orig
        }
      };
    });
  };

  // Format with Prettier
  const handleFormatPrettier = async () => {
    if (!activeFile || isFormatting) return;
    setIsFormatting(true);
    try {
      const res = await api.formatCode(currentContent, activeFile);
      if (res && res.formatted) {
        handleContentChange(res.formatted);
        setFormatSuccess(true);
        setTimeout(() => setFormatSuccess(false), 2000);
      }
    } catch (err: any) {
      console.warn('Prettier format warning:', err.message);
    } finally {
      setIsFormatting(false);
    }
  };

  // Save File (with optional Prettier formatOnSave)
  const handleSave = async () => {
    if (!activeFile || isSaving) return;
    setIsSaving(true);
    try {
      let contentToSave = currentContent;
      if (formatOnSave) {
        try {
          const res = await api.formatCode(contentToSave, activeFile);
          if (res && res.formatted) {
            contentToSave = res.formatted;
            handleContentChange(contentToSave);
          }
        } catch {
          // Fallback to unformatted if syntax error
        }
      }

      await api.writeFile(activeFile, contentToSave);
      setFileContents(prev => ({
        ...prev,
        [activeFile]: {
          content: contentToSave,
          original: contentToSave,
          isDirty: false
        }
      }));

      setSaveSuccess(true);
      if (onFileSaved) onFileSaved();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`Erro ao salvar arquivo: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Monaco Editor Mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track Cursor Line & Column
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });

    // Custom Keybinding: Shift + Alt + F => Format Prettier
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        handleFormatPrettier();
      }
    );

    // Custom Keybinding: Ctrl + S / Cmd + S => Save
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        handleSave();
      }
    );
  };

  const getLanguage = (path: string | null): string => {
    if (!path) return 'typescript';
    const lower = path.toLowerCase();
    if (lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.ts')) return 'typescript';
    if (lower.endsWith('.jsx')) return 'javascript';
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 'markdown';
    if (lower.endsWith('.css')) return 'css';
    if (lower.endsWith('.scss')) return 'scss';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.rs')) return 'rust';
    if (lower.endsWith('.go')) return 'go';
    if (lower.endsWith('.sql')) return 'sql';
    if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.ps1')) return 'shell';
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
    return 'plaintext';
  };

  const getFileName = (path: string | null): string => {
    if (!path) return '';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  const tabsList = openFiles.length > 0 
    ? openFiles 
    : (activeFile ? [activeFile] : []);

  // Empty State
  if (!activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-4 bg-[#141821]">
        <div className="w-14 h-14 rounded-2xl bg-card-border/30 border border-card-border flex items-center justify-center text-slate-400">
          <Code2 className="w-8 h-8 stroke-1 text-accent-light" />
        </div>
        <div className="max-w-xs space-y-1">
          <p className="text-sm font-semibold text-slate-200">Tellus Code Studio</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Selecione qualquer arquivo no explorador lateral para editar com Monaco, Prettier e Material Icons.
          </p>
        </div>
        <div className="flex items-center space-x-2 pt-2">
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-card-border bg-card hover:bg-card-hover text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm"
            >
              <History className="w-3.5 h-3.5 text-accent-light" />
              <span>Ver Histórico Git</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Breadcrumbs segments
  const breadcrumbs = activeFile.split(/[\\/]/).filter(Boolean);

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] select-none font-sans overflow-hidden">
      {/* 1. Multi-Tab File Bar (VS Code Style) */}
      <div className="h-9 bg-[#181a1f] border-b border-[#2b2d30] flex items-center overflow-x-auto no-scrollbar shrink-0 px-1">
        {tabsList.map((file) => {
          const isActive = file === activeFile;
          const fname = getFileName(file);
          const tabDirty = fileContents[file]?.isDirty;

          return (
            <div
              key={file}
              onClick={() => {
                setActiveFile(file);
                if (onSelectFile) onSelectFile(file);
              }}
              title={file}
              className={`group flex items-center space-x-2 px-3 h-full border-r border-[#2b2d30] cursor-pointer text-xs transition-colors shrink-0 ${
                isActive
                  ? 'bg-[#1e1e1e] text-white border-t-2 border-t-accent font-medium'
                  : 'bg-[#181a1f] text-slate-400 hover:bg-[#21242b] hover:text-slate-200'
              }`}
            >
              <MaterialFileIcon filename={fname} size={14} />
              <span className="truncate max-w-[140px] text-[12px]">{fname}</span>
              
              {/* Dirty indicator or Close button */}
              {tabDirty ? (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onCloseFile) onCloseFile(file);
                  }}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-card-border/60 text-amber-400 font-bold text-[14px]"
                  title="Arquivo modificado (clique para fechar)"
                >
                  •
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onCloseFile) onCloseFile(file);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/10 text-slate-400 hover:text-white transition-opacity"
                  title="Fechar Aba"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Secondary Breadcrumbs & Quick Toolbar */}
      <div className="h-8 bg-[#1e1e1e] border-b border-[#2b2d30] px-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
        {/* Breadcrumb Path */}
        <div className="flex items-center space-x-1 overflow-hidden pr-2">
          {breadcrumbs.map((seg, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
              <span className={`truncate text-[11px] ${idx === breadcrumbs.length - 1 ? 'text-slate-200 font-mono font-medium' : 'text-slate-500'}`}>
                {seg}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Format with Prettier */}
          <button
            onClick={handleFormatPrettier}
            disabled={isFormatting}
            title="Formatar Código com Prettier (Shift + Alt + F)"
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] transition-colors border ${
              formatSuccess 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                : 'hover:bg-white/10 text-slate-300 border-transparent'
            }`}
          >
            <Sparkles className={`w-3 h-3 ${isFormatting ? 'animate-spin text-accent-light' : 'text-amber-400'}`} />
            <span className="hidden sm:inline font-mono">Prettier</span>
          </button>

          {/* AI Code Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAiMenu(!showAiMenu)}
              title="Ações de IA para este Arquivo"
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] hover:bg-accent/20 text-accent-light font-medium transition-colors border border-accent/30"
            >
              <Bot className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">IA</span>
            </button>

            {showAiMenu && (
              <div 
                className="absolute right-0 top-7 w-56 rounded-xl bg-[#141821] border border-card-border p-1 shadow-2xl z-50 text-xs space-y-0.5 backdrop-blur-md"
                onMouseLeave={() => setShowAiMenu(false)}
              >
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Assistente Tellus
                </div>
                <button
                  onClick={() => {
                    setShowAiMenu(false);
                    if (onAskAI && activeFile) {
                      onAskAI(`Analise o arquivo "${activeFile}" e me dê uma explicação clara e estruturada sobre o que ele faz, suas principais funções e responsabilidades na arquitetura.`, activeFile);
                    }
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2"
                >
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Explicar Arquivo</span>
                </button>
                <button
                  onClick={() => {
                    setShowAiMenu(false);
                    if (onAskAI && activeFile) {
                      onAskAI(`Revise o código em "${activeFile}" e sugira melhorias práticas de arquitetura, legibilidade, tratamento de erros e performance. Mostre o código sugerido.`, activeFile);
                    }
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sugerir Melhorias</span>
                </button>
                <button
                  onClick={() => {
                    setShowAiMenu(false);
                    if (onAskAI && activeFile) {
                      onAskAI(`Faça uma análise crítica no arquivo "${activeFile}" procurando bugs, vulnerabilidades de segurança, edge cases não tratados e erros de tipagem.`, activeFile);
                    }
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-card-hover text-slate-200 flex items-center space-x-2"
                >
                  <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Diagnóstico de Bugs</span>
                </button>
              </div>
            )}
          </div>

          {/* Toggle Word Wrap */}
          <button
            onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
            title={`Quebra de Linha: ${wordWrap === 'on' ? 'Ligada' : 'Desligada'}`}
            className={`p-1 rounded text-xs transition-colors ${
              wordWrap === 'on' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Minimap */}
          <button
            onClick={() => setMinimapEnabled(!minimapEnabled)}
            title={`Minimapa: ${minimapEnabled ? 'Visível' : 'Oculto'}`}
            className={`p-1 rounded text-xs transition-colors ${
              minimapEnabled ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>

          {/* History */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              title="Abrir Histórico Git e Diffs"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-accent-light" />
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            title="Salvar Arquivo (Ctrl + S)"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : isDirty
                ? 'bg-accent hover:bg-accent-hover text-white shadow-sm ring-1 ring-accent-light/40'
                : 'bg-white/10 text-slate-300 hover:bg-white/15'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-3 h-3" />
                <span className="text-[11px]">Salvo</span>
              </>
            ) : isSaving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="text-[11px]">Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span className="text-[11px]">Salvar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Monaco Editor Core Container */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 bg-[#1e1e1e]">
            <RefreshCw className="w-4 h-4 animate-spin mr-2 text-accent-light" />
            <span>Carregando arquivo...</span>
          </div>
        ) : (
          <Editor
            height="100%"
            language={getLanguage(activeFile)}
            theme="vs-dark"
            value={currentContent}
            onChange={handleContentChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize,
              fontFamily: "'Fira Code', 'Consolas', monospace",
              minimap: { enabled: minimapEnabled },
              scrollBeyondLastLine: false,
              wordWrap,
              lineNumbers: 'on',
              tabSize: 2,
              automaticLayout: true,
              bracketPairColorization: { enabled: true },
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              suggestOnTriggerCharacters: true
            }}
          />
        )}
      </div>

      {/* 4. VS Code Status Bar */}
      <div className="h-6 bg-[#007acc] text-white px-3 flex items-center justify-between text-[11px] select-none font-mono shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span className="font-semibold">Tellus Studio</span>
          </div>
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>Espaços: 2</span>
          <span>UTF-8</span>
        </div>

        <div className="flex items-center space-x-3">
          <span 
            onClick={() => setFormatOnSave(!formatOnSave)} 
            className="cursor-pointer hover:underline text-[10px]"
            title="Clique para alternar formatar ao salvar"
          >
            Prettier: {formatOnSave ? '✓ Salvar' : 'Manual'}
          </span>
          <span className="uppercase text-[10px] font-bold bg-white/20 px-1.5 py-0.2 rounded">
            {getLanguage(activeFile)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Backward-compatible alias for CodeViewer
export const CodeViewer = TellusCodeStudio;
