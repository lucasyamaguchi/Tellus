import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { ConfigManager } from './services/configManager.js';
import { OpenRouterService } from './services/providers/openrouter.js';
import { ProjectManager } from './services/projectManager.js';
import { MemoryEngine } from './services/memory/memoryEngine.js';
import { MemoryPalace } from './services/memory/memoryPalace.js';
import { FileTools } from './services/tools/fileTools.js';
import { FileParser } from './services/tools/fileParser.js';
import { ScreenCapture } from './services/tools/screenCapture.js';
import { TerminalRunner } from './services/tools/terminalRunner.js';
import { SessionManager } from './services/sessionManager.js';
import { AgentLoop, sanitizePortugueseText } from './services/agentLoop.js';
import { TellusNoteEngine, TelluNoteEngine } from './services/notes/tellusNoteEngine.js';
import { SmartOrganizer } from './services/notes/smartOrganizer.js';
import { SkillManager } from './services/skills/skillManager.js';
import { ProviderHub } from './services/providers/providerHub.js';
import { PrivacySanitizer } from './services/security/privacySanitizer.js';
import { ObsidianPluginManager } from './services/obsidian/obsidianPluginManager.js';
import { ProjectSettingsManager } from './services/projectSettingsManager.js';
import { FileHistoryManager } from './services/history/fileHistoryManager.js';
import { normalizeVoiceVocabulary } from './utils/voiceVocabulary.js';
import { CloudSyncEngine } from './services/sync/cloudSyncEngine.js';
import { SecurityShield } from './services/sync/securityShield.js';
import prettier from 'prettier';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.get('/api/notes/attachments/:filename', (req, res) => {
  const filePath = path.join(TellusNoteEngine.ATTACHMENTS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Anexo não encontrado' });
  }
});

