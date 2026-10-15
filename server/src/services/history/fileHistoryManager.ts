import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as Diff from 'diff';

export interface FileChangeEntry {
  id: string;
  filePath: string;
  action: 'create' | 'modify' | 'delete';
  timestamp: number;
  sessionId?: string;
  sessionTitle?: string;
  messageId?: string;
  reason?: string;
  linesAdded: number;
  linesRemoved: number;
  lineRange?: { start: number; end: number };
  diff: string;
  oldContent?: string;
  newContent?: string;
}

export interface GitDiffFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
  diff: string;
  insertions: number;
  deletions: number;
}

export class FileHistoryManager {
  public static getHistoryDir(projectPath: string): string {
    const dir = path.join(projectPath, '.agentic', 'history');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getHistoryFilePath(projectPath: string): string {
    return path.join(this.getHistoryDir(projectPath), 'file_changes.json');
  }

  public static getChanges(projectPath: string, sessionId?: string): FileChangeEntry[] {
    const filePath = this.getHistoryFilePath(projectPath);
    let entries: FileChangeEntry[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        entries = JSON.parse(raw);
      } catch (err) {
        console.error('[FileHistoryManager] Erro ao ler file_changes.json:', err);
      }
    }

    // Auto-backfill from chat sessions if empty or incomplete
    if (entries.length === 0) {
      entries = this.syncFromChatSessions(projectPath);
    }

    if (sessionId) {
      return entries.filter(e => e.sessionId === sessionId);
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  public static getChangeById(projectPath: string, changeId: string): FileChangeEntry | null {
    const list = this.getChanges(projectPath);
    return list.find(c => c.id === changeId) || null;
  }

  public static recordChange(projectPath: string, entry: Omit<FileChangeEntry, 'id' | 'timestamp'> & { timestamp?: number }): FileChangeEntry {
    const list = this.getChanges(projectPath);
    const newEntry: FileChangeEntry = {
      ...entry,
      id: `chg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || Date.now()
    };

    list.unshift(newEntry);

    // Keep max 200 entries to prevent file bloat
    const trimmed = list.slice(0, 200);

    const historyFile = this.getHistoryFilePath(projectPath);
    try {
      fs.writeFileSync(historyFile, JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch (err) {
      console.error('[FileHistoryManager] Erro ao salvar histórico:', err);
    }

    return newEntry;
  }

  public static revertChange(projectPath: string, changeId: string): { success: boolean; message: string } {
    const change = this.getChangeById(projectPath, changeId);
    if (!change) {
      throw new Error(`Alteração ${changeId} não encontrada no histórico.`);
    }

    const fullPath = path.resolve(projectPath, change.filePath);
    if (!fullPath.startsWith(path.resolve(projectPath))) {
      throw new Error(`Caminho inválido: ${change.filePath}`);
    }

    if (change.action === 'create') {
      // If was newly created, reverting means deleting
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return { success: true, message: `Arquivo ${change.filePath} removido (reversão de criação).` };
      }
    } else if (change.oldContent !== undefined) {
      fs.writeFileSync(fullPath, change.oldContent, 'utf-8');
      return { success: true, message: `Arquivo ${change.filePath} restaurado para o estado anterior.` };
    }

    throw new Error(`Não foi possível reverter a alteração: conteúdo anterior não disponível.`);
  }

  /**
   * Scans .agentic/sessions/*.json to backfill historical changes made in past chats
   */
  public static syncFromChatSessions(projectPath: string): FileChangeEntry[] {
    const sessionsDir = path.join(projectPath, '.agentic', 'sessions');
    if (!fs.existsSync(sessionsDir)) return [];

    const discovered: FileChangeEntry[] = [];
    try {
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const full = path.join(sessionsDir, file);
        try {
          const content = fs.readFileSync(full, 'utf-8');
          const session = JSON.parse(content);
          if (!session.messages || !Array.isArray(session.messages)) continue;

          for (const msg of session.messages) {
            if (msg.role !== 'assistant' || !msg.toolCalls || !Array.isArray(msg.toolCalls)) continue;

            for (const tc of msg.toolCalls) {
              const name = tc.name?.replace(/^(frank_|tellus_)/, '');
              if (name === 'write_file' || name === 'edit_file') {
                let args: any = {};
                try {
                  args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
                } catch {
                  continue;
                }

                if (!args.path) continue;

                let linesAdded = 0;
                let linesRemoved = 0;
                let diffText = '';

                if (name === 'edit_file') {
                  const targetLines = (args.target_content || '').split('\n');
                  const repLines = (args.replacement_content || '').split('\n');
                  linesRemoved = targetLines.length;
                  linesAdded = repLines.length;
                  diffText = [
                    `--- a/${args.path}`,
                    `+++ b/${args.path}`,
                    `@@ -1,${linesRemoved} +1,${linesAdded} @@`,
                    ...targetLines.map((l: string) => `-${l}`),
                    ...repLines.map((l: string) => `+${l}`)
                  ].join('\n');
                } else {
                  const fileLines = (args.content || '').split('\n');
                  linesAdded = fileLines.length;
                  diffText = [
                    `--- a/${args.path}`,
                    `+++ b/${args.path}`,
                    `@@ -0,0 +1,${linesAdded} @@`,
                    ...fileLines.slice(0, 50).map((l: string) => `+${l}`),
                    fileLines.length > 50 ? `+... [${fileLines.length - 50} linhas adicionais]` : ''
                  ].filter(Boolean).join('\n');
                }

                discovered.push({
                  id: `chg_sync_${tc.id || Math.random().toString(36).substring(2, 7)}`,
                  filePath: args.path,
                  action: name === 'edit_file' ? 'modify' : 'create',
                  timestamp: msg.timestamp || session.updatedAt || Date.now(),
                  sessionId: session.id,
                  sessionTitle: session.title || 'Conversa sem título',
                  messageId: msg.id,
                  reason: args.description || args.reason || `Alteração via comando ${name} no chat`,
                  linesAdded,
                  linesRemoved,
                  diff: diffText,
                  newContent: args.content || args.replacement_content
                });
              }
            }
          }
        } catch {
          // ignore broken file
        }
      }

      if (discovered.length > 0) {
        const historyFile = this.getHistoryFilePath(projectPath);
        fs.writeFileSync(historyFile, JSON.stringify(discovered, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('[FileHistoryManager] Erro ao sincronizar sessões de chat:', err);
    }

    return discovered;
  }

  /**
   * Computes clean diff stats and line range between two strings
   */
  public static computeDiff(
    filePath: string,
    oldContent: string,
    newContent: string,
    contextLines = 3
  ): {
    diff: string;
    linesAdded: number;
    linesRemoved: number;
    lineRange: { start: number; end: number };
  } {
    const changes = Diff.diffLines(oldContent || '', newContent || '');
    let linesAdded = 0;
    let linesRemoved = 0;
    let currentLine = 1;
    let firstDiffLine = -1;
    let lastDiffLine = -1;

    for (const part of changes) {
      const count = part.count || 0;
      if (part.added) {
        linesAdded += count;
        if (firstDiffLine === -1) firstDiffLine = currentLine;
        lastDiffLine = currentLine + count - 1;
        currentLine += count;
      } else if (part.removed) {
        linesRemoved += count;
        if (firstDiffLine === -1) firstDiffLine = currentLine;
        lastDiffLine = Math.max(lastDiffLine, currentLine);
      } else {
        currentLine += count;
      }
    }

    if (firstDiffLine === -1) {
      firstDiffLine = 1;
      lastDiffLine = 1;
    }

    const cleanPath = filePath.replace(/^[/\\]+/, '');
    const diff = Diff.createTwoFilesPatch(
      `a/${cleanPath}`,
      `b/${cleanPath}`,
      oldContent || '',
      newContent || '',
      '',
      '',
      { context: contextLines }
    );

    return {
      diff,
      linesAdded,
      linesRemoved,
      lineRange: {
        start: firstDiffLine,
        end: Math.max(firstDiffLine, lastDiffLine)
      }
    };
  }

  /**
   * Retrieves live uncommitted git diffs for the project
   */
  public static getGitDiff(projectPath: string): { files: GitDiffFile[]; branch: string; isGitRepo: boolean } {
    try {
      // Check if git repo
      execSync('git rev-parse --is-inside-work-tree', { cwd: projectPath, stdio: ['ignore', 'pipe', 'pipe'] });

      let branch = 'unknown';
      try {
        branch = execSync('git branch --show-current', { cwd: projectPath, encoding: 'utf-8' }).trim();
      } catch {
        // ignore
      }

      const statusOutput = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8' });
      const lines = statusOutput.split('\n').filter(l => l.trim().length > 0);

      const files: GitDiffFile[] = [];

      for (const line of lines) {
        const statusCode = line.substring(0, 2).trim();
        const rawFilePath = line.substring(3).trim();

        let status: 'modified' | 'added' | 'deleted' | 'untracked' = 'modified';
        if (statusCode === '??') status = 'untracked';
        else if (statusCode.includes('A')) status = 'added';
        else if (statusCode.includes('D')) status = 'deleted';

        let diff = '';
        let insertions = 0;
        let deletions = 0;

        try {
          if (status !== 'untracked') {
            diff = execSync(`git diff -- "${rawFilePath}"`, { cwd: projectPath, encoding: 'utf-8' });
            for (const dl of diff.split('\n')) {
              if (dl.startsWith('+') && !dl.startsWith('+++')) insertions++;
              if (dl.startsWith('-') && !dl.startsWith('---')) deletions++;
            }
          } else {
            // For untracked files, show preview
            const fullPath = path.join(projectPath, rawFilePath);
            if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
              const fileContent = fs.readFileSync(fullPath, 'utf-8');
              const clines = fileContent.split('\n');
              insertions = clines.length;
              diff = [
                `--- /dev/null`,
                `+++ b/${rawFilePath}`,
                `@@ -0,0 +1,${clines.length} @@`,
                ...clines.slice(0, 50).map(l => `+${l}`),
                clines.length > 50 ? `+... [mais ${clines.length - 50} linhas]` : ''
              ].filter(Boolean).join('\n');
            }
          }
        } catch {
          // ignore diff failure
        }

        files.push({
          path: rawFilePath,
          status,
          diff,
          insertions,
          deletions
        });
      }

      return { files, branch, isGitRepo: true };
    } catch {
      return { files: [], branch: '', isGitRepo: false };
    }
  }
}

export const fileHistoryManager = FileHistoryManager;
