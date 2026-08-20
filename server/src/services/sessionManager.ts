import fs from 'fs';
import path from 'path';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  routineId?: string;
  messages: any[];
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
  public static getSessionsDir(projectPath: string): string {
    const dir = path.join(projectPath, '.agentic', 'sessions');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static listSessions(projectPath: string): Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    model: string;
    messageCount: number;
    preview: string;
  }> {
    const dir = this.getSessionsDir(projectPath);
    const files = fs.readdirSync(dir);
    const sessions: any[] = [];

    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const fullPath = path.join(dir, f);
        const data = fs.readFileSync(fullPath, 'utf-8');
        const session: ChatSession = JSON.parse(data);
        const firstUserMsg = session.messages.find(m => m.role === 'user');
        const preview = firstUserMsg ? firstUserMsg.content.slice(0, 80) : 'Conversa vazia';

        sessions.push({
          id: session.id,
          title: session.title || preview.slice(0, 30) || 'Novo Chat',
          createdAt: session.createdAt,
          updatedAt: session.updatedAt || session.createdAt,
          model: session.model,
          messageCount: session.messages.length,
          preview
        });
      } catch {
        // ignore corrupted file
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public static getSession(projectPath: string, sessionId: string): ChatSession | null {
    const filePath = path.join(this.getSessionsDir(projectPath), `${sessionId}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  public static saveSession(projectPath: string, session: ChatSession): ChatSession {
    const dir = this.getSessionsDir(projectPath);
    const filePath = path.join(dir, `${session.id}.json`);

    if (!session.title || session.title === 'Novo Chat') {
      const firstUserMsg = session.messages.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.content) {
        session.title = firstUserMsg.content.slice(0, 35) + (firstUserMsg.content.length > 35 ? '...' : '');
      }
    }

    session.updatedAt = Date.now();
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    return session;
  }

  public static deleteSession(projectPath: string, sessionId: string): boolean {
    const filePath = path.join(this.getSessionsDir(projectPath), `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  public static searchMessages(projectPath: string, query: string): MessageSearchResult[] {
    const dir = this.getSessionsDir(projectPath);
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir);
    const results: MessageSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

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

    return results;
  }
}
