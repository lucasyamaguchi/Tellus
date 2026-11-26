import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { ConfigManager, resolveDefaultProjectsRoot } from './configManager.js';
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
    // Default fallback: if running inside a packaged app bundle, use ~/Documents/Tellus Workspace
    const isPackagedBundle = process.cwd().includes('resources') || process.cwd().includes('AppData') || process.cwd().includes('Program Files');
    if (isPackagedBundle) {
      const defaultWorkspace = path.join(os.homedir(), 'Documents', 'Tellus Workspace');
      if (!fs.existsSync(defaultWorkspace)) {
        try { fs.mkdirSync(defaultWorkspace, { recursive: true }); } catch {}
      }
      return defaultWorkspace;
    }
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

  public static getProjectsRoot(): string {
    if (process.env.TELLUS_PROJECTS_DIR && fs.existsSync(process.env.TELLUS_PROJECTS_DIR)) {
      return path.resolve(process.env.TELLUS_PROJECTS_DIR);
    }
    const config = ConfigManager.getConfig();
    if (config.projectsRoot && fs.existsSync(config.projectsRoot)) {
      return path.resolve(config.projectsRoot);
    }
    return resolveDefaultProjectsRoot();
  }

  public static setProjectsRoot(newRoot: string): { success: boolean; projectsRoot: string } {
    const resolved = path.resolve(newRoot);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    ConfigManager.updateConfig({ projectsRoot: resolved });
    return { success: true, projectsRoot: resolved };
  }

  public static listDiscoveredProjects(): Array<{
    name: string;
    path: string;
    isCurrent: boolean;
    isOpen: boolean;
    hasAgentic: boolean;
    lastModified: number;
    modulesCount: number;
    artifactsCount: number;
  }> {
    const rootDir = this.getProjectsRoot();
    const currentPath = path.resolve(this.getCurrentProject()).toLowerCase();
    const config = ConfigManager.getConfig();
    const openSet = new Set((config.openProjects || []).map(p => path.resolve(p).toLowerCase()));

    const candidatePaths = new Map<string, string>();

    // 1. Scan default projects root
    if (fs.existsSync(rootDir)) {
      try {
        const entries = fs.readdirSync(rootDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '$RECYCLE.BIN') {
            const fullPath = path.join(rootDir, entry.name);
            candidatePaths.set(fullPath.toLowerCase(), fullPath);
          }
        }
      } catch {}
    }

    // 2. Include current, open, and recent projects
    const extra = [
      this.getCurrentProject(),
      ...(config.openProjects || []),
      ...(config.recentProjects || [])
    ];
    for (const p of extra) {
      if (p && fs.existsSync(p)) {
        const resolved = path.resolve(p);
        candidatePaths.set(resolved.toLowerCase(), resolved);
      }
    }

    const result = [];
    for (const [, fullPath] of candidatePaths) {
      try {
        const stat = fs.statSync(fullPath);
        const name = path.basename(fullPath);
        const hasAgentic = fs.existsSync(path.join(fullPath, '.agentic'));
        let modulesCount = 0;
        try {
          const subs = fs.readdirSync(fullPath, { withFileTypes: true });
          modulesCount = subs.filter(s => s.isDirectory() && !s.name.startsWith('.') && s.name !== 'node_modules' && s.name !== 'dist').length;
        } catch {}

        let artifactsCount = 0;
        const artifactsDir = path.join(fullPath, '.agentic', 'artifacts');
        if (fs.existsSync(artifactsDir)) {
          try {
            artifactsCount = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.md')).length;
          } catch {}
        }

        result.push({
          name,
          path: fullPath,
          isCurrent: fullPath.toLowerCase() === currentPath,
          isOpen: openSet.has(fullPath.toLowerCase()) || fullPath.toLowerCase() === currentPath,
          hasAgentic,
          lastModified: stat.mtimeMs,
          modulesCount,
          artifactsCount
        });
      } catch {}
    }

    return result.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
      return a.name.localeCompare(b.name);
    });
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
    nodes: Array<{ id: string; label: string; type: string; val: number; color?: string; details?: string; path?: string }>;
    links: Array<{ source: string; target: string; type: string }>;
  } {
    const config = ConfigManager.getConfig();
    const currentPath = path.resolve(this.getCurrentProject()).toLowerCase();
    const discovered = this.listDiscoveredProjects();

    const nodes: Array<{ id: string; label: string; type: string; val: number; color?: string; details?: string; path?: string }> = [];
    const links: Array<{ source: string; target: string; type: string }> = [];

    for (const proj of discovered) {
      const resolved = path.resolve(proj.path);
      const isCurrent = resolved.toLowerCase() === currentPath;
      const projId = 'proj_' + proj.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

      // 1. Central Project Node
      nodes.push({
        id: projId,
        label: isCurrent ? `⭐ ${proj.name} (Ativo)` : (proj.isOpen ? `🚀 ${proj.name}` : `📁 ${proj.name}`),
        type: 'project',
        val: isCurrent ? 26 : (proj.isOpen ? 20 : 16),
        color: isCurrent ? '#6366f1' : (proj.isOpen ? '#3b82f6' : '#64748b'),
        details: `Caminho do projeto: ${resolved}\n${proj.modulesCount} pastas/módulos • ${proj.artifactsCount} artefatos/anotações`,
        path: resolved
      });

      // 2. Project Modules & Top-Level Folders
      try {
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const topFolders = entries
          .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist')
          .slice(0, 8);

        for (const folder of topFolders) {
          const modId = `${projId}_mod_${folder.name.replace(/[^a-z0-9]/gi, '_')}`;
          nodes.push({
            id: modId,
            label: `📁 ${folder.name}`,
            type: 'module',
            val: 11,
            color: '#38bdf8',
            details: `Módulo / Diretório de ${proj.name}: ${folder.name}`
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
            details: `Decisão de memória arquitetural de ${proj.name}: ${mem.title}`,
            path: path.join(resolved, '.agentic', 'memory', mem.filename)
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

      // 4. Project Artifacts & Plans (.agentic/artifacts)
      try {
        const artifactsDir = path.join(resolved, '.agentic', 'artifacts');
        if (fs.existsSync(artifactsDir)) {
          const artFiles = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.md'));
          for (const artFile of artFiles.slice(0, 6)) {
            const safeArtName = artFile.replace(/\.md$/i, '').replace(/[^a-z0-9]/gi, '_');
            const artId = `${projId}_art_${safeArtName}`;
            const artPath = path.join(artifactsDir, artFile);
            let artTitle = artFile.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
            try {
              const headLine = fs.readFileSync(artPath, 'utf-8').split('\n')[0] || '';
              const headMatch = headLine.match(/^#+\s*(.*)/);
              if (headMatch) artTitle = headMatch[1].trim();
            } catch {}

            nodes.push({
              id: artId,
              label: `📄 ${artTitle}`,
              type: 'artifact',
              val: 12,
              color: '#10b981',
              details: `Plano / Artefato de ${proj.name}: ${artTitle}\n${artPath}`,
              path: artPath
            });

            links.push({
              source: projId,
              target: artId,
              type: 'proj_artifact'
            });
          }
        }
      } catch {
        // ignore
      }
    }

    // 5. Global / Configured Routines connected to Projects
    const routines = config.customRoutines || [];
    for (const routine of routines) {
      const routineId = `routine_${routine.id}`;
      nodes.push({
        id: routineId,
        label: `⚡ ${routine.name}`,
        type: 'routine',
        val: 13,
        color: '#f59e0b',
        details: `Rotina automatizada de desenvolvimento: ${routine.name}`
      });

      // Connect routine to open projects
      for (const proj of discovered.filter(p => p.isOpen || p.isCurrent)) {
        const projId = 'proj_' + proj.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
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

