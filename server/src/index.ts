import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ConfigManager } from './services/configManager.js';
import { OpenRouterService } from './services/providers/openrouter.js';
import { ProjectManager } from './services/projectManager.js';
import { MemoryEngine } from './services/memory/memoryEngine.js';
import { FileTools } from './services/tools/fileTools.js';
import { FileParser } from './services/tools/fileParser.js';
import { ScreenCapture } from './services/tools/screenCapture.js';
import { TerminalRunner } from './services/tools/terminalRunner.js';
import { SessionManager } from './services/sessionManager.js';
import { AgentLoop, sanitizePortugueseText } from './services/agentLoop.js';
import { FrankNoteEngine } from './services/notes/frankNoteEngine.js';
import { SmartOrganizer } from './services/notes/smartOrganizer.js';
import { SkillManager } from './services/skills/skillManager.js';
import { ProviderHub } from './services/providers/providerHub.js';
import { PrivacySanitizer } from './services/security/privacySanitizer.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api/notes/attachments', express.static(FrankNoteEngine.ATTACHMENTS_DIR));

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

    res.json({
      curated: curatedProviders,
      all: openRouterModels
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

// FrankMD Note Taker & Knowledge Graph
app.get('/api/notes', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const notes = FrankNoteEngine.listNotes(currentPath);
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const note = FrankNoteEngine.saveNote(req.body, currentPath);
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
    const results = FrankNoteEngine.searchNotes(query || '', { folder, limit }, currentPath);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Folders Management Routes (Declared BEFORE :id to prevent route hijacking)
app.get('/api/notes/folders', (req, res) => {
  try {
    const folders = FrankNoteEngine.listFolders();
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
    const success = FrankNoteEngine.createFolder(name.trim());
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
    const success = FrankNoteEngine.moveFolder(sourceFolder, targetParentFolder || '');
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
    const result = FrankNoteEngine.deleteFolder(folderName, currentPath);

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
    const attachment = FrankNoteEngine.saveAttachment(filename || 'imagem.png', buffer);
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
    const result = FrankNoteEngine.importNotionNotes(items);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notes/graph', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const graphData = FrankNoteEngine.getGraphData(currentPath);
    res.json(graphData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dropzone Smart Auto-Organizer Endpoint
app.post('/api/vault/dropzone-organize', async (req, res) => {
  try {
    const { files, customVaultDir } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado para organização.' });
    }
    const report = await SmartOrganizer.organizeFiles(files, customVaultDir);
    res.json(report);
  } catch (err: any) {
    console.error('[Dropzone Organize Error]', err);
    res.status(500).json({ error: err.message || 'Falha ao organizar arquivos na dropzone' });
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
      FrankNoteEngine.cleanupExpiredBackups(config.deletedNotesRetention);
    }
    const items = FrankNoteEngine.listDeletedNotes(currentPath);
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
    const restoredNote = FrankNoteEngine.restoreDeletedNote(backupFilename, currentPath);
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
      const success = FrankNoteEngine.permanentlyDeleteNote(backupFilename);
      return res.json({ success });
    }
    const result = FrankNoteEngine.emptyTrash();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/trash/cleanup', (req, res) => {
  try {
    const config = ConfigManager.getConfig();
    const retention = req.body.retention || config.deletedNotesRetention || '90_days';
    const cleanedCount = FrankNoteEngine.cleanupExpiredBackups(retention);
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

// Parameterized Individual Note Routes
app.post('/api/notes/:id/move', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const { targetFolder } = req.body;
    if (!targetFolder) {
      return res.status(400).json({ error: 'targetFolder é obrigatório' });
    }
    const updatedNote = FrankNoteEngine.moveNote(req.params.id, targetFolder, currentPath);
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
    const success = FrankNoteEngine.deleteNote(req.params.id, isProjectSpecific, currentPath);

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

// Sintetizar e criar uma nota do FrankMD a partir do chat atual
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
        content: `Você é o sintetizador de conhecimento do Notes Module (módulo de notas baseado nas arquiteturas Frank MD e AI-Memory).
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

    const savedNote = FrankNoteEngine.saveNote({
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
    const { filename, content, isProjectSpecific, targetProjectPath } = req.body;
    const targetPath = targetProjectPath || ProjectManager.getCurrentProject();
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Conteúdo da skill é obrigatório' });
    }
    const skill = SkillManager.importMarkdownSkill(
      filename || 'imported_skill.md',
      content,
      isProjectSpecific,
      targetPath
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
    const currentPath = ProjectManager.getCurrentProject();
    const sessions = SessionManager.listSessions(currentPath);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const session = SessionManager.getSession(currentPath, req.params.id);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const session = SessionManager.saveSession(currentPath, req.body);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    const currentPath = ProjectManager.getCurrentProject();
    const success = SessionManager.deleteSession(currentPath, req.params.id);
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
  const { messages, model, provider, routineId, tokenEfficiency, pipeline } = req.body;
  const projectPath = ProjectManager.getCurrentProject();
  const config = ConfigManager.getConfig();

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
      abortController.signal
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

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`
          },
          body: formData
        });

        if (whisperResponse.ok) {
          const result: any = await whisperResponse.json();
          const text = (result.text || '').trim();
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
                  { text: 'Transcreva com precisão o que foi dito em português do Brasil neste áudio. Se não houver fala compreensível ou se for apenas ruído ambiente ou silêncio, responda exatamente: SILENCIO. Caso haja fala, responda APENAS o texto exato transcrito, sem aspas ou introduções.' },
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
                      text: 'Transcreva o áudio falado em português do Brasil com máxima precisão. Se não houver fala humana compreensível ou se for apenas ruído ambiente ou silêncio, responda exatamente: SILENCIO. Caso haja fala, responda APENAS o texto exato transcrito, sem introduções, aspas ou comentários adicionais.'
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
const clientDistPath = path.resolve(process.cwd(), '../client/dist');
const altClientDistPath = path.resolve(process.cwd(), 'client/dist');
const activeDist = fs.existsSync(clientDistPath) ? clientDistPath : (fs.existsSync(altClientDistPath) ? altClientDistPath : null);

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
