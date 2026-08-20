import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Play, Square, RefreshCw, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { TerminalTask } from '../types';
import { api } from '../api';

export const TerminalView: React.FC = () => {
  const [commandInput, setCommandInput] = useState<string>('');
  const [tasks, setTasks] = useState<TerminalTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchTasks = async () => {
    try {
      const taskList = await api.getTerminalTasks();
      setTasks(taskList);
      if (taskList.length > 0 && !activeTaskId) {
        setActiveTaskId(taskList[taskList.length - 1].id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tasks, activeTaskId]);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || isRunning) return;

    const cmd = commandInput.trim();
    setCommandInput('');
    setIsRunning(true);

    try {
      const res = await api.runCommand(cmd);
      fetchTasks();
      setActiveTaskId(res.taskId);
    } catch (err: any) {
      alert(`Erro ao executar comando: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKill = async (taskId: string) => {
    try {
      await api.killTask(taskId);
      fetchTasks();
    } catch (err: any) {
      alert(`Erro ao encerrar processo: ${err.message}`);
    }
  };

  const activeTask = tasks.find(t => t.id === activeTaskId) || tasks[tasks.length - 1];

  return (
    <div className="h-full flex flex-col bg-[#0c0e14] text-slate-200">
      {/* Terminal Header & Quick Launchers */}
      <div className="h-11 border-b border-card-border bg-sidebar px-3 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="w-3.5 h-3.5 text-brand-amber" />
          <span className="text-xs font-semibold text-slate-100">Terminal Integrado</span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => api.launchExternalTerminal('claude')}
            className="px-2 py-0.5 rounded bg-panel hover:bg-card-border border border-card-border text-[10px] text-accent-light font-mono"
            title="Abrir Claude Code em janela externa"
          >
            Claude CLI
          </button>
          <button
            onClick={() => api.launchExternalTerminal('gemini')}
            className="px-2 py-0.5 rounded bg-panel hover:bg-card-border border border-card-border text-[10px] text-brand-cyan font-mono"
            title="Abrir Gemini CLI em janela externa"
          >
            Gemini CLI
          </button>
          <button
            onClick={() => api.launchExternalTerminal('powershell')}
            className="px-2 py-0.5 rounded bg-panel hover:bg-card-border border border-card-border text-[10px] text-slate-300 font-mono"
            title="Abrir PowerShell na pasta do projeto"
          >
            PowerShell
          </button>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-card-border bg-black/60">
        {activeTask ? (
          <>
            <div className="text-[11px] text-slate-400 pb-2 border-b border-card-border/50 flex items-center justify-between">
              <div>
                <span className="text-brand-cyan">$ {activeTask.command}</span>
                <span className="text-slate-500 text-[10px] ml-2">({activeTask.cwd})</span>
              </div>
              <div className="flex items-center space-x-2">
                {activeTask.status === 'running' ? (
                  <>
                    <span className="text-amber-400 text-[10px] flex items-center">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Rodando
                    </span>
                    <button
                      onClick={() => handleKill(activeTask.id)}
                      className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-[10px] flex items-center space-x-1"
                    >
                      <Square className="w-2.5 h-2.5" />
                      <span>Encerrar</span>
                    </button>
                  </>
                ) : activeTask.status === 'completed' ? (
                  <span className="text-emerald-400 text-[10px] flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Código: {activeTask.exitCode}
                  </span>
                ) : (
                  <span className="text-rose-400 text-[10px] flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" /> Falha
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 whitespace-pre-wrap leading-relaxed text-slate-300">
              {activeTask.logs.join('') || '_Nenhuma saída gerada._'}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs">
            Nenhum comando executado recentemente. Digite um comando abaixo para rodar no projeto.
          </div>
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Terminal Input Bar */}
      <form onSubmit={handleRun} className="p-2 border-t border-card-border bg-sidebar flex items-center space-x-2">
        <span className="text-brand-amber font-mono text-xs pl-1">$</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Ex: npm run build, npm test, git status..."
          className="flex-1 bg-panel border border-card-border rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!commandInput.trim() || isRunning}
          className="p-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white disabled:bg-card-border disabled:text-slate-500 transition-colors"
          title="Executar comando"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
      </form>
    </div>
  );
};
