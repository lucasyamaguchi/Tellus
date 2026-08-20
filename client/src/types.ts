export interface OpenRouterModel {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  top_provider?: {
    max_completion_tokens?: number;
  };
}

export interface AppConfig {
  keys: {
    openrouter?: string;
    google?: string;
    anthropic?: string;
    openai?: string;
  };
  defaultModel: string;
  defaultProvider: 'openrouter' | 'google' | 'anthropic' | 'openai';
  recentProjects: string[];
  currentProject?: string;
  customRoutines: Routine[];
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  systemPrompt: string;
}

export interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeItem[];
}

export interface MemoryPage {
  category: 'decisions' | 'procedures' | 'gotchas' | 'handoffs' | 'general';
  filename: string;
  title: string;
  content: string;
  tags?: string[];
  lastModified: number;
}

export interface ProjectOverview {
  path: string;
  name: string;
  activeContext: string;
  memoryPagesCount: number;
  memoryPages: MemoryPage[];
  fileTree: FileTreeItem[];
}

export interface ToolCallItem {
  id: string;
  name: string;
  arguments: string;
  result?: any;
  status: 'running' | 'completed' | 'error';
}

export interface WindowSource {
  id: string;
  name: string;
  processName: string;
  title: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl: string;
  parsedContent?: string;
  isImage: boolean;
  isAudio: boolean;
  isPdf: boolean;
  isCsv: boolean;
}

export interface QuotedMessage {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolCalls?: ToolCallItem[];
  modelUsed?: string;
  timestamp: number;
  attachments?: Attachment[];
  quotedMessage?: QuotedMessage;
}

export interface ChatSessionMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  messageCount: number;
  preview: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  routineId?: string;
  messages: Message[];
}

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