// 1. Config Endpoints
app.get('/api/config', (req, res) => {
  try {
    const config = ConfigManager.getConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const updated = ConfigManager.updateConfig(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Models Catalog (OpenRouter + Direct Providers)
app.get('/api/models', async (req, res) => {
  try {
    const config = ConfigManager.getConfig();
    let openRouterModels: any[] = [];
    try {
      openRouterModels = await OpenRouterService.listModels(config.keys.openrouter);
    } catch {
      // Fallback if key missing or network offline
    }

    const curatedProviders = [
      {
        id: 'anthropic/claude-3.7-sonnet',
        name: 'Claude 3.7 Sonnet',
        provider: 'Anthropic',
        description: 'Capacidade de raciocínio híbrido e excelência em engenharia de software.',
        context_length: 200000,
        pricing: { prompt: '0.000003', completion: '0.000015' }
      },
      {
        id: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        description: 'Modelo de raciocínio de alta performance para lógica complexa e debugging.',
        context_length: 128000,
        pricing: { prompt: '0.00000055', completion: '0.00000219' }
      },
      {
        id: 'google/gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash',
        provider: 'Google',
        description: 'Velocidade extrema e janela de contexto gigantesca de 1 milhão de tokens.',
        context_length: 1048576,
        pricing: { prompt: '0.0000001', completion: '0.0000004' }
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        description: 'Modelo multimodal flagship da OpenAI com forte capacidade de codificação.',
        context_length: 128000,
        pricing: { prompt: '0.0000025', completion: '0.00001' }
      },
      {
        id: 'openai/o3-mini',
        name: 'o3-mini',
        provider: 'OpenAI',
        description: 'Raciocínio avançado rápido para matemática, código e ciências.',
        context_length: 200000,
        pricing: { prompt: '0.0000011', completion: '0.0000044' }
      }
    ];

    const cached = OpenRouterService.getCachedModels();
    res.json({
      curated: curatedProviders,
      all: openRouterModels.length > 0 ? openRouterModels : cached.models,
      lastUpdated: cached.lastUpdated,
      newModels: cached.newModels || []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const handleModelsRefresh = async (req: express.Request, res: express.Response) => {
  try {
    const config = ConfigManager.getConfig();
    const result = await OpenRouterService.refreshModels(config.keys.openrouter);

    const curatedProviders = [
      {
        id: 'anthropic/claude-3.7-sonnet',
        name: 'Claude 3.7 Sonnet',
        provider: 'Anthropic',
        description: 'Capacidade de raciocínio híbrido e excelência em engenharia de software.',
        context_length: 200000,
        pricing: { prompt: '0.000003', completion: '0.000015' }
      },
      {
        id: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        description: 'Modelo de raciocínio de alta performance para lógica complexa e debugging.',
        context_length: 128000,
        pricing: { prompt: '0.00000055', completion: '0.00000219' }
      },
      {
        id: 'google/gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash',
        provider: 'Google',
        description: 'Velocidade extrema e janela de contexto gigantesca de 1 milhão de tokens.',
        context_length: 1048576,
        pricing: { prompt: '0.0000001', completion: '0.0000004' }
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        description: 'Modelo multimodal flagship da OpenAI com forte capacidade de codificação.',
        context_length: 128000,
        pricing: { prompt: '0.0000025', completion: '0.00001' }
      },
      {
        id: 'openai/o3-mini',
        name: 'o3-mini',
        provider: 'OpenAI',
        description: 'Raciocínio avançado rápido para matemática, código e ciências.',
        context_length: 200000,
        pricing: { prompt: '0.0000011', completion: '0.0000044' }
      }
    ];

    res.json({
      success: true,
      totalCount: result.totalCount,
      newCount: result.newCount,
      newModels: result.newModels,
      updatedAt: result.updatedAt,
      curated: curatedProviders,
      all: result.models
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/models/refresh', handleModelsRefresh);
app.get('/api/models/refresh', handleModelsRefresh);

// 3. Projects Endpoints
app.get('/api/projects/current', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const overview = ProjectManager.getProjectOverview(currentPath);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/open-list', (req, res) => {
  try {
    const openProjects = ProjectManager.getOpenProjects();
    const overviews = openProjects.map(p => ProjectManager.getProjectOverview(p));
    res.json(overviews);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/pick-directory', async (req, res) => {
  try {
    const picked = await ProjectManager.pickDirectory();
    res.json({ path: picked });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/open', (req, res) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) {
      return res.status(400).json({ error: 'Caminho do projeto é obrigatório' });
    }
    const result = ProjectManager.openProject(projectPath);
    const overview = ProjectManager.getProjectOverview(result.path);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/close', (req, res) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) {
      return res.status(400).json({ error: 'Caminho do projeto é obrigatório' });
    }
    const result = ProjectManager.closeOpenProject(projectPath);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3.1 Project Settings & Execution Security Endpoints
app.get('/api/project/settings', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const settings = ProjectSettingsManager.getSettings(targetPath);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/project/settings', (req, res) => {
  try {
    const targetPath = (req.body.projectPath as string) || ProjectManager.getCurrentProject();
    const settings = req.body.settings || req.body;
    const updated = ProjectSettingsManager.saveSettings(targetPath, settings);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/project/effective-security', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const chatMode = req.query.chatMode as any;
    const effective = ProjectSettingsManager.resolveEffectiveSecurity(chatMode, targetPath);
    res.json(effective);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. File Explorer Endpoints
app.get('/api/files/tree', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const tree = FileTools.getFileTree(currentPath);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/read', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'Parâmetro path é obrigatório' });
    }
    const result = FileTools.readFile(currentPath, filePath);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/files/write', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'path e content são obrigatórios' });
    }
    const result = FileTools.writeFile(currentPath, filePath, content);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Format Code via Prettier (VS Code Standard)
app.post('/api/code/format', async (req, res) => {
  try {
    const { content, path: filePath, options } = req.body;
    if (content === undefined) {
      return res.status(400).json({ error: 'Conteúdo obrigatório para formatação' });
    }

    let parser: string | undefined = undefined;
    const lower = (filePath || '').toLowerCase();
    if (lower.endsWith('.ts')) parser = 'typescript';
    else if (lower.endsWith('.tsx')) parser = 'typescript';
    else if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) parser = 'babel';
    else if (lower.endsWith('.jsx')) parser = 'babel';
    else if (lower.endsWith('.json')) parser = 'json';
    else if (lower.endsWith('.css')) parser = 'css';
    else if (lower.endsWith('.scss')) parser = 'scss';
    else if (lower.endsWith('.html') || lower.endsWith('.htm')) parser = 'html';
    else if (lower.endsWith('.md') || lower.endsWith('.mdx')) parser = 'markdown';
    else if (lower.endsWith('.yaml') || lower.endsWith('.yml')) parser = 'yaml';

    const prettierConfig = {
      semi: true,
      singleQuote: true,
      trailingComma: 'es5' as const,
      tabWidth: 2,
      printWidth: 100,
      filepath: filePath || 'file.ts',
      ...(parser ? { parser } : {}),
      ...(options || {})
    };

    const formatted = await prettier.format(content, prettierConfig);
    res.json({ formatted, changed: formatted !== content });
  } catch (err: any) {
    console.warn('[Prettier API] Erro ao formatar:', err.message);
    res.status(422).json({ error: err.message || 'Falha ao formatar com Prettier' });
  }
});

// Delete file or directory (from File Explorer Context Menu)
app.post('/api/files/delete', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { path: relPath } = req.body;
    if (!relPath) return res.status(400).json({ error: 'path é obrigatório' });
    const fullPath = path.resolve(currentPath, relPath);
    if (!fullPath.startsWith(path.resolve(currentPath))) {
      return res.status(403).json({ error: 'Acesso negado fora do projeto' });
    }
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Arquivo ou pasta não encontrado' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4.1 File Change History & Live Git Diff Endpoints
app.get('/api/history/changes', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const sessionId = req.query.sessionId as string | undefined;
    const changes = FileHistoryManager.getChanges(currentPath, sessionId);
    res.json(changes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/changes/:id', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const change = FileHistoryManager.getChangeById(currentPath, req.params.id);
    if (!change) {
      return res.status(404).json({ error: 'Alteração não encontrada' });
    }
    res.json(change);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/history/revert', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { changeId } = req.body;
    if (!changeId) {
      return res.status(400).json({ error: 'changeId é obrigatório' });
    }
    const result = FileHistoryManager.revertChange(currentPath, changeId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/git-diff', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const diff = FileHistoryManager.getGitDiff(currentPath);
    res.json(diff);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Memory Endpoints (ai-memory wiki)
app.get('/api/memory', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const activeContext = MemoryEngine.getActiveContext(currentPath);
    const pages = MemoryEngine.listMemoryPages(currentPath);
    res.json({ activeContext, pages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memory/active-context', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { content } = req.body;
    MemoryEngine.updateActiveContext(currentPath, content);
    res.json({ success: true, activeContext: content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memory/write-page', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { category, filename, title, content, tags } = req.body;
    const page = MemoryEngine.writeMemoryPage(currentPath, category, filename, title, content, tags);
    res.json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memory/handoff', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { fromModel, summary, nextSteps, openQuestions } = req.body;
    const page = MemoryEngine.createHandoff(currentPath, fromModel || 'User', summary, nextSteps, openQuestions);
    res.json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5.1 Palácio de Memória (Memory Palace: Builds, Commits, Test Runs & Context)
app.get('/api/palace/overview', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const overview = MemoryPalace.getPalaceOverview(targetPath);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/palace/builds', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const builds = MemoryPalace.listBuilds(targetPath);
    res.json(builds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/palace/builds', (req, res) => {
  try {
    const targetPath = (req.body.projectPath as string) || ProjectManager.getCurrentProject();
    const record = MemoryPalace.recordBuild(targetPath, req.body);
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/palace/commits', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const sync = req.query.sync === 'true';
    const commits = sync ? MemoryPalace.syncGitHistory(targetPath) : MemoryPalace.listCommits(targetPath);
    res.json(commits);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/palace/commits', (req, res) => {
  try {
    const targetPath = (req.body.projectPath as string) || ProjectManager.getCurrentProject();
    const record = MemoryPalace.recordCommit(targetPath, req.body);
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/palace/test-runs', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const testRuns = MemoryPalace.listTestRuns(targetPath);
    res.json(testRuns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/palace/test-runs', (req, res) => {
  try {
    const targetPath = (req.body.projectPath as string) || ProjectManager.getCurrentProject();
    const record = MemoryPalace.recordTestRun(targetPath, req.body);
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/palace/export-markdown', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const markdown = MemoryPalace.exportPalaceMarkdown(targetPath);
    res.json({ markdown });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5.2 Plugins do Obsidian (Compatibilidade, Importação e Gerenciamento)
app.get('/api/obsidian/plugins', (req, res) => {
  try {
    const customVaultDir = req.query.customVaultDir as string;
    const plugins = ObsidianPluginManager.listInstalledPlugins(customVaultDir);
    res.json(plugins);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/obsidian/plugins/recommendations', (req, res) => {
  try {
    const customVaultDir = req.query.customVaultDir as string;
    const recs = ObsidianPluginManager.listCuratedRecommendations(customVaultDir);
    res.json(recs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/obsidian/plugins/toggle', (req, res) => {
  try {
    const { pluginId, enabled, customVaultDir } = req.body;
    if (!pluginId || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'pluginId e enabled são obrigatórios' });
    }
    ObsidianPluginManager.togglePlugin(pluginId, enabled, customVaultDir);
    res.json({ success: true, pluginId, enabled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/obsidian/plugins/import', (req, res) => {
  try {
    const { sourceDir, customVaultDir } = req.body;
    if (!sourceDir) {
      return res.status(400).json({ error: 'sourceDir é obrigatório' });
    }
    const plugin = ObsidianPluginManager.importPluginFromDir(sourceDir, customVaultDir);
    res.json({ success: true, plugin });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/obsidian/plugins/install-github', async (req, res) => {
  try {
    const { repo, customVaultDir } = req.body;
    if (!repo) {
      return res.status(400).json({ error: 'repo (ex: blacksmithgu/obsidian-dataview) é obrigatório' });
    }
    const plugin = await ObsidianPluginManager.installPluginFromGitHub(repo, customVaultDir);
    res.json({ success: true, plugin });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GitSafe Privacy & Secrets Sanitization Core
app.get('/api/security/audit', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const report = PrivacySanitizer.auditGitSafe(currentPath);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/security/sanitize', (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Campo "text" deve ser uma string' });
    }
    const result = PrivacySanitizer.sanitizeText(text);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Multimodal File Uploads & Screen / Window Capture
app.get('/api/screen/windows', (req, res) => {
  try {
    const windows = ScreenCapture.listOpenWindows();
    res.json(windows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/screen/capture', async (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { windowId } = req.body || {};
    const capture = await ScreenCapture.captureScreen(currentPath, windowId);
    res.json({ success: true, attachment: capture });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/upload', async (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { files } = req.body; // Array of { name, type, base64 }
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Array de arquivos obrigatório' });
    }

    const processed = [];
    for (const f of files) {
      const result = await FileParser.processUpload(currentPath, f.name, f.type, f.base64);
      processed.push(result);
    }

    res.json({ success: true, attachments: processed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Launch External CLI Agent Terminal
app.post('/api/terminal/launch-external', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { agent } = req.body; // 'claude' | 'gemini' | 'agy' | 'codex' | 'powershell' | 'cmd'
    
    let commandToRun = '';
    if (agent === 'claude') {
      commandToRun = 'claude';
    } else if (agent === 'gemini') {
      commandToRun = 'gemini';
    } else if (agent === 'agy' || agent === 'antigravity') {
      commandToRun = 'agy';
    } else if (agent === 'codex') {
      commandToRun = 'codex';
    } else if (agent === 'aider') {
      commandToRun = 'aider';
    }

    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const execString = commandToRun 
        ? `start powershell.exe -NoExit -Command "Set-Location '${currentPath}'; Write-Host '🚀 Iniciando ${agent} no projeto atual...' -ForegroundColor Cyan; ${commandToRun}"`
        : `start powershell.exe -NoExit -Command "Set-Location '${currentPath}'; Write-Host 'Terminal aberto em: ${currentPath}' -ForegroundColor Green"`;
      
      const { exec } = require('child_process');
      exec(execString);
    }

    res.json({ success: true, message: `Terminal externo aberto para ${agent || 'projeto'}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fish Audio Text-to-Speech (TTS) Proxy
app.post('/api/voice/fish-audio/tts', async (req, res) => {
  try {
    const { text, reference_id, model } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Texto não informado para síntese.' });
    }

    const config = ConfigManager.getConfig();
    const apiKey = req.body.apiKey || config.keys.fishAudio;
    if (!apiKey) {
      return res.status(400).json({ error: 'Chave da Fish Audio não configurada.' });
    }

    const voiceId = reference_id || config.voiceSettings?.fishAudioVoiceId || '82d13948027e4be69892dd3d0104e681';
    const selectedModel = model || config.voiceSettings?.fishAudioModel || 's2.1-pro-free';

    const fishResponse = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': selectedModel
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3',
        latency: 'normal'
      })
    });

    if (!fishResponse.ok) {
      const errText = await fishResponse.text().catch(() => '');
      console.error('[FishAudio TTS Error]', fishResponse.status, errText);
      return res.status(fishResponse.status).json({ error: `Fish Audio error (${fishResponse.status}): ${errText}` });
    }

    const arrayBuffer = await fishResponse.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[FishAudio TTS Exception]', err);
    res.status(500).json({ error: err.message || 'Erro ao sintetizar voz com Fish Audio' });
  }
});

// OpenRouter Credits & Usage Monitor
app.get('/api/openrouter/credits', async (req, res) => {
  try {
    const config = ConfigManager.getConfig();
    const apiKey = config.keys.openrouter;
    if (!apiKey) {
      return res.status(400).json({ error: 'Chave da OpenRouter não configurada' });
    }
    const credits = await OpenRouterService.getCredits(apiKey);
    res.json(credits);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Falha ao consultar saldo da OpenRouter' });
  }
});

// TellusMD (antigo FrankMD) Note Taker & Knowledge Graph
app.get('/api/notes', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const notes = TellusNoteEngine.listNotes(currentPath);
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const note = TellusNoteEngine.saveNote(req.body, currentPath);

    // Background Auto-Sync if Cloud Sync or Peer LAN Sync is enabled
    try {
      const cfg = ConfigManager.getConfig();
      setImmediate(() => {
        try {
          if (cfg.syncConfig?.enabled && cfg.syncConfig?.autoSync) {
            CloudSyncEngine.syncNow();
          }
          if (cfg.syncConfig?.peerSyncEnabled && cfg.syncConfig?.peerSyncUrl) {
            CloudSyncEngine.syncWithPeerDevice(cfg.syncConfig.peerSyncUrl).catch(() => {});
          }
        } catch {}
      });
    } catch {}

    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Zero-LLM BM25-Lite Weighted Fast Search over Notes
app.post('/api/notes/search', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { query, folder, limit } = req.body;
    const results = TellusNoteEngine.searchNotes(query || '', { folder, limit }, currentPath);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Folders Management Routes (Declared BEFORE :id to prevent route hijacking)
app.get('/api/notes/folders', (req, res) => {
  try {
    const folders = TellusNoteEngine.listFolders();
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/folders', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    }
    const success = TellusNoteEngine.createFolder(name.trim());
    res.json({ success, name: name.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/folders/move', (req, res) => {
  try {
    const { sourceFolder, targetParentFolder } = req.body;
    if (!sourceFolder) {
      return res.status(400).json({ error: 'sourceFolder é obrigatório' });
    }
    const success = TellusNoteEngine.moveFolder(sourceFolder, targetParentFolder || '');
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/folders', (req, res) => {
  try {
    const folderName = (req.query.name as string) || req.body?.name;
    if (!folderName) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    }
    const currentPath = ProjectManager.getCurrentProject();
    const result = TellusNoteEngine.deleteFolder(folderName, currentPath);

    // Auto-sync Active Context: if current project's active_context.md references this deleted folder/study,
    // clear the stale reference so AI never presumes notes/modules exist.
    try {
      const activeCtx = MemoryEngine.getActiveContext(currentPath);
      const cleanFolder = folderName.replace(/[-_/]/g, ' ').toLowerCase();
      if (activeCtx.toLowerCase().includes(folderName.toLowerCase()) || activeCtx.toLowerCase().includes(cleanFolder)) {
        const cleanedCtx = `# 🎯 Active Context & Estado do Projeto\n\n## 📌 Objetivo Atual\n- O usuário excluiu o diretório/caderno "${folderName}".\n\n## 📂 Arquivos em Foco\n- Nenhum arquivo ativo no momento (notas anteriores foram excluídas).\n\n## 🚀 Progresso Recente\n- [x] Limpeza e remoção do material antigo para permitir novo plano do zero.\n\n## ⚡ Próximos Passos Imediatos\n- Quando o usuário solicitar, crie notas ATIVAS NOVAS do zero usando 'note_save'.\n`;
        MemoryEngine.updateActiveContext(currentPath, cleanedCtx);
      }
    } catch {}

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/upload-attachment', (req, res) => {
  try {
    const { filename, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Nenhum dado de imagem ou arquivo fornecido' });
    }
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const attachment = TellusNoteEngine.saveAttachment(filename || 'imagem.png', buffer);
    res.json(attachment);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Falha ao salvar anexo da nota' });
  }
});

app.post('/api/notes/import-notion', (req, res) => {
  try {
    const { items } = req.body; // Array<{ filename: string; content: string; folder?: string }>
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Lista de notas para importar é inválida' });
    }
    const result = TellusNoteEngine.importNotionNotes(items);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notes/graph', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const graphData = TellusNoteEngine.getGraphData(currentPath);
    res.json(graphData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dropzone Smart Auto-Organizer Endpoint (Multimodal & Brain Dump)
app.post('/api/vault/dropzone-organize', async (req, res) => {
  try {
    const { files, textDump, customVaultDir, targetProjectPath, defaultSkillScope } = req.body;
    const hasFiles = Array.isArray(files) && files.length > 0;
    const hasText = typeof textDump === 'string' && textDump.trim().length > 0;

    if (!hasFiles && !hasText) {
      return res.status(400).json({ error: 'Nenhum arquivo ou texto enviado para organização.' });
    }
    const currentProject = targetProjectPath || ProjectManager.getCurrentProject();
    const report = await SmartOrganizer.organize({ 
      files: hasFiles ? files : [], 
      textDump: hasText ? textDump : '', 
      customVaultDir,
      targetProjectPath: currentProject,
      defaultSkillScope
    });
    res.json(report);
  } catch (err: any) {
    console.error('[Dropzone Organize Error]', err);
    res.status(500).json({ error: err.message || 'Falha ao organizar arquivos e ideias na dropzone' });
  }
});

// Skills Graph Endpoint
app.get('/api/skills/graph', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const graphData = SkillManager.getSkillsGraphData(targetPath);
    res.json(graphData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Projects Graph Endpoint
app.get('/api/projects/graph', (req, res) => {
  try {
    const graphData = ProjectManager.getProjectsGraphData();
    res.json(graphData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trash & Retention Endpoints
app.get('/api/notes/trash', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const config = ConfigManager.getConfig();
    // Run automated background cleanup on query
    if (config.deletedNotesRetention) {
      TellusNoteEngine.cleanupExpiredBackups(config.deletedNotesRetention);
    }
    const items = TellusNoteEngine.listDeletedNotes(currentPath);
    res.json({ items, retention: config.deletedNotesRetention || '90_days' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/trash/restore', (req, res) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename) {
      return res.status(400).json({ error: 'backupFilename é obrigatório' });
    }
    const currentPath = ProjectManager.getCurrentProject();
    const restoredNote = TellusNoteEngine.restoreDeletedNote(backupFilename, currentPath);
    if (!restoredNote) {
      return res.status(404).json({ error: 'Arquivo de backup não encontrado' });
    }
    res.json({ success: true, note: restoredNote });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/trash', (req, res) => {
  try {
    const backupFilename = (req.query.backupFilename as string) || req.body?.backupFilename;
    if (backupFilename) {
      const success = TellusNoteEngine.permanentlyDeleteNote(backupFilename);
      return res.json({ success });
    }
    const result = TellusNoteEngine.emptyTrash();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/trash/cleanup', (req, res) => {
  try {
    const config = ConfigManager.getConfig();
    const retention = req.body.retention || config.deletedNotesRetention || '90_days';
    const cleanedCount = TellusNoteEngine.cleanupExpiredBackups(retention);
    res.json({ success: true, cleanedCount, retention });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to directly save exported notes into the OS Downloads folder
app.post('/api/notes/export-to-downloads', (req, res) => {
  try {
    const { filename, content, openFolder } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ error: 'filename e content são obrigatórios' });
    }

    const homeDir = os.homedir();
    const downloadsDir = path.join(homeDir, 'Downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Sanitize filename
    const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '_').trim();
    const targetFilePath = path.join(downloadsDir, safeFilename);

    fs.writeFileSync(targetFilePath, content, 'utf-8');
    console.log(`[Notes Export] Arquivo salvo em Downloads: ${targetFilePath}`);

    if (openFolder) {
      try {
        const { exec } = require('child_process');
        if (process.platform === 'win32') {
          exec(`explorer /select,"${targetFilePath}"`);
        } else if (process.platform === 'darwin') {
          exec(`open -R "${targetFilePath}"`);
        } else {
          exec(`xdg-open "${downloadsDir}"`);
        }
      } catch (e: any) {
        console.warn('[Notes Export] Não foi possível abrir o explorer:', e.message);
      }
    }

    res.json({
      success: true,
      filePath: targetFilePath,
      filename: safeFilename,
      downloadsDir
    });
  } catch (err: any) {
    console.error('[Notes Export Error]', err);
    res.status(500).json({ error: err.message || 'Falha ao salvar na pasta Downloads' });
  }
});

// Vault Directory Selection & Inspection Routes (Declared BEFORE :id)
app.get('/api/notes/vault-info', (req, res) => {
  try {
    const vaultPath = TellusNoteEngine.VAULT_DIR;
    res.json({
      vaultPath,
      exists: fs.existsSync(vaultPath),
      inkDir: TellusNoteEngine.INK_DIR,
      attachmentsDir: TellusNoteEngine.ATTACHMENTS_DIR
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/pick-vault-directory', async (req, res) => {
  try {
    const picked = await ProjectManager.pickDirectory();
    if (!picked) {
      return res.json({ cancelled: true, vaultPath: TellusNoteEngine.VAULT_DIR });
    }
    if (!fs.existsSync(picked)) {
      fs.mkdirSync(picked, { recursive: true });
    }
    const updatedConfig = ConfigManager.updateConfig({ vaultPath: picked });
    res.json({
      cancelled: false,
      vaultPath: updatedConfig.vaultPath || picked,
      config: updatedConfig
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ink Mode (Stylus / Pen / Touch Vector Annotations) Routes
app.get('/api/notes/:id/ink', (req, res) => {
  try {
    const inkData = TellusNoteEngine.getInkData(req.params.id);
    res.json(inkData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/:id/ink', (req, res) => {
  try {
    const savedInk = TellusNoteEngine.saveInkData(req.params.id, req.body || {});
    try {
      const cfg = ConfigManager.getConfig();
      setImmediate(() => {
        try {
          if (cfg.syncConfig?.enabled && cfg.syncConfig?.autoSync) {
            CloudSyncEngine.syncNow();
          }
          if (cfg.syncConfig?.peerSyncEnabled && cfg.syncConfig?.peerSyncUrl) {
            CloudSyncEngine.syncWithPeerDevice(cfg.syncConfig.peerSyncUrl).catch(() => {});
          }
        } catch {}
      });
    } catch {}
    res.json(savedInk);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id/ink', (req, res) => {
  try {
    const success = TellusNoteEngine.deleteInkData(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cloud Sync, Multi-Cloud Provider (Google Drive / Microsoft OneDrive / Dropbox) & 2FA Vault Security Routes
app.get('/api/sync/status', async (req, res) => {
  try {
    const config = ConfigManager.getConfig();
    const detectedFolders = CloudSyncEngine.detectCloudFolders();
    const discoveredAccounts = CloudSyncEngine.discoverLocalCloudAccounts();
    const effectiveMirrorPath = CloudSyncEngine.getEffectiveMirrorPath();
    const vaultSecurity = TellusNoteEngine.getVaultSecuritySummary();
    const storageMonitor = await CloudSyncEngine.getStorageMonitorReport();
    res.json({
      syncConfig: config.syncConfig,
      vaultPath: TellusNoteEngine.VAULT_DIR,
      detectedFolders,
      discoveredAccounts,
      effectiveMirrorPath,
      vaultSecurity,
      storageMonitor
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync/storage-monitor', async (req, res) => {
  try {
    const storageMonitor = await CloudSyncEngine.getStorageMonitorReport();
    res.json(storageMonitor);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync/select-provider', async (req, res) => {
  try {
    const { provider, cloudMirrorPath } = req.body || {};
    const cfg = ConfigManager.getConfig();
    const nextMirror =
      cloudMirrorPath?.trim() || CloudSyncEngine.getEffectiveMirrorPath(provider);
    const updated = ConfigManager.updateConfig({
      syncConfig: {
        ...(cfg.syncConfig as any),
        cloudProvider: provider || 'google_drive',
        cloudMirrorPath: nextMirror
      }
    });
    const storageMonitor = await CloudSyncEngine.getStorageMonitorReport();
    res.json({
      success: true,
      syncConfig: updated.syncConfig,
      storageMonitor
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync/lock-2fa', (req, res) => {
  try {
    const syncConfig = CloudSyncEngine.lock2FAVaultKeyOnly();
    res.json({
      success: true,
      syncConfig,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/cloud/check-2fa', (req, res) => {
  try {
    const email = String(req.query.email || '');
    const provider = String(req.query.provider || 'google_drive') as any;
    const status = CloudSyncEngine.checkAccount2FAStatusInCloud(email, provider);
    res.json(status);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 1. Launch External System Browser for Cloud Platform Authentication (Google / Microsoft) + 2FA Key
app.post('/api/auth/google/start-browser', (req, res) => {
  try {
    const port = Number(PORT) || 3001;
    const provider = req.body?.provider;
    const sessionInfo = CloudSyncEngine.launchExternalBrowserAuth(port, provider);
    res.json({
      success: true,
      ...sessionInfo
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Poll External Browser Authentication Session Status
app.get('/api/auth/google/poll', async (req, res) => {
  try {
    const challenge = String(req.query.challenge || '');
    const session = SecurityShield.getBrowserAuthSession(challenge);
    if (!session) {
      return res.json({ status: 'expired' });
    }
    if (session.status === 'completed') {
      const config = ConfigManager.getConfig();
      const vaultSecurity = TellusNoteEngine.getVaultSecuritySummary();
      const storageMonitor = await CloudSyncEngine.getStorageMonitorReport();
      return res.json({
        status: 'completed',
        result: session.result,
        syncConfig: config.syncConfig,
        vaultSecurity,
        storageMonitor
      });
    }
    res.json({ status: session.status, error: session.error });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. External Browser Portal Page (Multi-Cloud: Google Drive / Microsoft OneDrive / Dropbox + 2FA Key)
app.get('/api/auth/google/browser', (req, res) => {
  const challenge = String(req.query.challenge || '');
  const session = SecurityShield.getBrowserAuthSession(challenge);
  if (!session) {
    return res.status(400).send(`
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Sessão Expirada — Tellus</title></head>
      <body style="background:#0a0c12;color:#f8fafc;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="background:#131622;border:1px solid #1e293b;padding:32px;border-radius:20px;max-width:440px;text-align:center">
          <h2 style="color:#fb7185;margin-top:0">Sessão de Autenticação Expirada</h2>
          <p style="color:#94a3b8;font-size:14px">Volte ao aplicativo Tellus e clique novamente em <strong>Autenticar Conta Cloud & 2FA</strong>.</p>
        </div>
      </body></html>
    `);
  }

  const prefillEmail = String(req.query.email || '');
  const prefillName = String(req.query.name || '');
  const prefillProvider = String(req.query.provider || ConfigManager.getConfig().syncConfig?.cloudProvider || 'google_drive');
  const verifiedFlag = String(req.query.verified || '') === '1';
  const config = ConfigManager.getConfig();
  const savedGoogleClientId = config.syncConfig?.googleOAuthClientId || '';
  const savedMsClientId = config.syncConfig?.microsoftOAuthClientId || '';
  const discoveredAccounts = CloudSyncEngine.discoverLocalCloudAccounts();
  const detectedClouds = CloudSyncEngine.detectCloudFolders();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autenticação Cloud (Google / Microsoft) + 2FA — Tellus</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      background: radial-gradient(circle at top, #131b2e 0%, #090b10 70%);
      color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .card {
      width: 100%; max-width: 560px;
      background: rgba(19, 22, 34, 0.96);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 24px; padding: 26px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.65);
    }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-family: monospace;
      padding: 4px 10px; border-radius: 999px;
      background: rgba(34, 211, 238, 0.12); color: #22d3ee;
      border: 1px solid rgba(34, 211, 238, 0.3);
      margin-bottom: 10px;
    }
    h1 { font-size: 20px; margin: 0 0 6px 0; color: #fff; }
    p.sub { font-size: 12.5px; color: #94a3b8; margin: 0 0 18px 0; line-height: 1.5; }
    .step-title {
      font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
      color: #38bdf8; margin: 14px 0 8px 0; display: flex; align-items: center; gap: 6px;
    }
    .provider-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;
    }
    .prov-btn {
      padding: 10px 8px; border-radius: 12px; border: 1px solid #262d40;
      background: #0b0e17; color: #cbd5e1; font-size: 12px; font-weight: 600;
      cursor: pointer; text-align: center; transition: all 0.15s ease;
    }
    .prov-btn.active {
      border-color: #22d3ee; background: rgba(34, 211, 238, 0.12); color: #fff;
      box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.15);
    }
    .discovered-box {
      background: rgba(79, 70, 229, 0.1); border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px; padding: 10px 12px; margin-bottom: 14px;
    }
    .disc-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 8px; border-radius: 8px; background: rgba(11, 14, 23, 0.75);
      margin-top: 6px; cursor: pointer; border: 1px solid transparent; font-size: 12px;
    }
    .disc-item:hover { border-color: #6366f1; }
    label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 5px; }
    input {
      width: 100%; padding: 10px 13px; border-radius: 12px;
      border: 1px solid #262d40; background: #0b0e17; color: #f8fafc;
      font-size: 13px; margin-bottom: 12px; outline: none;
    }
    input:focus { border-color: #22d3ee; box-shadow: 0 0 0 2px rgba(34,211,238,0.15); }
    .btn {
      width: 100%; padding: 12px 16px; border-radius: 12px; border: none;
      font-size: 13px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: linear-gradient(135deg, #4f46e5, #0891b2);
      color: #fff; box-shadow: 0 8px 20px rgba(79, 70, 229, 0.35);
    }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-oauth {
      background: #ffffff; color: #0f172a; margin-bottom: 8px;
      border: 1px solid #cbd5e1; font-size: 12px; padding: 9px 12px;
    }
    .btn-oauth:hover { background: #f1f5f9; }
    .info-box {
      background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25);
      color: #6ee7b7; padding: 11px; border-radius: 12px; font-size: 11.5px; line-height: 1.45; margin-bottom: 14px;
    }
    .twofa-box {
      background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fde68a; padding: 12px; border-radius: 12px; font-size: 12px; margin-bottom: 12px;
    }
    .error-box {
      background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.35);
      color: #fda4af; padding: 12px; border-radius: 12px; font-size: 12px; margin-bottom: 14px; display: none;
    }
    details { margin-top: 10px; font-size: 12px; color: #94a3b8; }
    summary { cursor: pointer; color: #38bdf8; font-weight: 600; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="card" id="authCard">
    <div class="badge">🛡️ TELLUS MULTI-CLOUD CAPSULE • LOGIN + 2FA AES-256-GCM</div>
    <h1>Conectar Nuvem & Verificar Chave 2FA</h1>
    <p class="sub">
      Escolha em qual nuvem (<strong>Google Drive</strong>, <strong>Microsoft OneDrive</strong> ou <strong>Dropbox</strong>) suas notas, desenhos Ink e chats serão encapsulados para edição simultânea entre seus PCs — <strong>sem expor IP</strong> e protegidos com <strong>2FA Criptográfico</strong>.
    </p>

    <div id="errBox" class="error-box"></div>

    ${verifiedFlag ? `<div class="info-box">✓ <strong>1º Fator Verificado via OAuth (${prefillEmail})</strong>. Agora informe seu <strong>2º Fator (Chave Encriptada 2FA)</strong> abaixo para destrancar seus dados.</div>` : ''}

    <form id="authForm">
      <div class="step-title">1º PASSO — ESCOLHA A NUVEM DE SINCRONIZAÇÃO</div>
      <div class="provider-grid">
        <button type="button" class="prov-btn" data-prov="google_drive">☁️ Google Drive</button>
        <button type="button" class="prov-btn" data-prov="microsoft_onedrive">🟦 Microsoft OneDrive</button>
        <button type="button" class="prov-btn" data-prov="dropbox">📦 Dropbox Cloud</button>
      </div>

      ${
        discoveredAccounts.length > 0
          ? `<div class="discovered-box">
              <div style="font-size:11px;font-weight:700;color:#a5b4fc">✨ Contas Cloud detectadas neste computador (clique para preencher):</div>
              ${discoveredAccounts
                .map(
                  (acc) => `
                <div class="disc-item" onclick="selectDiscovered('${acc.email}', '${acc.name}', '${acc.provider}')">
                  <span><strong>${acc.email}</strong> <span style="color:#94a3b8">(${acc.providerLabel})</span></span>
                  <span style="color:#38bdf8;font-weight:700">Selecionar →</span>
                </div>`
                )
                .join('')}
            </div>`
          : ''
      }

      <label id="emailLabel">E-mail da Conta (Google / Microsoft)</label>
      <input type="email" id="email" required placeholder="seu.email@gmail.com ou @outlook.com" value="${prefillEmail}" ${verifiedFlag ? 'readonly' : ''} />

      <label>Nome de Exibição</label>
      <input type="text" id="name" placeholder="Seu nome" value="${prefillName}" />

      <div class="step-title">2º PASSO (2FA OBRIGATÓRIO) — CHAVE ENCRIPTADA DO COFRE</div>
      <div id="twoFaStatusBanner" class="twofa-box">
        🔐 <strong>Verificação em Duas Etapas (2FA Criptográfico):</strong><br/>
        Além da conta Google/Microsoft, seus dados exigem a <strong>Chave Encriptada</strong> que você criou na 1ª vez. Sem ela, ninguém consegue descriptografar suas notas mesmo que tenha acesso à sua nuvem.
      </div>

      <label id="passLabel">🔑 Chave Encriptada 2FA (Mínimo 6 caracteres)</label>
      <input type="password" id="vaultPassphrase" required minlength="6" placeholder="Digite sua Chave 2FA (ou crie agora se for seu 1º acesso)" />

      <details>
        <summary>Autenticação OAuth 2.0 Direta (Google / Microsoft Graph API)</summary>
        <label style="margin-top:8px">Token OAuth Google Drive ou Microsoft Graph (Opcional — ativa leitura da cota real via API)</label>
        <input type="text" id="cloudToken" placeholder="Cole um Access Token OAuth se desejar consultar API direta" />
        <label>Client ID OAuth 2.0 (Google Cloud ou Microsoft Entra ID)</label>
        <input type="text" id="clientId" placeholder="Client ID oficial para redirecionamento OAuth" value="${savedGoogleClientId || savedMsClientId}" />
        <button type="button" id="oauthRedirectBtn" class="btn btn-oauth">
          🌐 Redirecionar para Login Oficial da Plataforma (OAuth 2.0)
        </button>
      </details>

      <button type="submit" id="submitBtn" class="btn btn-primary" style="margin-top:14px">
        🔒 Autenticar Plataforma + Verificar 2FA e Sincronizar
      </button>
    </form>
  </div>

  <script>
    const challenge = ${JSON.stringify(challenge)};
    const verifiedByPlatform = ${JSON.stringify(verifiedFlag)};
    let selectedProvider = ${JSON.stringify(prefillProvider)};
    const detectedClouds = ${JSON.stringify(detectedClouds)};

    function updateProviderUI(prov) {
      selectedProvider = prov;
      document.querySelectorAll('.prov-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-prov') === prov);
      });
      const emailLabel = document.getElementById('emailLabel');
      if (prov === 'microsoft_onedrive') {
        emailLabel.textContent = 'E-mail da Conta Microsoft (OneDrive / Outlook / Hotmail / Live)';
      } else if (prov === 'dropbox') {
        emailLabel.textContent = 'E-mail da Conta Dropbox';
      } else {
        emailLabel.textContent = 'E-mail da Conta Google (Google Drive / Gmail)';
      }
      checkExisting2FA();
    }

    document.querySelectorAll('.prov-btn').forEach(btn => {
      btn.addEventListener('click', () => updateProviderUI(btn.getAttribute('data-prov')));
    });

    window.selectDiscovered = function(email, name, prov) {
      document.getElementById('email').value = email;
      document.getElementById('name').value = name;
      updateProviderUI(prov);
      document.getElementById('vaultPassphrase').focus();
    };

    async function checkExisting2FA() {
      const email = document.getElementById('email').value.trim();
      const banner = document.getElementById('twoFaStatusBanner');
      const passLabel = document.getElementById('passLabel');
      if (!email || !email.includes('@')) return;
      try {
        const res = await fetch('/api/auth/cloud/check-2fa?email=' + encodeURIComponent(email) + '&provider=' + encodeURIComponent(selectedProvider));
        const data = await res.json();
        if (data.hasExistingCloudVault) {
          banner.innerHTML = '🛡️ <strong>Cofre Cloud Existente Detectado!</strong><br/>Esta conta já possui notas encapsuladas na nuvem. Digite a <strong>mesma Chave Encriptada (2FA)</strong> que você criou na primeira vez para destrancar e sincronizar.';
          passLabel.textContent = '🔑 Digite sua Chave Encriptada 2FA Existente (Obrigatória)';
        } else {
          banner.innerHTML = '✨ <strong>Primeiro Acesso nesta Nuvem:</strong><br/>Crie agora sua <strong>Chave Encriptada (2FA)</strong>. Guarde-a com segurança: você precisará digitá-la quando instalar o Tellus no seu 2º PC/Notebook!';
          passLabel.textContent = '🔑 Crie sua Chave Encriptada 2FA (Mínimo 6 caracteres)';
        }
      } catch {}
    }

    document.getElementById('email').addEventListener('blur', checkExisting2FA);
    updateProviderUI(selectedProvider);

    document.getElementById('oauthRedirectBtn')?.addEventListener('click', () => {
      const cid = document.getElementById('clientId').value.trim();
      if (!cid) {
        alert('Informe o Client ID OAuth 2.0 ou autentique selecionando sua conta e informando sua Chave 2FA.');
        return;
      }
      window.location.href = '/api/auth/google/oauth-redirect?challenge=' + encodeURIComponent(challenge) + '&clientId=' + encodeURIComponent(cid) + '&provider=' + encodeURIComponent(selectedProvider);
    });

    document.getElementById('authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('errBox');
      const submitBtn = document.getElementById('submitBtn');
      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando Conta Cloud e Chave 2FA...';

      try {
        const res = await fetch('/api/auth/google/browser-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challenge,
            provider: selectedProvider,
            email: document.getElementById('email').value.trim(),
            name: document.getElementById('name').value.trim(),
            vaultPassphrase: document.getElementById('vaultPassphrase').value,
            googleToken: document.getElementById('cloudToken').value.trim(),
            verifiedByGoogle: verifiedByPlatform
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Falha na autenticação 2FA');
        }
        document.getElementById('authCard').innerHTML = \`
          <div class="badge">✓ 1º FATOR (CLOUD) + 2º FATOR (2FA AES-256) VERIFICADOS</div>
          <h1 style="color:#34d399">Cápsula Cloud & 2FA Desbloqueados!</h1>
          <p class="sub" style="margin-top:10px">
            A conta <strong>\${data.email}</strong> foi conectada ao <strong>\${selectedProvider === 'microsoft_onedrive' ? 'Microsoft OneDrive' : selectedProvider === 'dropbox' ? 'Dropbox' : 'Google Drive'}</strong> e sua <strong>Chave 2FA</strong> destrancou suas notas, desenhos Ink e chats.<br/><br/>
            Você já pode fechar esta guia e voltar para o Tellus.
          </p>
        \`;
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = '🔒 Autenticar Plataforma + Verificar 2FA e Sincronizar';
      }
    });
  </script>
</body>
</html>`);
});

// 4. Official Google / Microsoft OAuth 2.0 Redirect (PKCE S256)
app.get('/api/auth/google/oauth-redirect', (req, res) => {
  const challenge = String(req.query.challenge || '');
  const clientId = String(req.query.clientId || '').trim();
  const provider = String(req.query.provider || 'google_drive');
  const session = SecurityShield.getBrowserAuthSession(challenge);
  if (!session || !clientId) {
    return res.status(400).send('Sessão ou Client ID inválido.');
  }

  if (provider === 'microsoft_onedrive') {
    ConfigManager.updateConfig({
      syncConfig: {
        ...ConfigManager.getConfig().syncConfig!,
        microsoftOAuthClientId: clientId,
        cloudProvider: 'microsoft_onedrive'
      }
    });
    const redirectUri = `http://localhost:${PORT}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile User.Read Files.ReadWrite',
      state: `${challenge}|microsoft_onedrive`,
      code_challenge: session.codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    return res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`);
  }

  ConfigManager.updateConfig({
    syncConfig: {
      ...ConfigManager.getConfig().syncConfig!,
      googleOAuthClientId: clientId,
      cloudProvider: 'google_drive'
    }
  });
  const redirectUri = `http://localhost:${PORT}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/drive.metadata.readonly',
    state: `${challenge}|google_drive`,
    code_challenge: session.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// 5. Official Google / Microsoft OAuth 2.0 Callback
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const rawState = String(req.query.state || '');
    const [state, providerFromState] = rawState.split('|');
    const provider = providerFromState || 'google_drive';
    const session = SecurityShield.getBrowserAuthSession(state);
    if (!session || !code) {
      return res.status(400).send('Callback OAuth inválido ou sessão expirada.');
    }
    const redirectUri = `http://localhost:${PORT}/api/auth/google/callback`;

    if (provider === 'microsoft_onedrive') {
      const clientId = ConfigManager.getConfig().syncConfig?.microsoftOAuthClientId || '';
      const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code,
          code_verifier: session.codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      const tokenData: any = await tokenRes.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        return res.redirect(`/api/auth/google/browser?challenge=${encodeURIComponent(state)}&provider=microsoft_onedrive`);
      }
      const verifiedProfile = await CloudSyncEngine.verifyMicrosoftOAuthToken(accessToken);
      return res.redirect(
        `/api/auth/google/browser?challenge=${encodeURIComponent(state)}&provider=microsoft_onedrive&email=${encodeURIComponent(
          verifiedProfile.email
        )}&name=${encodeURIComponent(verifiedProfile.name)}&verified=1`
      );
    }

    const clientId = ConfigManager.getConfig().syncConfig?.googleOAuthClientId || '';
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: session.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token || tokenData.id_token;
    if (!accessToken) {
      return res.redirect(`/api/auth/google/browser?challenge=${encodeURIComponent(state)}`);
    }
    const verifiedProfile = await CloudSyncEngine.verifyGoogleOAuthToken(accessToken);
    return res.redirect(
      `/api/auth/google/browser?challenge=${encodeURIComponent(state)}&provider=google_drive&email=${encodeURIComponent(
        verifiedProfile.email
      )}&name=${encodeURIComponent(verifiedProfile.name)}&verified=1`
    );
  } catch (err: any) {
    res.status(500).send(`Erro no retorno OAuth: ${err.message}`);
  }
});

// 6. Complete External Browser Authentication + Verify 2FA E2EE Key
app.post('/api/auth/google/browser-complete', async (req, res) => {
  try {
    const { challenge, provider, email, name, vaultPassphrase, googleToken, verifiedByGoogle } = req.body;
    const session = SecurityShield.getBrowserAuthSession(String(challenge || ''));
    if (!session) {
      return res.status(400).json({ error: 'Sessão de autenticação expirada. Abra novamente pelo Tellus.' });
    }

    const selectedProvider = (provider || 'google_drive') as any;
    let finalEmail = String(email || '').trim().toLowerCase();
    let finalName = String(name || '').trim();
    let finalPicture: string | undefined;
    let finalSub = `${selectedProvider}_${Date.now()}`;
    let isTokenVerified = Boolean(verifiedByGoogle);
    const cleanToken = googleToken ? String(googleToken).trim() : '';

    if (cleanToken) {
      if (selectedProvider === 'microsoft_onedrive') {
        const msProfile = await CloudSyncEngine.verifyMicrosoftOAuthToken(cleanToken);
        finalEmail = msProfile.email.toLowerCase();
        finalName = msProfile.name || finalName;
        finalSub = msProfile.sub;
        isTokenVerified = true;
      } else {
        const tokenProfile = await CloudSyncEngine.verifyGoogleOAuthToken(cleanToken);
        finalEmail = tokenProfile.email.toLowerCase();
        finalName = tokenProfile.name || finalName;
        finalPicture = tokenProfile.picture;
        finalSub = tokenProfile.sub;
        isTokenVerified = true;
      }
    }

    const authMethod = isTokenVerified
      ? selectedProvider === 'microsoft_onedrive'
        ? 'microsoft_token_verified'
        : 'google_token_verified'
      : 'google_browser_vault_key';

    const { syncConfig, accountHash, isFirstTimeVault } = CloudSyncEngine.authenticateGoogleWithVaultKey({
      email: finalEmail,
      name: finalName || finalEmail.split('@')[0],
      vaultPassphrase: String(vaultPassphrase || ''),
      provider: selectedProvider,
      picture: finalPicture,
      sub: finalSub,
      authMethod,
      verifiedByGoogle: isTokenVerified,
      verifiedByPlatform: isTokenVerified,
      cloudAccessToken: cleanToken || undefined
    });

    const report = CloudSyncEngine.syncNow();
    const storageMonitor = await CloudSyncEngine.getStorageMonitorReport();

    SecurityShield.completeBrowserAuthSession(challenge, {
      email: finalEmail,
      name: syncConfig.googleAccount?.name || finalEmail,
      picture: finalPicture,
      sub: finalSub,
      authMethod: authMethod as any,
      accountHash
    });

    res.json({
      success: true,
      email: finalEmail,
      accountHash,
      isFirstTimeVault,
      syncConfig,
      report,
      storageMonitor
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Direct Authenticated Login (Step 1: Platform Account + Step 2: Mandatory 2FA Encrypted Key)
app.post('/api/sync/google-login', async (req, res) => {
  try {
    const { email, name, provider, vaultPassphrase, googleToken, picture, cloudMirrorPath } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'E-mail da conta Cloud (Google ou Microsoft) é obrigatório.' });
    }
    if (!vaultPassphrase || String(vaultPassphrase).trim().length < 6) {
      return res.status(400).json({
        error: '2º Fator Obrigatório (2FA): Informe sua Chave Encriptada (mínimo 6 caracteres) criada na 1ª vez para destrancar seus dados.'
      });
    }

    const selectedProvider = (provider || ConfigManager.getConfig().syncConfig?.cloudProvider || 'google_drive') as any;
    let verifiedEmail = email.trim().toLowerCase();
    let verifiedName = (name || verifiedEmail.split('@')[0]).trim();
    let verifiedPic = picture;
    let verifiedByPlatform = false;
    const cleanToken = googleToken ? String(googleToken).trim() : '';

    if (cleanToken) {
      if (selectedProvider === 'microsoft_onedrive') {
        const msProfile = await CloudSyncEngine.verifyMicrosoftOAuthToken(cleanToken);
        verifiedEmail = msProfile.email.toLowerCase();
        verifiedName = msProfile.name || verifiedName;
        verifiedByPlatform = true;
      } else {
        const profile = await CloudSyncEngine.verifyGoogleOAuthToken(cleanToken);
        verifiedEmail = profile.email.toLowerCase();
        verifiedName = profile.name || verifiedName;
        verifiedPic = profile.picture;
        verifiedByPlatform = true;
      }
    }

    CloudSyncEngine.authenticateGoogleWithVaultKey({
      email: verifiedEmail,
      name: verifiedName,
      provider: selectedProvider,
      vaultPassphrase: String(vaultPassphrase),
      picture: verifiedPic,
      cloudMirrorPath,
      authMethod: verifiedByPlatform ? 'google_token_verified' : 'google_browser_vault_key',
      verifiedByGoogle: verifiedByPlatform,
      verifiedByPlatform,
      cloudAccessToken: cleanToken || undefined
    });

    const report = CloudSyncEngine.syncNow();
    const storageMonitor = await CloudSyncEngine.getStorageMonitorReport();
    res.json({
      success: true,
      syncConfig: ConfigManager.getConfig().syncConfig,
      report,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary(),
      storageMonitor
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync/google-logout', (req, res) => {
  try {
    const syncConfig = CloudSyncEngine.logoutGoogle();
    res.json({
      success: true,
      syncConfig,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync/vault-ownership', (req, res) => {
  try {
    const { mode } = req.body; // 'bind_to_account' | 'release_to_local_pc'
    if (mode !== 'bind_to_account' && mode !== 'release_to_local_pc') {
      return res.status(400).json({ error: 'Modo inválido.' });
    }
    const result = TellusNoteEngine.setVaultNotesOwnership(mode);
    const vaultSecurity = TellusNoteEngine.getVaultSecuritySummary();
    res.json({
      success: true,
      ...result,
      vaultSecurity
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync/now', async (req, res) => {
  try {
    const report = CloudSyncEngine.syncNow();
    const cfg = ConfigManager.getConfig();
    if (cfg.syncConfig?.peerSyncEnabled && cfg.syncConfig?.peerSyncUrl) {
      const peerRes = await CloudSyncEngine.syncWithPeerDevice(cfg.syncConfig.peerSyncUrl);
      if (peerRes.success) {
        report.notesPulled += peerRes.notesUpdated;
        report.inkPulled += peerRes.inksUpdated;
        report.details.push(...peerRes.details);
      }
    }
    res.json({
      ...report,
      syncConfig: ConfigManager.getConfig().syncConfig,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Multi-Account Switching & Local-Only Mode (No Login Required)
app.post('/api/sync/switch-account', (req, res) => {
  try {
    const { target, vaultPassphrase } = req.body; // email, accountHash, or 'local_only'
    const result = CloudSyncEngine.switchAccount(String(target || 'local_only'), vaultPassphrase);
    let report = undefined;
    if (result.mode === 'account') {
      report = CloudSyncEngine.syncNow();
    }
    res.json({
      success: true,
      mode: result.mode,
      activeEmail: result.activeEmail,
      syncConfig: ConfigManager.getConfig().syncConfig,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary(),
      report
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync/remove-account', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail ou ID da conta é obrigatório.' });
    }
    const syncConfig = CloudSyncEngine.removeSavedAccount(String(email));
    res.json({
      success: true,
      syncConfig,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary()
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync/view-scope', (req, res) => {
  try {
    const { scope } = req.body;
    if (scope !== 'all_accessible' && scope !== 'account_only' && scope !== 'local_only') {
      return res.status(400).json({ error: 'Escopo de visualização inválido.' });
    }
    const syncConfig = CloudSyncEngine.setVaultViewScope(scope);
    res.json({
      success: true,
      syncConfig,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary()
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Direct Peer-to-Peer LAN Co-Editing & Network Discovery Endpoints
app.get('/api/sync/network-info', (req, res) => {
  try {
    const port = Number(PORT) || 3001;
    const netInfo = CloudSyncEngine.getLocalNetworkInfo(port);
    res.json(netInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync/peer-bundle', (req, res) => {
  try {
    const requestedHash = req.query.accountHash ? String(req.query.accountHash) : undefined;
    const bundle = CloudSyncEngine.exportPeerSyncBundle(requestedHash);
    res.json(bundle);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync/peer-push', (req, res) => {
  try {
    const result = CloudSyncEngine.applyPeerSyncBundle(req.body || {});
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync/peer-sync', async (req, res) => {
  try {
    const { peerUrl, peerSyncEnabled } = req.body || {};
    if (typeof peerUrl === 'string') {
      const cfg = ConfigManager.getConfig();
      ConfigManager.updateConfig({
        syncConfig: {
          ...(cfg.syncConfig as any),
          peerSyncUrl: peerUrl.trim(),
          peerSyncEnabled: peerSyncEnabled !== undefined ? Boolean(peerSyncEnabled) : Boolean(peerUrl.trim())
        }
      });
    }
    const result = await CloudSyncEngine.syncWithPeerDevice(peerUrl);
    res.json({
      ...result,
      syncConfig: ConfigManager.getConfig().syncConfig,
      vaultSecurity: TellusNoteEngine.getVaultSecuritySummary()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Background Co-Editing Auto-Sync Interval (pulls remote Cloud Drive & LAN Peer updates every 6s)
setInterval(() => {
  try {
    const cfg = ConfigManager.getConfig();
    if (cfg.syncConfig?.enabled && cfg.syncConfig?.autoSync && SecurityShield.isVaultUnlocked()) {
      CloudSyncEngine.syncNow();
    }
    if (cfg.syncConfig?.peerSyncEnabled && cfg.syncConfig?.peerSyncUrl) {
      CloudSyncEngine.syncWithPeerDevice(cfg.syncConfig.peerSyncUrl).catch(() => {});
    }
  } catch {}
}, 6000);

app.post('/api/sync/pick-mirror-directory', async (req, res) => {
  try {
    const picked = await ProjectManager.pickDirectory();
    if (!picked) {
      return res.json({ cancelled: true });
    }
    const currentSync = ConfigManager.getConfig().syncConfig;
    const updated = ConfigManager.updateConfig({
      syncConfig: {
        ...(currentSync || {
          enabled: true,
          autoSync: true,
          syncNotes: true,
          syncInk: true,
          syncChats: true,
          syncAiConfig: true,
          deviceId: os.hostname(),
          deviceName: os.hostname()
        }),
        cloudMirrorPath: picked,
        enabled: true
      }
    });
    res.json({
      cancelled: false,
      cloudMirrorPath: picked,
      syncConfig: updated.syncConfig
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// One-Click Update & Restart Routes
app.get('/api/system/update-status', (req, res) => {
  try {
    const rootDir = path.resolve(__dirname, '../..');
    let branch = 'main';
    let commit = '';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
      commit = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
    } catch {}
    res.json({
      version: '2.4.0',
      branch,
      commit,
      rootDir,
      vaultPath: TellusNoteEngine.VAULT_DIR
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/update-and-restart', async (req, res) => {
  try {
    const rootDir = path.resolve(__dirname, '../..');
    const steps: string[] = [];

    // 1. Sync Cloud data first if enabled so nothing is lost
    try {
      const cfg = ConfigManager.getConfig();
      if (cfg.syncConfig?.enabled) {
        CloudSyncEngine.syncNow();
        steps.push('Sincronização em nuvem concluída antes da atualização.');
      }
    } catch {}

    // 2. Git Pull (if git repository with remote exists)
    try {
      const pullOut = execSync('git pull --rebase --autostash', {
        cwd: rootDir,
        encoding: 'utf-8',
        timeout: 30000
      }).trim();
      steps.push(`Git Pull: ${pullOut || 'Código atualizado'}`);
    } catch (gitErr: any) {
      steps.push(`Git local mantido (${gitErr.message?.split('\n')[0] || 'sem repositório remoto configurado'})`);
    }

    // 3. Build Client & Server so newest changes are compiled
    try {
      execSync('npm run build --prefix client', { cwd: rootDir, encoding: 'utf-8', timeout: 120000 });
      steps.push('Interface (Client) compilada com sucesso.');
    } catch (buildClientErr: any) {
      steps.push(`Aviso ao compilar Client: ${buildClientErr.message?.split('\n')[0]}`);
    }

    try {
      execSync('npm run build --prefix server', { cwd: rootDir, encoding: 'utf-8', timeout: 60000 });
      steps.push('Servidor (Backend) compilado com sucesso.');
    } catch (buildServerErr: any) {
      steps.push(`Aviso ao compilar Server: ${buildServerErr.message?.split('\n')[0]}`);
    }

    res.json({
      success: true,
      message: 'Atualização concluída! Reiniciando o Tellus...',
      steps
    });

    // 4. Self-restart backend process after response flushes so tsx/Electron reloads cleanly
    setTimeout(() => {
      try {
        const touchFile = path.resolve(__dirname, 'index.ts');
        if (fs.existsSync(touchFile)) {
          const now = new Date();
          fs.utimesSync(touchFile, now, now);
        }
      } catch {}
    }, 600);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Falha ao atualizar e reiniciar o Tellus' });
  }
});

// Parameterized Individual Note Routes
app.post('/api/notes/:id/move', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { targetFolder } = req.body;
    if (!targetFolder) {
      return res.status(400).json({ error: 'targetFolder é obrigatório' });
    }
    const updatedNote = TellusNoteEngine.moveNote(req.params.id, targetFolder, currentPath);
    if (!updatedNote) {
      return res.status(404).json({ error: 'Nota não encontrada' });
    }
    res.json(updatedNote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const isProjectSpecific = req.query.isProjectSpecific === 'true';
    const success = TellusNoteEngine.deleteNote(req.params.id, isProjectSpecific, currentPath);

    // Auto-clean active_context if it specifically mentions this deleted note ID
    try {
      const activeCtx = MemoryEngine.getActiveContext(currentPath);
      if (activeCtx.toLowerCase().includes(req.params.id.toLowerCase())) {
        const cleanedCtx = activeCtx.split('\n').filter(line => !line.toLowerCase().includes(req.params.id.toLowerCase())).join('\n');
        MemoryEngine.updateActiveContext(currentPath, cleanedCtx);
      }
    } catch {}

    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sintetizar e criar uma nota do TellusMD a partir do chat atual
app.post('/api/notes/generate-from-chat', async (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { messages, sessionTitle, model } = req.body;
    const config = ConfigManager.getConfig();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem na conversa para sintetizar.' });
    }

    const chatTranscript = messages
      .filter((m: any) => m.content && (m.role === 'user' || m.role === 'assistant'))
      .map((m: any) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n\n');

    if (!chatTranscript.trim()) {
      return res.status(400).json({ error: 'Nenhum texto relevante para criar nota.' });
    }

    const userLocale = config.locale || 'pt-BR';
    const userLanguage = config.language || 'Português (Brasil)';
    const promptMessages = [
      {
        role: 'system' as const,
        content: `Você é o sintetizador de conhecimento do TellusMD Vault (motor de notas fundamentado nas arquiteturas Frank MD e AI-Memory).
IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em ${userLanguage} (${userLocale}).
É TOTALMENTE PROIBIDO responder em espanhol ou portunhol, mesmo que termos técnicos se assemelhem (ex: use "Arquitetura", jamais "Arquitectura"; use "Exercícios", jamais "Ejercicios"; use "Introdução", jamais "Introducción").

Sua missão é extrair todo o conteúdo relevante da conversa e gerar uma nota rica, clara e estruturada no formato Markdown.
Estrutura obrigatória:
<!-- subject: Assunto principal em ${userLanguage} -->
# Título Claro e Específico da Nota

## 📌 Resumo Executivo
Breve resumo dos objetivos, contexto e conclusões da discussão.

## 🔑 Principais Pontos e Decisões
- Pontos essenciais debatidos e soluções adotadas
- Snippets de código ou comandos chave (se houver)

## 💡 Conexões e Próximos Passos
- Conexões sugeridas usando wikilinks no padrão [[Nome de Outra Nota]]
- Tags no final: #categoria #tecnologia #ideia`
      },
      {
        role: 'user' as const,
        content: `Transcrição da conversa "${sessionTitle || 'Sessão'}":\n\n${chatTranscript.slice(0, 25000)}\n\nCrie uma nota completa contendo todo o conteúdo relevante em ${userLanguage}.`
      }
    ];

    let generatedNoteContent = '';
    const activeModel = model || config.defaultModel || 'deepseek/deepseek-r1';

    await ProviderHub.streamChat(
      'auto',
      activeModel,
      promptMessages,
      [],
      {
        onContentChunk: (chunk: string) => { generatedNoteContent += chunk; },
        onReasoningChunk: () => {},
        onToolCalls: () => {}
      }
    );

    if (userLocale.startsWith('pt')) {
      generatedNoteContent = sanitizePortugueseText(generatedNoteContent);
    }

    const firstH1 = generatedNoteContent.match(/^#+\s*(.*)/m);
    let title = firstH1 ? firstH1[1].trim() : (sessionTitle ? `Nota: ${sessionTitle}` : `Nota ${new Date().toLocaleDateString()}`);

    const subjectMatch = generatedNoteContent.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
    let subject = subjectMatch ? subjectMatch[1].trim() : 'Sessões';

    if (userLocale.startsWith('pt')) {
      title = sanitizePortugueseText(title);
      subject = sanitizePortugueseText(subject);
    }

    const savedNote = TellusNoteEngine.saveNote({
      title,
      subject,
      content: generatedNoteContent,
      isProjectSpecific: true
    }, currentPath);

    res.json({
      success: true,
      note: savedNote
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Falha ao sintetizar nota do chat' });
  }
});

// Skills & Artifacts Endpoints
app.get('/api/skills', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const skills = SkillManager.listSkills(targetPath);
    res.json(skills);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skills', (req, res) => {
  try {
    const targetPath = req.body.targetProjectPath || ProjectManager.getCurrentProject();
    const skill = SkillManager.saveSkill(req.body, targetPath);
    res.json(skill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skills/import-markdown', (req, res) => {
  try {
    const { filename, content, isProjectSpecific, targetProjectPath, scope } = req.body;
    const targetPath = targetProjectPath || ProjectManager.getCurrentProject();
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Conteúdo da skill é obrigatório' });
    }
    const skill = SkillManager.importMarkdownSkill(
      filename || 'imported_skill.md',
      content,
      isProjectSpecific,
      targetPath,
      scope
    );
    res.json(skill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skills/toggle', (req, res) => {
  try {
    const targetPath = req.body.targetProjectPath || ProjectManager.getCurrentProject();
    const { skillId, isActive } = req.body;
    SkillManager.toggleSkillActive(skillId, isActive, targetPath);
    res.json({ success: true, skillId, isActive });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/skills/:id', (req, res) => {
  try {
    const targetPath = (req.query.projectPath as string) || ProjectManager.getCurrentProject();
    const isProjectSpecific = req.query.isProjectSpecific === 'true';
    const success = SkillManager.deleteSkill(req.params.id, isProjectSpecific, targetPath);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/artifacts', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const artifacts = SkillManager.listArtifacts(currentPath);
    res.json(artifacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/artifacts', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { title, content, type, filename, isGlobal } = req.body;
    const artifact = SkillManager.saveArtifact(currentPath, title, content, type, filename, isGlobal);
    res.json(artifact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/artifacts/:filename', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const isGlobal = req.query.isGlobal === 'true';
    const success = SkillManager.deleteArtifact(req.params.filename, isGlobal, currentPath);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve attachments
app.get('/api/attachments/:filename', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const filePath = path.join(FileParser.getAttachmentsDir(currentPath), req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Arquivo não encontrado');
    }
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// 7. Chat Sessions & Cross-Chat Mentions
app.get('/api/sessions', (req, res) => {
  try {
    const requestedPath = req.query.projectPath as string;
    const all = req.query.all === 'true';

    if (all) {
      const config = ConfigManager.getConfig();
      const currentPath = ProjectManager.getCurrentProject();
      const allPaths = Array.from(new Set([
        currentPath,
        ...(config.openProjects || []),
        ...(config.recentProjects || [])
      ])).filter(p => fs.existsSync(p));

      const allSessions: any[] = [];
      for (const p of allPaths) {
        const sessions = SessionManager.listSessions(p);
        allSessions.push(...sessions);
      }
      return res.json(allSessions);
    }

    const currentPath = requestedPath || ProjectManager.getCurrentProject();
    const sessions = SessionManager.listSessions(currentPath);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const requestedPath = req.query.projectPath as string;
    const currentPath = requestedPath || ProjectManager.getCurrentProject();
    let session = SessionManager.getSession(currentPath, req.params.id);

    if (!session) {
      const config = ConfigManager.getConfig();
      const allPaths = Array.from(new Set([
        ...(config.openProjects || []),
        ...(config.recentProjects || [])
      ])).filter(p => fs.existsSync(p) && p !== currentPath);

      for (const p of allPaths) {
        session = SessionManager.getSession(p, req.params.id);
        if (session) break;
      }
    }

    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', (req, res) => {
  try {
    const requestedPath = (req.body.projectPath as string) || (req.query.projectPath as string);
    const currentPath = requestedPath || ProjectManager.getCurrentProject();
    const session = SessionManager.saveSession(currentPath, req.body);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    const requestedPath = req.query.projectPath as string;
    const currentPath = requestedPath || ProjectManager.getCurrentProject();
    let success = SessionManager.deleteSession(currentPath, req.params.id);

    if (!success) {
      const config = ConfigManager.getConfig();
      const allPaths = Array.from(new Set([
        ...(config.openProjects || []),
        ...(config.recentProjects || [])
      ])).filter(p => fs.existsSync(p) && p !== currentPath);

      for (const p of allPaths) {
        success = SessionManager.deleteSession(p, req.params.id);
        if (success) break;
      }
    }

    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/search-messages', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const query = (req.query.query as string) || '';
    const matches = SessionManager.searchMessages(currentPath, query);
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Terminal Runner Endpoints
app.post('/api/terminal/run', async (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Comando obrigatório' });
    const result = await TerminalRunner.runCommand(currentPath, command);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/terminal/kill', (req, res) => {
  try {
    const { taskId } = req.body;
    const success = TerminalRunner.killTask(taskId);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/terminal/tasks', (req, res) => {
  res.json(TerminalRunner.listTasks());
});

// 9. Streaming Agent Chat SSE Endpoint
app.post('/api/chat/stream', async (req, res) => {
  const { messages, model, provider, routineId, tokenEfficiency, pipeline, isLiveVoice, executionMode, sessionId, sessionTitle } = req.body;
  const projectPath = ProjectManager.getCurrentProject();
  const config = ConfigManager.getConfig();

  // Resolve Effective Security Preset and Plan Review Policy
  const effectiveSecurity = ProjectSettingsManager.resolveEffectiveSecurity(executionMode, projectPath);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendSSE = (type: string, data: any) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Find system prompt based on routine
  let systemPrompt = 'Você é o Tellus Agent, um assistente de engenharia de software de elite. Você executa tarefas completas usando ferramentas locais sem necessidade de intervenção por terminal manual.';
  if (routineId) {
    const routine = config.customRoutines.find(r => r.id === routineId);
    if (routine) systemPrompt = routine.systemPrompt;
  }

  // Inject Token Efficiency strict instructions if active
  if (tokenEfficiency) {
    systemPrompt += `\n\n[⚡ MODO TOKEN EFFICIENCY ATIVADO - MÁXIMA ECONOMIA DE TOKENS E EXECUÇÃO DIRETA]
- Seja cirúrgico, conciso e 100% focado em executar a ação solicitada sem enrolação.
- NÃO use saudações, introduções ou despedidas ("Olá", "Com certeza!", "Espero ter ajudado", etc.).
- NÃO faça perguntas reflexivas ou loops de confirmação se a ação pretendida for clara no projeto: execute a alteração imediatamente com as ferramentas apropriadas.
- Ao concluir a tarefa, limite sua resposta final a um relatório estritamente estruturado:
  1. Status: ✅ Concluído
  2. Arquivos alterados/criados (com caminhos relativos)
  3. Resumo objetivo da correção/implementação realizada (máx 2-3 linhas).`;
  }

  // Regra fundamental de formato: Texto Puro vs Live Voice
  if (isLiveVoice) {
    systemPrompt += `\n\n[🎙️ RETORNO EM LIVE VOICE ATIVO]
- A sessão atual possui RETORNO EM VOZ ATIVO.
- Inclua no início da sua resposta um bloco [FALA][tag_de_tom] curto (máximo de 2 a 3 frases, cerca de 30 a 45 palavras) para a síntese vocal guiar a entonação do assistente:
  * Use tags de tom como: [thoughtful], [calm], [happy], [whispering], [excited], de acordo com o contexto.
  * NUNCA cite códigos, tabelas ou wikilinks dentro de [FALA].
- Logo após, forneça o detalhamento escrito completo normalmente.`;
  } else {
    systemPrompt += `\n\n[📄 RETORNO EXCLUSIVO EM TEXTO (SEM VOZ)]
- Esta sessão é estritamente em TEXTO (sem sintetizador de voz).
- É EXPRESSAMENTE PROIBIDO incluir tags de voz [FALA], [/FALA] ou tags de tom como [thoughtful], [calm], etc.
- Responda de forma direta, fluída e natural sem qualquer metadado de voz.`;
  }

  // Regra fundamental de retorno textual para conversa e voz (Live Voice Hands-off)
  systemPrompt += `\n\n[REGRA OBRIGATÓRIA DE RETORNO TEXTUAL E LIVE VOICE]
- Sempre que você executar ferramentas (como criar/editar notas, diretórios, arquivos ou executar tarefas), você DEVE OBRIGATORIAMENTE fornecer uma resposta final em texto claro em português confirmando o que realizou.
- Diga ao usuário de forma objetiva e acolhedora: quais diretórios e notas foram criados, onde estão organizados e o status final.
- NUNCA termine um turno com resposta textual vazia: o usuário acompanha por texto e áudio e precisa desse retorno para ter a confirmação imediata sem ter que inspecionar pastas manualmente.`;

  // Model selection with pipeline override support
  const selectedModel = model || pipeline?.primaryModel || config.defaultModel || 'deepseek/deepseek-r1';
  const selectedProvider = provider || config.defaultProvider || 'openrouter';

  const abortController = new AbortController();
  
  // Abort only when client disconnects prematurely before response finishes
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    await AgentLoop.runAutonomousTurn(
      projectPath,
      selectedProvider,
      selectedModel,
      messages,
      systemPrompt,
      (event) => {
        sendSSE(event.type, event.data);
      },
      12,
      abortController.signal,
      effectiveSecurity.preset,
      effectiveSecurity.planReviewPolicy,
      { sessionId, sessionTitle }
    );

    sendSSE('done', { status: 'completed' });
    res.end();
  } catch (err: any) {
    if (!abortController.signal.aborted) {
      sendSSE('error', { message: err.message || 'Erro durante a execução do agente' });
    }
    res.end();
  }
});

// Voice Endpoints: Multi-Provider Speech-To-Text (Whisper, OpenRouter Gemini 2.5 Flash, Direct Audio)
app.post('/api/voice/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Nenhum dado de áudio fornecido.' });
    }

    const config = ConfigManager.getConfig();
    const openaiKey = config.keys.openai;
    const openrouterKey = config.keys.openrouter;
    const googleKey = config.keys.google;
    const ext = mimeType?.includes('wav') ? 'wav' : (mimeType?.includes('mp3') ? 'mp3' : 'wav');
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    console.log(`[Voice Transcribe] Recebido áudio de ${audioBuffer.length} bytes (${ext}). Iniciando transcrição...`);

    // 1. OpenAI Whisper se chave estiver configurada
    if (openaiKey) {
      try {
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: mimeType || 'audio/wav' });
        formData.append('file', blob, `audio.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');
        formData.append('prompt', 'Vocabulário técnico em inglês e português: Fish API, Fish Audio, TTS, API, Whisper, OpenRouter, ElevenLabs, DeepSeek, Gemini, LLM, prompt, token, pipeline, GitHub, React, Vite, Node.js, Markdown, Obsidian Vault.');

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`
          },
          body: formData
        });

        if (whisperResponse.ok) {
          const result: any = await whisperResponse.json();
          let text = (result.text || '').trim();
          text = normalizeVoiceVocabulary(text);
          console.log(`[Voice Transcribe] OpenAI Whisper sucesso: "${text}"`);
          return res.json({ text, provider: 'whisper-1' });
        }
      } catch (err: any) {
        console.warn('[Voice Transcribe] OpenAI Whisper falhou, tentando fallback:', err.message);
      }
    }

    // 2. Google Gemini Oficial (se chave direta do Google estiver presente)
    if (googleKey) {
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: 'Transcreva com máxima precisão o que foi falado no áudio. O áudio é em português do Brasil com termos técnicos e nomes em inglês (por exemplo: Fish API, Fish Audio, TTS, API, Whisper, DeepSeek, OpenRouter, ElevenLabs, Gemini, LLM, prompts, tokens, pipeline, Docker, GitHub, etc.). NUNCA confunda "Fish API" ou "Fish Audio" com "ficha", "ficha pi" ou "peixe". Se não houver fala compreensível ou se for apenas ruído ambiente ou silêncio, responda exatamente: SILENCIO. Caso haja fala, responda APENAS o texto exato transcrito com os termos técnicos corretos em inglês preservados.' },
                  {
                    inlineData: {
                      mimeType: 'audio/wav',
                      data: audioBase64
                    }
                  }
                ]
              }
            ]
          })
        });

        if (geminiRes.ok) {
          const gData: any = await geminiRes.json();
          let transcription = (gData.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
          transcription = transcription.replace(/^["']|["']$/g, '').trim();
          if (/^sil[eê]ncio\.?$/i.test(transcription)) {
            transcription = '';
          } else {
            transcription = normalizeVoiceVocabulary(transcription);
          }
          console.log(`[Voice Transcribe] Google Gemini Oficial sucesso: "${transcription}"`);
          return res.json({ text: transcription, provider: 'google:gemini-2.0-flash' });
        }
      } catch (err: any) {
        console.warn('[Voice Transcribe] Google Gemini direto falhou, tentando fallback:', err.message);
      }
    }

    // 3. OpenRouter com Gemini 2.5 Flash / Flash Lite / GPT Audio
    if (openrouterKey) {
      const modelsToTry = [
        'google/gemini-2.5-flash',
        'google/gemini-2.5-flash-lite',
        'google/gemini-3.5-flash',
        'openai/gpt-audio-mini'
      ];
      for (const modelName of modelsToTry) {
        try {
          const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Transcreva o áudio falado com máxima precisão. O áudio é em português com termos e nomes técnicos em inglês (por exemplo: Fish API, Fish Audio, TTS, API, Whisper, DeepSeek, OpenRouter, ElevenLabs, Gemini, LLM, prompts, tokens, pipeline, Docker, GitHub, etc.). NUNCA confunda "Fish API" ou "Fish Audio" com "ficha", "ficha pi" ou "peixe". Se não houver fala humana compreensível ou se for apenas ruído ambiente ou silêncio, responda exatamente: SILENCIO. Caso haja fala, responda APENAS o texto exato transcrito com os termos técnicos corretos em inglês preservados.'
                    },
                    {
                      type: 'input_audio',
                      input_audio: {
                        data: audioBase64,
                        format: 'wav'
                      }
                    }
                  ]
                }
              ]
            })
          });

          if (orResponse.ok) {
            const orData: any = await orResponse.json();
            let transcription = (orData.choices?.[0]?.message?.content || '').trim();
            transcription = transcription.replace(/^["']|["']$/g, '').trim();
            if (/^sil[eê]ncio\.?$/i.test(transcription)) {
              console.log(`[Voice Transcribe] OpenRouter (${modelName}) detectou silêncio.`);
              return res.json({ text: '', provider: `openrouter:${modelName}`, isSilent: true });
            }
            transcription = normalizeVoiceVocabulary(transcription);
            console.log(`[Voice Transcribe] OpenRouter (${modelName}) sucesso: "${transcription}"`);
            return res.json({ text: transcription, provider: `openrouter:${modelName}` });
          } else {
            const errText = await orResponse.text();
            console.warn(`[Voice Transcribe] OpenRouter (${modelName}) erro:`, orResponse.status, errText);
          }
        } catch (err: any) {
          console.warn(`[Voice Transcribe] OpenRouter (${modelName}) falhou:`, err.message);
        }
      }
    }

    return res.status(400).json({
      error: 'Nenhum provedor de transcrição de áudio configurado (configure OpenRouter ou OpenAI nas configurações).'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Falha ao transcrever áudio' });
  }
});

app.get('/api/voice/status', (req, res) => {
  const config = ConfigManager.getConfig();
  const hasTranscriber = !!config.keys.openrouter || !!config.keys.openai;
  res.json({
    hasWhisper: hasTranscriber,
    hasOpenRouter: !!config.keys.openrouter,
    webSpeechAvailable: true
  });
});

// Serve Client Dist statically if built
const candidateDistPaths = [
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist'),
];
const activeDist = candidateDistPaths.find(p => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) || null;

if (activeDist) {
  app.use(express.static(activeDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/events')) return next();
    res.sendFile(path.join(activeDist, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Agentic IDE Server rodando na porta ${PORT}`);
  console.log(`📁 Projeto ativo padrão: ${ProjectManager.getCurrentProject()}`);
});
