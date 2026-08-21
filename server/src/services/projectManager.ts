import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ConfigManager } from './configManager.js';
import { MemoryEngine } from './memory/memoryEngine.js';
import { FileTools } from './tools/fileTools.js';

export class ProjectManager {
  public static getCurrentProject(): string {
    const config = ConfigManager.getConfig();
    if (config.currentProject && fs.existsSync(config.currentProject)) {
      return config.currentProject;
    }
    if (config.recentProjects.length > 0 && fs.existsSync(config.recentProjects[0])) {
      return config.recentProjects[0];
    }
    // Default fallback to workspace root
    return process.cwd();
  }

  public static openProject(projectPath: string): { success: boolean; path: string } {
    const resolved = path.resolve(projectPath);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    MemoryEngine.initProjectMemory(resolved);
    ConfigManager.addRecentProject(resolved);

    // Also track in openProjects
    const currentConfig = ConfigManager.getConfig();
    const currentOpen = currentConfig.openProjects || [];
    if (!currentOpen.includes(resolved)) {
      ConfigManager.updateConfig({
        openProjects: [resolved, ...currentOpen.filter(p => p !== resolved)]
      });
    }

    return { success: true, path: resolved };
  }

  public static closeOpenProject(projectPath: string): { success: boolean; openProjects: string[] } {
    const resolved = path.resolve(projectPath);
    const currentConfig = ConfigManager.getConfig();
    const updated = (currentConfig.openProjects || []).filter(p => path.resolve(p) !== resolved);
    ConfigManager.updateConfig({ openProjects: updated });
    return { success: true, openProjects: updated };
  }

  public static getOpenProjects(): string[] {
    const config = ConfigManager.getConfig();
    const current = this.getCurrentProject();
    const raw = config.openProjects || [];
    if (!raw.includes(current)) {
      raw.unshift(current);
    }
    return raw.filter(p => fs.existsSync(p));
  }

  public static async pickDirectory(): Promise<string | null> {
    return new Promise((resolve) => {
      // Use PowerShell to open Windows FolderBrowserDialog
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.Description = "Selecione a pasta do projeto para o Tellus"
        $f.ShowNewFolderButton = $true
        if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          [Console]::WriteLine($f.SelectedPath)
        }
      `;
      const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        windowsHide: false
      });

      let stdout = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.on('close', () => {
        const picked = stdout.trim();
        if (picked && fs.existsSync(picked)) {
          resolve(picked);
        } else {
          resolve(null);
        }
      });
      child.on('error', () => resolve(null));
    });
  }

  public static getProjectOverview(projectPath: string) {
    const resolved = path.resolve(projectPath);
    MemoryEngine.initProjectMemory(resolved);

    const activeContext = MemoryEngine.getActiveContext(resolved);
    const memoryPages = MemoryEngine.listMemoryPages(resolved);
    const fileTree = FileTools.getFileTree(resolved);

    return {
      path: resolved,
      name: path.basename(resolved),
      activeContext,
      memoryPagesCount: memoryPages.length,
      memoryPages,
      fileTree
    };
  }
}
