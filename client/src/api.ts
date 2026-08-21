import { 
  AppConfig, 
  OpenRouterModel, 
  ProjectOverview, 
  FileTreeItem, 
  MemoryPage, 
  TerminalTask, 
  Message, 
  Attachment,
  ChatSessionMetadata,
  ChatSession,
  QuotedMessage,
  OpenRouterCredits,
  FrankNote,
  GraphData,
  TellusSkill,
  TellusArtifact
} from './types';

const API_BASE = '/api';

export const api = {
  // Config
  async getConfig(): Promise<AppConfig> {
    const res = await fetch(`${API_BASE}/config`);
    return res.json();
  },

  async updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },

  // Models
  async getModels(): Promise<{ curated: OpenRouterModel[]; all: OpenRouterModel[] }> {
    const res = await fetch(`${API_BASE}/models`);
    return res.json();
  },

  // Projects
  async getCurrentProject(): Promise<ProjectOverview> {
    const res = await fetch(`${API_BASE}/projects/current`);
    return res.json();
  },

  async openProject(path: string): Promise<ProjectOverview> {
    const res = await fetch(`${API_BASE}/projects/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    return res.json();
  },

  // Files
  async getFileTree(): Promise<FileTreeItem[]> {
    const res = await fetch(`${API_BASE}/files/tree`);
    return res.json();
  },

  async readFile(path: string): Promise<{ content: string; size: number }> {
    const res = await fetch(`${API_BASE}/files/read?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async writeFile(path: string, content: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content })
    });
    return res.json();
  },

  // Multimodal File Uploads & Screen Capture
  async uploadFiles(files: Array<{ name: string; type: string; base64: string }>): Promise<Attachment[]> {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    const data = await res.json();
    return data.attachments || [];
  },

  async listWindows(): Promise<Array<{ id: string; name: string; processName: string; title: string }>> {
    const res = await fetch(`${API_BASE}/screen/windows`);
    return res.json();
  },

  async captureScreen(windowId?: string): Promise<Attachment> {
    const res = await fetch(`${API_BASE}/screen/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId })
    });
    const data = await res.json();
    return data.attachment;
  },

  async launchExternalTerminal(agent?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/terminal/launch-external`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent })
    });
    return res.json();
  },

  // OpenRouter Credits & Usage
  async getOpenRouterCredits(): Promise<OpenRouterCredits> {
    const res = await fetch(`${API_BASE}/openrouter/credits`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao consultar créditos' }));
      throw new Error(err.error || 'Falha ao consultar créditos');
    }
    return res.json();
  },

  // FrankMD Notes & Knowledge Graph
  async listNotes(): Promise<FrankNote[]> {
    const res = await fetch(`${API_BASE}/notes`);
    return res.json();
  },

  async saveNote(data: { id?: string; title: string; subject?: string; content: string; isProjectSpecific?: boolean }): Promise<FrankNote> {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async generateNoteFromChat(data: { messages: Message[]; sessionTitle?: string; model?: string }): Promise<{ success: boolean; note: FrankNote }> {
    const res = await fetch(`${API_BASE}/notes/generate-from-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao criar nota' }));
      throw new Error(err.error || 'Falha ao sintetizar nota');
    }
    return res.json();
  },

  async deleteNote(id: string, isProjectSpecific?: boolean): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/notes/${id}?isProjectSpecific=${!!isProjectSpecific}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async getNotesGraph(): Promise<GraphData> {
    const res = await fetch(`${API_BASE}/notes/graph`);
    return res.json();
  },

  // Skills & Artifacts
  async listSkills(): Promise<TellusSkill[]> {
    const res = await fetch(`${API_BASE}/skills`);
    return res.json();
  },

  async saveSkill(skill: Partial<TellusSkill>): Promise<TellusSkill> {
    const res = await fetch(`${API_BASE}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill)
    });
    return res.json();
  },

  async deleteSkill(id: string, isProjectSpecific?: boolean): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/skills/${id}?isProjectSpecific=${!!isProjectSpecific}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async listArtifacts(): Promise<TellusArtifact[]> {
    const res = await fetch(`${API_BASE}/artifacts`);
    return res.json();
  },

  async saveArtifact(data: { title: string; content: string; type?: string; filename?: string }): Promise<TellusArtifact> {
    const res = await fetch(`${API_BASE}/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async listSessions(): Promise<ChatSessionMetadata[]> {
    const res = await fetch(`${API_BASE}/sessions`);
    return res.json();
  },

  async getSession(id: string): Promise<ChatSession> {
    const res = await fetch(`${API_BASE}/sessions/${id}`);
    return res.json();
  },

  async saveSession(session: Partial<ChatSession>): Promise<ChatSession> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    return res.json();
  },

  async deleteSession(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/sessions/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async searchMessages(query: string): Promise<Array<{
    sessionId: string;
    sessionTitle: string;
    messageId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    matchedSnippet: string;
  }>> {
    const res = await fetch(`${API_BASE}/sessions/search-messages?query=${encodeURIComponent(query)}`);
    return res.json();
  },

  // Memory (ai-memory)
  async getMemory(): Promise<{ activeContext: string; pages: MemoryPage[] }> {
    const res = await fetch(`${API_BASE}/memory`);
    return res.json();
  },

  async updateActiveContext(content: string): Promise<{ success: boolean; activeContext: string }> {
    const res = await fetch(`${API_BASE}/memory/active-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    return res.json();
  },

  async writeMemoryPage(page: { category: string; filename: string; title: string; content: string; tags?: string[] }): Promise<MemoryPage> {
    const res = await fetch(`${API_BASE}/memory/write-page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(page)
    });
    return res.json();
  },

  async createHandoff(handoff: { fromModel: string; summary: string; nextSteps?: string[]; openQuestions?: string[] }): Promise<MemoryPage> {
    const res = await fetch(`${API_BASE}/memory/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(handoff)
    });
    return res.json();
  },

  // Terminal
  async runCommand(command: string): Promise<{ taskId: string; exitCode: number; output: string }> {
    const res = await fetch(`${API_BASE}/terminal/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return res.json();
  },

  async killTask(taskId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/terminal/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    return res.json();
  },

  async getTerminalTasks(): Promise<TerminalTask[]> {
    const res = await fetch(`${API_BASE}/terminal/tasks`);
    return res.json();
  },

  // Chat stream
  streamChat(
    messages: Array<{ role: string; content: string }>,
    model: string,
    provider: string,
    routineId?: string,
    onEvent?: (event: { type: string; data: any }) => void,
    onDone?: () => void,
    onError?: (err: any) => void
  ) {
    const controller = new AbortController();

    fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, provider, routineId }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.text();
          throw new Error(err);
        }

        const reader = response.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = 'message';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.replace('event:', '').trim();
            } else if (trimmed.startsWith('data:')) {
              try {
                const data = JSON.parse(trimmed.replace('data:', '').trim());
                if (currentEvent === 'done') {
                  if (onDone) onDone();
                } else if (currentEvent === 'error') {
                  if (onError) onError(data);
                } else {
                  if (onEvent) onEvent({ type: currentEvent, data });
                }
              } catch {
                // ignore
              }
            }
          }
        }
        if (onDone) onDone();
      })
      .catch((err) => {
        if (onError) onError(err);
      });

    return () => controller.abort();
  }
};
