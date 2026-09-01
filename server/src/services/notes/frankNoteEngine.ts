import fs from 'fs';
import path from 'path';

// Diretório fixo do cofre Obsidian usado pelo FrankMD.
// No Windows, este caminho representa o volume E: e não depende do diretório
// de execução do servidor.
const OBSIDIAN_VAULT_DIR = 'E:\\Die-Sonne\\Vault';

export interface FrankNote {
  id: string;
  title: string;
  filename: string;
  folder: string; // e.g. "Estudos - Arquitetura de Software", "Geral", "Ideias"
  subject: string; // e.g. "Arquitetura", "Segurança", "Ideias", "Geral"
  tags: string[];   // e.g. ["#database", "#performance"]
  content: string;
  links: string[];  // Outbound [[wikilinks]]
  backlinks: string[]; // Inbound notes that reference this note
  createdAt: number;
  updatedAt: number;
  isProjectSpecific?: boolean;
  relativePath: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'subject' | 'tag';
  val: number; // size/weight
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'wikilink' | 'tag' | 'subject';
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const GLOBAL_NOTES_DIR = OBSIDIAN_VAULT_DIR;
const BACKUPS_DIR = path.join(OBSIDIAN_VAULT_DIR, '.backups');

export class FrankNoteEngine {
  private static ensureDirs(projectPath?: string) {
    if (!fs.existsSync(GLOBAL_NOTES_DIR)) {
      fs.mkdirSync(GLOBAL_NOTES_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  }

  // Extract [[Wikilinks]] from markdown content
  private static extractWikilinks(content: string): string[] {
    const matches = content.match(/\[\[(.*?)\]\]/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/\[\[|\]\]/g, '').trim())));
  }

