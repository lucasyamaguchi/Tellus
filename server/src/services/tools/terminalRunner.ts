import { spawn, ChildProcess } from 'child_process';
import os from 'os';

export interface TerminalTask {
  id: string;
  command: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  exitCode: number | null;
  startedAt: number;
  completedAt: number | null;
  logs: string[];
}

export class TerminalRunner {
  private static tasks = new Map<string, { task: TerminalTask; process: ChildProcess }>();
  private static listeners = new Set<(event: { taskId: string; type: 'log' | 'status'; data: any }) => void>();

  public static subscribe(listener: (event: { taskId: string; type: 'log' | 'status'; data: any }) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static emit(event: { taskId: string; type: 'log' | 'status'; data: any }) {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        // ignore listener errors
      }
    }
  }

  public static runCommand(
    projectPath: string,
    command: string,
    onLog?: (line: string) => void
  ): Promise<{ taskId: string; exitCode: number | null; output: string }> {
    const taskId = 'task_' + Math.random().toString(36).substring(2, 9);
    const isWindows = os.platform() === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['-NoProfile', '-NonInteractive', '-Command', command] : ['-c', command];

    const task: TerminalTask = {
      id: taskId,
      command,
      cwd: projectPath,
      status: 'running',
      exitCode: null,
      startedAt: Date.now(),
      completedAt: null,
      logs: []
    };

    return new Promise((resolve) => {
      try {
        const proc = spawn(shell, shellArgs, {
          cwd: projectPath,
          env: { ...process.env, FORCE_COLOR: 'true' }
        });

        this.tasks.set(taskId, { task, process: proc });
        this.emit({ taskId, type: 'status', data: task });

        const handleData = (data: Buffer) => {
          const text = data.toString('utf-8');
          task.logs.push(text);
          if (onLog) onLog(text);
          this.emit({ taskId, type: 'log', data: text });
        };

        proc.stdout?.on('data', handleData);
        proc.stderr?.on('data', handleData);

        proc.on('close', (code) => {
          task.status = task.status === 'killed' ? 'killed' : (code === 0 ? 'completed' : 'failed');
          task.exitCode = code;
          task.completedAt = Date.now();
          this.emit({ taskId, type: 'status', data: task });
          resolve({ taskId, exitCode: code, output: task.logs.join('') });
        });

        proc.on('error', (err) => {
          task.status = 'failed';
          const errMsg = `\nErro ao executar processo: ${err.message}\n`;
          task.logs.push(errMsg);
          if (onLog) onLog(errMsg);
          this.emit({ taskId, type: 'log', data: errMsg });
          this.emit({ taskId, type: 'status', data: task });
          resolve({ taskId, exitCode: 1, output: task.logs.join('') });
        });
      } catch (err: any) {
        task.status = 'failed';
        const errMsg = `Erro imediato: ${err.message}`;
        task.logs.push(errMsg);
        this.emit({ taskId, type: 'status', data: task });
        resolve({ taskId, exitCode: 1, output: errMsg });
      }
    });
  }

  public static killTask(taskId: string): boolean {
    const item = this.tasks.get(taskId);
    if (!item) return false;
    item.task.status = 'killed';
    item.task.completedAt = Date.now();
    try {
      item.process.kill();
      return true;
    } catch {
      return false;
    }
  }

  public static getTask(taskId: string): TerminalTask | undefined {
    return this.tasks.get(taskId)?.task;
  }

  public static listTasks(): TerminalTask[] {
    return Array.from(this.tasks.values()).map(v => v.task);
  }
}
