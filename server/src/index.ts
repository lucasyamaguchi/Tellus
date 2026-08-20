import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from './services/configManager.js';
import { OpenRouterService } from './services/providers/openrouter.js';
import { ProjectManager } from './services/projectManager.js';
import { MemoryEngine } from './services/memory/memoryEngine.js';
import { FileTools } from './services/tools/fileTools.js';
import { FileParser } from './services/tools/fileParser.js';
import { ScreenCapture } from './services/tools/screenCapture.js';
import { TerminalRunner } from './services/tools/terminalRunner.js';
import { SessionManager } from './services/sessionManager.js';
import { AgentLoop } from './services/agentLoop.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
  const { messages, model, provider, routineId } = req.body;
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
  let systemPrompt = 'Você é o Antigravity Local Agent, um assistente de engenharia de software de elite. Você executa tarefas completas usando ferramentas locais sem necessidade de intervenção por terminal manual.';
  if (routineId) {
    const routine = config.customRoutines.find(r => r.id === routineId);
    if (routine) systemPrompt = routine.systemPrompt;
  }

  const selectedModel = model || config.defaultModel;
  const selectedProvider = provider || config.defaultProvider;

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
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
    sendSSE('error', { message: err.message || 'Erro durante o streaming' });
    res.end();
  }
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
