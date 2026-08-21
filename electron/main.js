import { app, BrowserWindow, shell, nativeImage, desktopCapturer, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let overlayWindow = null;
let serverProcess = null;

const SERVER_PORT = 3001;

function startBackendServer() {
  const rootDir = path.resolve(__dirname, '..');
  const serverDir = path.join(rootDir, 'server');
  const serverDistScript = path.join(serverDir, 'dist', 'index.js');

  const hasBuiltServer = fs.existsSync(serverDistScript);
  const execPath = 'node';
  const execArgs = hasBuiltServer 
    ? ['dist/index.js'] 
    : ['--loader', 'ts-node/esm', 'src/index.ts'];

  console.log(`[Electron] Inicializando backend server silenciosamente...`);

  serverProcess = spawn(execPath, execArgs, {
    cwd: serverDir,
    shell: true,
    env: { ...process.env, PORT: String(SERVER_PORT) },
    stdio: 'ignore'
  });

  serverProcess.on('error', (err) => {
    console.error('[Electron] Falha ao iniciar servidor backend:', err);
  });
}

function waitForServer(callback, retries = 40) {
  if (retries <= 0) {
    console.warn('[Electron] Timeout aguardando backend, inicializando janela...');
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
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
