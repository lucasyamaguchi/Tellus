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

  // Generate Interactive Projects & Architecture Graph
  public static getProjectsGraphData(): {
    nodes: Array<{ id: string; label: string; type: string; val: number; color?: string; details?: string }>;
    links: Array<{ source: string; target: string; type: string }>;
  } {
    const config = ConfigManager.getConfig();
    const currentPath = this.getCurrentProject();
    const allProjectPaths = Array.from(new Set([
      currentPath,
      ...(config.openProjects || []),
      ...(config.recentProjects || [])
    ])).filter(p => fs.existsSync(p));

    const nodes: Array<{ id: string; label: string; type: string; val: number; color?: string; details?: string }> = [];
    const links: Array<{ source: string; target: string; type: string }> = [];

    for (const projPath of allProjectPaths) {
      const resolved = path.resolve(projPath);
      const projName = path.basename(resolved);
      const isCurrent = resolved.toLowerCase() === currentPath.toLowerCase();
      const projId = 'proj_' + projName.toLowerCase().replace(/[^a-z0-9]/g, '_');

      // 1. Central Project Node
      nodes.push({
        id: projId,
        label: isCurrent ? `⭐ ${projName} (Ativo)` : `🚀 ${projName}`,
        type: 'project',
        val: isCurrent ? 24 : 18,
        color: isCurrent ? '#6366f1' : '#3b82f6',
        details: `Caminho do projeto: ${resolved}`
      });

      // 2. Project Modules & Top-Level Folders
      try {
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const topFolders = entries
          .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist')
          .slice(0, 8);

        for (const folder of topFolders) {
          const modId = `${projId}_mod_${folder.name}`;
          nodes.push({
            id: modId,
            label: `📁 ${folder.name}`,
            type: 'module',
            val: 12,
            color: '#38bdf8',
            details: `Módulo / Diretório de ${projName}: ${folder.name}`
          });

          links.push({
            source: projId,
            target: modId,
            type: 'proj_module'
          });
        }
      } catch {
        // ignore read errors
      }

      // 3. Project Architectural Memories (.agentic/memory)
      try {
        const memPages = MemoryEngine.listMemoryPages(resolved);
        for (const mem of memPages.slice(0, 6)) {
          const safeFilename = mem.filename.replace(/\.md$/i, '').replace(/[^a-z0-9]/gi, '_');
          const memId = `${projId}_mem_${safeFilename}`;
          nodes.push({
            id: memId,
            label: `🧠 ${mem.title}`,
            type: 'memory',
            val: 10,
            color: '#ec4899',
            details: `Decisão de memória arquitetural gravada para ${projName}: ${mem.title}`
          });

          links.push({
            source: projId,
            target: memId,
            type: 'proj_memory'
          });
        }
      } catch {
        // ignore
      }
    }

    // 4. Global / Configured Routines connected to Projects
    const routines = config.customRoutines || [];
    for (const routine of routines) {
      const routineId = `routine_${routine.id}`;
      nodes.push({
        id: routineId,
        label: `⚡ ${routine.name}`,
        type: 'routine',
        val: 13,
        color: '#10b981',
        details: `Rotina automatizada de desenvolvimento: ${routine.name}`
      });

      // Connect routine to all open projects
      for (const projPath of allProjectPaths) {
        const projName = path.basename(projPath);
        const projId = 'proj_' + projName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        links.push({
          source: routineId,
          target: projId,
          type: 'proj_routine'
        });
      }
    }

    return { nodes, links };
  }
}

