import fs from 'fs';
import path from 'path';

export interface FileTreeItem {
  name: string;
  path: string; // relative
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeItem[];
}

export class FileTools {
  private static getSafePath(projectPath: string, relativePath: string): string {
    const resolved = path.resolve(projectPath, relativePath);
    if (!resolved.startsWith(path.resolve(projectPath))) {
      throw new Error(`Acesso negado: Caminho fora do diretório do projeto (${relativePath})`);
    }
    return resolved;
  }

  public static readFile(projectPath: string, relativePath: string): { content: string; size: number } {
    const fullPath = this.getSafePath(projectPath, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado: ${relativePath}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`O caminho especificado é um diretório, não um arquivo: ${relativePath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { content, size: stat.size };
  }

  public static writeFile(projectPath: string, relativePath: string, content: string): { success: boolean; bytesWritten: number } {
    const fullPath = this.getSafePath(projectPath, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true, bytesWritten: Buffer.byteLength(content, 'utf-8') };
  }

  public static editFile(
    projectPath: string,
    relativePath: string,
    targetContent: string,
    replacementContent: string
  ): { success: boolean; message: string } {
    const fullPath = this.getSafePath(projectPath, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado para edição: ${relativePath}`);
    }
    const existing = fs.readFileSync(fullPath, 'utf-8');
    if (!existing.includes(targetContent)) {
      throw new Error(`TargetContent não encontrado no arquivo ${relativePath}. Verifique o texto exato.`);
    }
    const occurrences = existing.split(targetContent).length - 1;
    if (occurrences > 1) {
      throw new Error(`TargetContent encontrado ${occurrences} vezes no arquivo. Forneça mais linhas de contexto para unicidade.`);
    }

    const updated = existing.replace(targetContent, replacementContent);
    fs.writeFileSync(fullPath, updated, 'utf-8');
    return { success: true, message: `Arquivo ${relativePath} atualizado com sucesso.` };
  }

  public static listDir(projectPath: string, relativePath = '.', maxDepth = 2): string[] {
    const fullPath = this.getSafePath(projectPath, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Diretório não encontrado: ${relativePath}`);
    }

    const results: string[] = [];
    const walk = (currentPath: string, currentDepth: number) => {
      if (currentDepth > maxDepth) return;
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.next') {
          continue;
        }
        const entryFullPath = path.join(currentPath, entry.name);
        const rel = path.relative(projectPath, entryFullPath).replace(/\\/g, '/');
        results.push(entry.isDirectory() ? `${rel}/` : rel);

        if (entry.isDirectory()) {
          walk(entryFullPath, currentDepth + 1);
        }
      }
    };

    walk(fullPath, 1);
    return results;
  }

  public static grepSearch(projectPath: string, query: string, pathFilter?: string): Array<{ file: string; line: number; text: string }> {
    const files = this.listDir(projectPath, pathFilter || '.', 5);
    const matches: Array<{ file: string; line: number; text: string }> = [];
    const lowerQuery = query.toLowerCase();

    for (const relFile of files) {
      if (relFile.endsWith('/')) continue;
      try {
        const fullPath = path.join(projectPath, relFile);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            matches.push({
              file: relFile,
              line: i + 1,
              text: lines[i].trim()
            });
            if (matches.length >= 50) break;
          }
        }
      } catch {
        // ignore binary or unreadable files
      }
      if (matches.length >= 50) break;
    }

    return matches;
  }

  public static getFileTree(projectPath: string, relativeDir = ''): FileTreeItem[] {
    const fullDir = path.join(projectPath, relativeDir);
    if (!fs.existsSync(fullDir)) return [];

    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    const items: FileTreeItem[] = [];

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.next' || entry.name === '.agentic') {
        continue;
      }
      const entryRelPath = path.join(relativeDir, entry.name).replace(/\\/g, '/');
      const entryFullPath = path.join(fullDir, entry.name);

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: entryRelPath,
          type: 'directory',
          children: this.getFileTree(projectPath, entryRelPath)
        });
      } else {
        const stat = fs.statSync(entryFullPath);
        items.push({
          name: entry.name,
          path: entryRelPath,
          type: 'file',
          size: stat.size
        });
      }
    }

    // Sort directories first, then alphabetical
    return items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  }
}