  // Extract #tags from markdown content
  private static extractTags(content: string): string[] {
    const matches = content.match(/#[a-zA-Z0-9_\u00C0-\u00FF-]+/g) || [];
    return Array.from(new Set(matches.map(t => t.toLowerCase())));
  }

  // Sanitize name for folders and files
  public static sanitizeName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  // Extract subject / category from frontmatter or default to "Geral"
  private static parseNote(filePath: string, folderName: string = 'Geral', isProjectSpecific: boolean = false): FrankNote {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const id = filename.replace(/\.md$/i, '');
    const relativePath = path.relative(GLOBAL_NOTES_DIR, filePath);

    // Extract title from first H1 or filename
    const firstLine = content.split('\n')[0] || '';
    const titleMatch = firstLine.match(/^#+\s*(.*)/);
    const title = titleMatch ? titleMatch[1].trim() : id.replace(/[-_]/g, ' ');

    // Extract subject/topic if marked with <!-- subject: xyz --> or default to parent directory
    const subjectMatch = content.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : folderName;

    const tags = this.extractTags(content);
    const links = this.extractWikilinks(content);

    return {
      id,
      title,
      filename,
      folder: folderName,
      subject,
      tags,
      content,
      links,
      backlinks: [],
      createdAt: stat.birthtimeMs || stat.mtimeMs,
      updatedAt: stat.mtimeMs,
      isProjectSpecific,
      relativePath
    };
  }

  public static listNotes(projectPath?: string): FrankNote[] {
    this.ensureDirs(projectPath);
    const notes: FrankNote[] = [];

    const scanDir = (currentDir: string, currentFolder: string) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // skip hidden dirs/files like .backups, .obsidian

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath, entry.name);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          notes.push(this.parseNote(fullPath, currentFolder, false));
        }
      }
    };

    scanDir(GLOBAL_NOTES_DIR, 'Geral');

    // 3. Compute Backlinks
    for (const note of notes) {
      for (const other of notes) {
        if (other.id !== note.id) {
          const linksToNote = other.links.some(
            l => l.toLowerCase() === note.title.toLowerCase() || l.toLowerCase() === note.id.toLowerCase()
          );
          if (linksToNote) {
            note.backlinks.push(other.title);
          }
        }
      }
    }

    // Only create starter note on very first initialization of the vault
    const initFlagPath = path.join(GLOBAL_NOTES_DIR, '.initialized');
    if (!fs.existsSync(initFlagPath) && notes.length === 0) {
      fs.writeFileSync(initFlagPath, 'true', 'utf-8');
      this.saveNote({
        title: 'Bem-vindo ao FrankMD Notes',
        folder: 'Início',
        subject: 'Início',
        content: `# Bem-vindo ao FrankMD Notes

Sistema de anotações seguras baseado no conceito **FrankMD** e no grafo de conhecimento do Obsidian.

## 🛡️ Pastas e Organização
- Arquivos organizados em pastas no seu cofre Obsidian.
- Conexões com wikilinks: use \`[[Nome da Nota]]\` para criar ligações automáticas.
- Use tags como #arquitetura, #estudos, #ideias.
`,
        isProjectSpecific: false
      });
      return this.listNotes(projectPath);
    } else if (!fs.existsSync(initFlagPath)) {
      fs.writeFileSync(initFlagPath, 'true', 'utf-8');
    }

    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // List all folders in vault
  public static listFolders(): string[] {
    this.ensureDirs();
    const folders: string[] = ['Geral'];

    if (fs.existsSync(GLOBAL_NOTES_DIR)) {
      const entries = fs.readdirSync(GLOBAL_NOTES_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          folders.push(entry.name);
        }
      }
    }
    return Array.from(new Set(folders));
  }

  // Create new folder
  public static createFolder(folderName: string): boolean {
    this.ensureDirs();
    const cleanName = this.sanitizeName(folderName);
    if (!cleanName) return false;

    const folderPath = path.join(GLOBAL_NOTES_DIR, cleanName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      return true;
    }
    return true;
  }

  public static saveNote(data: {
    id?: string;
    title: string;
    folder?: string;
    subject?: string;
    content: string;
    isProjectSpecific?: boolean;
  }, projectPath?: string): FrankNote {
    this.ensureDirs(projectPath);

    const safeTitle = data.title.trim() || 'Sem Título';
    const id = data.id || safeTitle.toLowerCase().replace(/[^a-z0-9\u00C0-\u00FF]/gi, '-').replace(/-+/g, '-').slice(0, 50);
    const filename = `${id}.md`;
    const folder = data.folder ? this.sanitizeName(data.folder) : (data.subject ? this.sanitizeName(data.subject) : 'Geral');

    let targetDir = GLOBAL_NOTES_DIR;
    if (folder && folder !== 'Geral') {
      targetDir = path.join(GLOBAL_NOTES_DIR, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    const filePath = path.join(targetDir, filename);

    // Data Safety: Backup before overwriting existing file
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf-8');
      const backupFilename = `${id}_backup_${Date.now()}.md`;
      fs.writeFileSync(path.join(BACKUPS_DIR, backupFilename), existingContent, 'utf-8');
    }

    let finalContent = data.content;
    const subject = data.subject || folder;
    if (!finalContent.includes('<!-- subject:')) {
      finalContent = `<!-- subject: ${subject} -->\n${finalContent}`;
    }

    fs.writeFileSync(filePath, finalContent, 'utf-8');
    return this.parseNote(filePath, folder, data.isProjectSpecific);
  }

  public static deleteNote(id: string, isProjectSpecific?: boolean, projectPath?: string): boolean {
    const notes = this.listNotes(projectPath);
    const note = notes.find(n => n.id === id || n.filename === `${id}.md`);
    if (!note) return false;

    const filePath = path.join(GLOBAL_NOTES_DIR, note.relativePath);
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf-8');
      const backupFilename = `${id}_deleted_${Date.now()}.md`;
      fs.writeFileSync(path.join(BACKUPS_DIR, backupFilename), existingContent, 'utf-8');
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // Import notes from Notion
  public static importNotionNotes(items: Array<{ filename: string; content: string; folder?: string }>): { importedCount: number } {
    this.ensureDirs();
    let count = 0;

    for (const item of items) {
      if (!item.content) continue;

      // Clean Notion's exported 32-character hash from filename (e.g., "My Page 88fa3910c2ef.md" -> "My Page.md")
      let cleanName = item.filename.replace(/\s+[a-f0-9]{32}\.md$/i, '.md').replace(/\.md$/i, '');
      const folder = item.folder ? this.sanitizeName(item.folder) : 'Notion Import';

      this.saveNote({
        title: cleanName,
        folder,
        subject: folder,
        content: item.content
      });
      count++;
    }

    return { importedCount: count };
  }

  // Generate Obsidian-style Interactive Graph
  public static getGraphData(projectPath?: string): GraphData {
    const notes = this.listNotes(projectPath);
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const subjects = new Set<string>();
    const tags = new Set<string>();

    for (const note of notes) {
      nodes.push({
        id: `note_${note.id}`,
        label: note.title,
        type: 'note',
        val: 10 + (note.backlinks.length * 4) + (note.links.length * 2),
        color: note.isProjectSpecific ? '#38bdf8' : '#818cf8'
      });

      if (note.folder || note.subject) {
        const sub = note.folder || note.subject;
        subjects.add(sub);
        links.push({
          source: `note_${note.id}`,
          target: `sub_${sub}`,
          type: 'subject'
        });
      }

      for (const t of note.tags) {
        tags.add(t);
        links.push({
          source: `note_${note.id}`,
          target: `tag_${t}`,
          type: 'tag'
        });
      }

      // Wikilinks
      for (const linkTitle of note.links) {
        const targetNote = notes.find(
          n => n.title.toLowerCase() === linkTitle.toLowerCase() || n.id.toLowerCase() === linkTitle.toLowerCase()
        );
        if (targetNote) {
          links.push({
            source: `note_${note.id}`,
            target: `note_${targetNote.id}`,
            type: 'wikilink'
          });
        }
      }
    }

    // Add Subject/Folder Nodes
    for (const sub of Array.from(subjects)) {
      nodes.push({
        id: `sub_${sub}`,
        label: `📂 ${sub}`,
        type: 'subject',
        val: 14,
        color: '#f59e0b'
      });
    }

    // Add Tag Nodes
    for (const t of Array.from(tags)) {
      nodes.push({
        id: `tag_${t}`,
        label: t,
        type: 'tag',
        val: 8,
        color: '#34d399'
      });
    }

    return { nodes, links };
  }
}
