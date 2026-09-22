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

export interface AgentPipelineConfig {
  primaryModel: string;
  plannerModel?: string;
  codingModel?: string;
  reasoningModel?: string;
  fastToolsModel?: string;
}

export interface AppConfig {
  keys: {
    openrouter?: string;
    google?: string;
    anthropic?: string;
    openai?: string;
    fishAudio?: string;
  };
  voiceSettings?: {
    provider?: 'system' | 'fish-audio';
    fishAudioVoiceId?: string;
    fishAudioModel?: string;
  };
  defaultModel: string;
  defaultProvider: 'openrouter' | 'google' | 'anthropic' | 'openai';
  recentProjects: string[];
  openProjects?: string[];
  currentProject?: string;
  customRoutines: Routine[];
  pipeline?: AgentPipelineConfig;
  theme?: 'dark' | 'light';
  deletedNotesRetention?: '30_days' | '90_days' | '120_days' | '1_year' | 'never';
}

export interface DeletedNoteItem {
  id: string;
  title: string;
  backupFilename: string;
  originalFolder: string;
  deletedAt: number;
  size: number;
  content: string;
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

export interface OpenRouterCredits {
  totalCredits: number;
  totalUsage: number;
  remainingCredits: number;
}

export interface FrankNote {
  id: string;
  title: string;
  filename: string;
  folder?: string;
  subject: string;
  tags: string[];
  content: string;
  links: string[];
  backlinks: string[];
  createdAt: number;
  updatedAt: number;
  isProjectSpecific?: boolean;
  relativePath?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'subject' | 'tag' | 'skill' | 'category' | 'agent' | 'project' | 'module' | 'memory' | 'routine' | string;
  val: number;
  color?: string;
  details?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'wikilink' | 'tag' | 'subject' | 'skill_category' | 'skill_agent' | 'synergy' | 'proj_module' | 'proj_memory' | 'proj_routine' | string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface IncomingDropzoneFile {
  name: string;
  type: string;
  size: number;
  base64Data: string;
}

export interface OrganizedFileResult {
  id: string;
  originalName: string;
  savedName: string;
  targetFolder: string;
  fullRelativePath: string;
  fileType: 'pdf' | 'image' | 'text' | 'code' | 'spreadsheet' | 'other';
  size: number;
  reason: string;
  summary: string;
  tags: string[];
  success: boolean;
  error?: string;
}

export interface DropzoneOrganizeReport {
  sessionId: string;
  timestamp: number;
  totalFiles: number;
  successfulCount: number;
  failedCount: number;
  vaultPath: string;
  reportNotePath?: string;
  results: OrganizedFileResult[];
}

export interface TellusSkill {
  id: string;
  name: string;
  category: string;
  agentAssigned?: string;
  description: string;
  promptInstructions: string;
  isProjectSpecific?: boolean;
  isActive?: boolean;
  updatedAt: number;
}

export interface TellusArtifact {
  id: string;
  title: string;
  type: 'plan' | 'walkthrough' | 'diff' | 'diagram' | 'report' | 'code';
  filename: string;
  content: string;
  relativePath: string;
  isGlobal?: boolean;
  createdAt: number;
  updatedAt: number;
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
  tokenEfficiency?: boolean;
  pipeline?: AgentPipelineConfig;
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

export interface NoteSearchResult {
  note: FrankNote;
  score: number;
  matchedSnippets: string[];
}

export interface GitSafeAuditItem {
  category: 'gitignore' | 'environment' | 'tracked_secrets' | 'binaries';
  name: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'info';
  details: string;
}

export interface GitSafeAuditReport {
  timestamp: string;
  isSafe: boolean;
  score: number;
  items: GitSafeAuditItem[];
  summary: string;
}

export interface SanitizationResult {
  sanitized: string;
  redactedCount: number;
  detectedTypes: string[];
}

