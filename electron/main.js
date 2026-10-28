import { app, BrowserWindow, shell, nativeImage, desktopCapturer, ipcMain, session, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure Windows Taskbar uses the same AppUserModelID
app.setAppUserModelId('Tellus.AgenticIDE');

// Automatically permit microphone and media hardware access directly on PC
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'microphone') {
      return callback(true);
    }
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow = null;
let overlayWindow = null;
let serverProcess = null;

const SERVER_PORT = 3001;

function killPortProcess(port) {
  if (process.platform === 'win32') {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        }
      }
    } catch {}
  }
}

function killServerProcess() {
  if (serverProcess && serverProcess.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${serverProcess.pid} /f /t`, { stdio: 'ignore' });
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {}
  }
}

function startBackendServer() {
  const rootDir = path.resolve(__dirname, '..');
  const serverDir = path.join(rootDir, 'server');
  const serverDistScript = path.join(serverDir, 'dist', 'index.js');

  // Terminate any stale orphan server holding the port
  killPortProcess(SERVER_PORT);

  const hasBuiltServer = fs.existsSync(serverDistScript);
  // Use Electron's embedded Node runtime when running built dist/index.js so target PCs don't need Node installed
  const useEmbeddedNode = hasBuiltServer && app.isPackaged;
  const execPath = useEmbeddedNode ? process.execPath : 'node';
  const execArgs = hasBuiltServer 
    ? [serverDistScript] 
    : ['--loader', 'ts-node/esm', 'src/index.ts'];

  console.log(`[Electron] Inicializando backend server (${useEmbeddedNode ? 'Embedded Node' : 'System Node'})...`);

  // Ensure log directory exists
  const logDir = app.getPath('userData');
  if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
  }
  const logFile = path.join(logDir, 'tellus-server.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  serverProcess = spawn(execPath, execArgs, {
    cwd: serverDir,
    shell: !useEmbeddedNode,
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      ...(useEmbeddedNode ? { ELECTRON_RUN_AS_NODE: '1' } : {})
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout?.pipe(logStream);
  serverProcess.stderr?.pipe(logStream);
  if (!app.isPackaged) {
    serverProcess.stdout?.pipe(process.stdout);
    serverProcess.stderr?.pipe(process.stderr);
  }

  serverProcess.on('error', (err) => {
    console.error('[Electron] Falha ao iniciar servidor backend:', err);
    try {
      fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] Spawn Error: ${err.message}\n`);
    } catch {}
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`[Electron] Servidor backend finalizou com código ${code}, sinal ${signal}`);
    try {
      fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] Server Exited: code=${code}, signal=${signal}\n`);
    } catch {}
  });
}

function waitForServer(callback, retries = 40) {
  if (retries <= 0) {
    console.warn('[Electron] Timeout aguardando backend, inicializando janela...');
    if (app.isPackaged && serverProcess && serverProcess.exitCode !== null) {
      dialog.showErrorBox(
        'Tellus - Falha na Inicialização',
        `O servidor backend interno encerrou inesperadamente (código ${serverProcess.exitCode}).\nConsulte o arquivo de log para detalhes:\n${path.join(app.getPath('userData'), 'tellus-server.log')}`
      );
    }
    callback();
    return;
  }

  const req = http.get(`http://localhost:${SERVER_PORT}/api/config`, (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => waitForServer(callback, retries - 1), 250);
    }
  });

  req.on('error', () => {
    setTimeout(() => waitForServer(callback, retries - 1), 250);
  });
}

function createMainWindow() {
  const iconPath = path.resolve(__dirname, '..', 'resources', 'icon.ico');
  const iconPngPath = path.resolve(__dirname, '..', 'resources', 'icon.png');
  
  let appIcon = undefined;
  if (fs.existsSync(iconPath)) {
    appIcon = nativeImage.createFromPath(iconPath);
  } else if (fs.existsSync(iconPngPath)) {
    appIcon = nativeImage.createFromPath(iconPngPath);
  }

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 890,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: 'Tellus',
    backgroundColor: '#090a0f',
    icon: appIcon,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      mainWindow?.loadURL(`http://localhost:${SERVER_PORT}`);
    }, 1000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.focus();
    return;
  }

  const iconPath = path.resolve(__dirname, '..', 'resources', 'icon.ico');

  overlayWindow = new BrowserWindow({
    width: 360,
    height: 520,
    minWidth: 300,
    minHeight: 300,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: true,
    backgroundColor: '#00000000',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  overlayWindow.loadURL(`http://localhost:${SERVER_PORT}?overlay=true`);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('Tellus.AgenticIDE');
  startBackendServer();
  waitForServer(() => {
    createMainWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  killServerProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killServerProcess();
});
