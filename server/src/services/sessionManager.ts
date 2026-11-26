import fs from 'fs';
import path from 'path';
import { getDefaultConversationsDir } from '../utils/appPaths.js';
import { ConfigManager } from './configManager.js';
import { ProjectManager } from './projectManager.js';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  routineId?: string;
  tokenEfficiency?: boolean;
  pipeline?: any;
  messages: any[];
  isLiveVoice?: boolean;
  liveVoiceMode?: 'voice_only' | 'mixed' | 'voice_output_only';
  executionMode?: 'request_review' | 'default' | 'turbo' | 'inherit';
  isStandalone?: boolean;
  isSkillArchitect?: boolean;
  projectPath?: string;
  projectName?: string;
}

export interface MessageSearchResult {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  matchedSnippet: string;
}

export class SessionManager {
  public static getStandaloneSessionsDir(): string {
    return getDefaultConversationsDir();
  }

  public static getSessionsDir(projectPath?: string | null): string {
    if (!projectPath || projectPath === 'standalone') {
      return this.getStandaloneSessionsDir();
    }
    const dir = path.join(projectPath, '.agentic', 'sessions');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private static normalizePath(p?: string | null): string {
    return (p || '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
  }

  public static listSessions(projectPath?: string | null): Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    model: string;
    messageCount: number;
    preview: string;
    isLiveVoice?: boolean;
    liveVoiceMode?: 'voice_only' | 'mixed' | 'voice_output_only';
    projectPath?: string;
    projectName?: string;
    executionMode?: 'request_review' | 'default' | 'turbo' | 'inherit';
    isStandalone?: boolean;
    isSkillArchitect?: boolean;
  }> {
    const isStandalone = !projectPath || projectPath === 'standalone';
    const dir = this.getSessionsDir(projectPath);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);
    const sessions: any[] = [];
    const currentNorm = !isStandalone && projectPath ? this.normalizePath(projectPath) : '';

    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const fullPath = path.join(dir, f);
        const data = fs.readFileSync(fullPath, 'utf-8');
        const session: ChatSession = JSON.parse(data);

        // Skill Architect Segregation Guard:
        // Skill Architect chats must never reside in a project folder. If found, self-heal to standalone dir.
        if (!isStandalone && (session.isSkillArchitect || session.routineId === 'skill_architect')) {
          try {
            const standaloneDir = this.getStandaloneSessionsDir();
            const rightfulFile = path.join(standaloneDir, `${session.id || path.basename(f, '.json')}.json`);
            session.isStandalone = true;
            session.projectPath = '';
            session.projectName = 'Arquiteto de Skills';
            fs.writeFileSync(rightfulFile, JSON.stringify(session, null, 2), 'utf-8');
            fs.unlinkSync(fullPath);
          } catch {}
          continue;
        }

        // Strict Project Isolation & Cross-Contamination Guard:
        // If scanning a specific project directory, ensure the session doesn't belong to another project
        if (!isStandalone && session.projectPath) {
          const sessionNorm = this.normalizePath(session.projectPath);
          if (sessionNorm && currentNorm && sessionNorm !== currentNorm) {
            // Misplaced session from cloud sync or cloned .agentic folder.
            // Self-healing: ensure it exists in its rightful project directory, then remove from this wrong directory.
            try {
              if (fs.existsSync(session.projectPath)) {
                const rightfulDir = path.join(session.projectPath, '.agentic', 'sessions');
                if (!fs.existsSync(rightfulDir)) {
                  fs.mkdirSync(rightfulDir, { recursive: true });
                }
                const rightfulFile = path.join(rightfulDir, f);
                if (!fs.existsSync(rightfulFile)) {
                  fs.copyFileSync(fullPath, rightfulFile);
                }
                fs.unlinkSync(fullPath);
              }
            } catch {}
            continue;
          }
        }

        // Empty Sessions Hygiene:
        // Do not display empty chats with no messages as "Novo Chat"
        if (!session.messages || session.messages.length === 0) {
          try {
            fs.unlinkSync(fullPath);
          } catch {}
          continue;
        }

        const firstUserMsg = session.messages.find(m => m.role === 'user');
        const preview = firstUserMsg ? firstUserMsg.content.slice(0, 80) : 'Conversa vazia';
        const sessionIsStandalone = session.isStandalone ?? isStandalone;

        sessions.push({
          id: session.id,
          title: session.title || preview.slice(0, 30) || (sessionIsStandalone ? 'Conversa Livre' : 'Novo Chat'),
          createdAt: session.createdAt,
          updatedAt: session.updatedAt || session.createdAt,
          model: session.model,
          messageCount: session.messages.length,
          preview,
          isLiveVoice: !!session.isLiveVoice,
          liveVoiceMode: session.liveVoiceMode || 'mixed',
          projectPath: sessionIsStandalone ? '' : (projectPath || session.projectPath || ''),
          projectName: sessionIsStandalone ? 'Conversa Livre' : (projectPath ? path.basename(projectPath) : (session.projectName || 'Projeto')),
          executionMode: session.executionMode || 'inherit',
          isStandalone: sessionIsStandalone,
          isSkillArchitect: !!session.isSkillArchitect,
          routineId: session.routineId
        });
      } catch {
        // ignore corrupted file
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public static getSession(projectPath: string | null | undefined, sessionId: string): ChatSession | null {
    const dir = this.getSessionsDir(projectPath);
    const filePath = path.join(dir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const session: ChatSession = JSON.parse(data);
        if (!projectPath || projectPath === 'standalone') {
          session.isStandalone = true;
        }
        return session;
      } catch {
        return null;
      }
    }

    // Fallback: try standalone directory
    if (projectPath && projectPath !== 'standalone') {
      const standalonePath = path.join(this.getStandaloneSessionsDir(), `${sessionId}.json`);
      if (fs.existsSync(standalonePath)) {
        try {
          const session: ChatSession = JSON.parse(fs.readFileSync(standalonePath, 'utf-8'));
          session.isStandalone = true;
          return session;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  public static saveSession(projectPath: string | null | undefined, session: ChatSession): ChatSession {
    // Empty Sessions Hygiene:
    // Do not write empty sessions (0 messages) to disk as "Novo Chat"
    if (!session.messages || session.messages.length === 0) {
      return session;
    }

    const isSkillArchitect = !!session.isSkillArchitect || session.routineId === 'skill_architect';
    const isStandalone = isSkillArchitect || !!session.isStandalone || !projectPath || projectPath === 'standalone';
    const dir = this.getSessionsDir(isStandalone ? null : projectPath);
    const filePath = path.join(dir, `${session.id}.json`);

    if (!session.title || session.title === 'Novo Chat' || session.title === 'Nova Conversa Livre') {
      const firstUserMsg = session.messages.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.content) {
        session.title = firstUserMsg.content.slice(0, 35) + (firstUserMsg.content.length > 35 ? '...' : '');
      }
    }

    if (isSkillArchitect) {
      session.isStandalone = true;
      session.isSkillArchitect = true;
      session.routineId = 'skill_architect';
      session.projectPath = '';
      session.projectName = 'Arquiteto de Skills';
    } else if (isStandalone) {
      session.isStandalone = true;
      session.projectPath = '';
      session.projectName = 'Conversa Livre';
    } else if (projectPath) {
      session.isStandalone = false;
      session.projectPath = projectPath;
      session.projectName = path.basename(projectPath);
    }

    session.updatedAt = session.updatedAt || Date.now();
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');

    // If it's a skill architect session, ensure no stale copy remains in any project directory
    if (isSkillArchitect && projectPath && projectPath !== 'standalone') {
      try {
        const staleProjectFile = path.join(projectPath, '.agentic', 'sessions', `${session.id}.json`);
        if (fs.existsSync(staleProjectFile)) {
          fs.unlinkSync(staleProjectFile);
        }
      } catch {}
    }

    return session;
  }

  public static moveSession(sessionId: string, targetProjectPath: string | null | undefined, sourceProjectPath?: string | null): ChatSession | null {
    const standaloneDir = this.getStandaloneSessionsDir();
    let foundFilePath: string | null = null;
    let session: ChatSession | null = null;

    // 0. If explicit sourceProjectPath is provided, look there first
    if (sourceProjectPath && sourceProjectPath !== 'standalone') {
      const pFile = path.join(sourceProjectPath, '.agentic', 'sessions', `${sessionId}.json`);
      if (fs.existsSync(pFile)) {
        foundFilePath = pFile;
        try {
          session = JSON.parse(fs.readFileSync(pFile, 'utf-8'));
        } catch {
          session = null;
        }
      }
    }

    // 1. Check standalone directory
    if (!session) {
      const standaloneFilePath = path.join(standaloneDir, `${sessionId}.json`);
      if (fs.existsSync(standaloneFilePath)) {
        foundFilePath = standaloneFilePath;
        try {
          session = JSON.parse(fs.readFileSync(standaloneFilePath, 'utf-8'));
        } catch {
          session = null;
        }
      }
    }

    // 2. If not found in standalone, search all known project session dirs
    if (!session) {
      const config = ConfigManager.getConfig();
      const currentPath = ProjectManager.getCurrentProject();
      const allPaths = Array.from(new Set([
        currentPath,
        ...(config.openProjects || []),
        ...(config.recentProjects || [])
      ])).filter(p => p && fs.existsSync(p));

      for (const p of allPaths) {
        const pFile = path.join(p, '.agentic', 'sessions', `${sessionId}.json`);
        if (fs.existsSync(pFile)) {
          foundFilePath = pFile;
          try {
            session = JSON.parse(fs.readFileSync(pFile, 'utf-8'));
            if (session) break;
          } catch {
            session = null;
          }
        }
      }
    }

    if (!session || !foundFilePath) {
      return null;
    }

    // 3. Determine target directory
    const isTargetStandalone = !targetProjectPath || targetProjectPath === 'standalone' || targetProjectPath === '';
    const targetDir = isTargetStandalone ? standaloneDir : path.join(targetProjectPath, '.agentic', 'sessions');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (isTargetStandalone) {
      session.isStandalone = true;
      session.projectPath = '';
      session.projectName = session.isSkillArchitect ? 'Arquiteto de Skills' : 'Conversa Livre';
    } else {
      session.isStandalone = false;
      session.projectPath = targetProjectPath;
      session.projectName = path.basename(targetProjectPath);
      session.isSkillArchitect = false; // When moved to a project, it transforms into that project's chat
    }

    session.updatedAt = Date.now();
    const targetFilePath = path.join(targetDir, `${sessionId}.json`);
    fs.writeFileSync(targetFilePath, JSON.stringify(session, null, 2), 'utf-8');

    // If target is different from source, unlink source
    if (path.resolve(foundFilePath).toLowerCase() !== path.resolve(targetFilePath).toLowerCase()) {
      try {
        fs.unlinkSync(foundFilePath);
      } catch {}
    }

    return session;
  }

  public static deleteSession(projectPath: string | null | undefined, sessionId: string): boolean {
    let deletedAny = false;

    // 1. Check specified project dir
    const filePath = path.join(this.getSessionsDir(projectPath), `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deletedAny = true;
      } catch {}
    }

    // 2. Check standalone dir
    const standalonePath = path.join(this.getStandaloneSessionsDir(), `${sessionId}.json`);
    if (fs.existsSync(standalonePath)) {
      try {
        fs.unlinkSync(standalonePath);
        deletedAny = true;
      } catch {}
    }

    // 3. Purge from all known projects to guarantee zero zombie sessions / resurrection
    try {
      const config = ConfigManager.getConfig();
      const currentPath = ProjectManager.getCurrentProject();
      const allPaths = Array.from(new Set([
        currentPath,
        ...(config.openProjects || []),
        ...(config.recentProjects || [])
      ])).filter(p => p && fs.existsSync(p));

      for (const p of allPaths) {
        const pFile = path.join(p, '.agentic', 'sessions', `${sessionId}.json`);
        if (fs.existsSync(pFile)) {
          try {
            fs.unlinkSync(pFile);
            deletedAny = true;
          } catch {}
        }
      }
    } catch {}

    return deletedAny;
  }

  public static searchMessages(projectPath: string | null | undefined, query: string): MessageSearchResult[] {
    const dirsToSearch: string[] = [];
    const standaloneDir = this.getStandaloneSessionsDir();
    if (fs.existsSync(standaloneDir)) dirsToSearch.push(standaloneDir);

    if (projectPath && projectPath !== 'standalone') {
      const projDir = this.getSessionsDir(projectPath);
      if (fs.existsSync(projDir) && projDir !== standaloneDir) dirsToSearch.push(projDir);
    }

    const results: MessageSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const dir of dirsToSearch) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);

      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const fullPath = path.join(dir, f);
          const session: ChatSession = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

          for (const msg of session.messages) {
            if (!msg.content) continue;
            if (msg.content.toLowerCase().includes(lowerQuery) || query.trim() === '') {
              results.push({
                sessionId: session.id,
                sessionTitle: session.title,
                messageId: msg.id || `${session.id}_${msg.timestamp}`,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp || session.updatedAt,
                matchedSnippet: msg.content.slice(0, 150)
              });
              if (results.length >= 30) break;
            }
          }
        } catch {
          // ignore
        }
        if (results.length >= 30) break;
      }
      if (results.length >= 30) break;
    }

    return results;
  }
}
