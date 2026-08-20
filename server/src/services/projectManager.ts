import fs from 'fs';
import path from 'path';
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

    return { success: true, path: resolved };
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
