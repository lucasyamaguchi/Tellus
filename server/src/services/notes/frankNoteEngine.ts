import fs from 'fs';
import path from 'path';
import { PrivacySanitizer } from '../security/privacySanitizer.js';

// Diretório fixo do cofre Obsidian usado pelo FrankMD.
// No Windows, este caminho representa o volume E: e não depende do diretório
// de execução do servidor.
const OBSIDIAN_VAULT_DIR = 'E:\\Die-Sonne\\Vault';

export interface NoteSearchResult {
  note: FrankNote;
  score: number;
  matchedSnippets: string[];
}

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

export interface DeletedNoteItem {
  id: string;
  title: string;
  backupFilename: string;
  originalFolder: string;
  deletedAt: number;
  size: number;
  content: string;
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

  // Sanitize name for individual file
  public static sanitizeName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  // Sanitize path for hierarchical subfolders (e.g. "Carreira/Vaga Data Engineer")
  public static sanitizePath(folderPath: string): string {
    if (!folderPath) return 'Geral';
    return folderPath
      .replace(/\\/g, '/')
      .split('/')
      .map(part => part.replace(/[<>:"|?*]/g, '_').trim())
      .filter(part => part && part !== '.' && part !== '..')
      .join('/') || 'Geral';
  }

  // Extract subject / category from frontmatter or default to "Geral"
  private static parseNote(filePath: string, folderName: string = 'Geral', isProjectSpecific: boolean = false): FrankNote {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const id = filename.replace(/\.md$/i, '');
    const relativePath = path.relative(GLOBAL_NOTES_DIR, filePath).replace(/\\/g, '/');

    // Extract title from first Markdown heading, or fallback to filename
    const lines = content.split('\n');
    let title = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('<!--')) continue;
      const headingMatch = trimmed.match(/^#+\s*(.*)/);
      if (headingMatch) {
        title = headingMatch[1].trim();
        break;
      }
    }
    if (!title) {
      title = id.replace(/[-_]/g, ' ');
    }

    // Extract folder from physical directory or comment
    const dirRelative = path.relative(GLOBAL_NOTES_DIR, path.dirname(filePath)).replace(/\\/g, '/');
    const physicalFolder = dirRelative && dirRelative !== '.' ? dirRelative : 'Geral';

    const subjectMatch = content.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : physicalFolder;
    const folder = physicalFolder !== 'Geral' ? physicalFolder : (folderName !== 'Geral' ? folderName : (subject !== 'Geral' ? subject : 'Geral'));

    const tags = this.extractTags(content);
    const links = this.extractWikilinks(content);

    return {
      id,
      title,
      filename,
      folder: this.sanitizePath(folder),
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

    const scanDir = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // skip hidden dirs/files like .backups, .obsidian

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const relativeDir = path.relative(GLOBAL_NOTES_DIR, currentDir).replace(/\\/g, '/');
          const folderName = relativeDir && relativeDir !== '.' ? relativeDir : 'Geral';
          notes.push(this.parseNote(fullPath, folderName, false));
        }
      }
    };

    scanDir(GLOBAL_NOTES_DIR);

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
        content: `# Bem-vindo ao FrankMD Notes\n\nSistema de anotações seguras baseado no conceito **FrankMD** e no grafo de conhecimento do Obsidian.\n\n## 🛡️ Pastas e Organização\n- Arquivos organizados em pastas e subpastas no seu cofre Obsidian.\n- Conexões com wikilinks: use \`[[Nome da Nota]]\` para criar ligações automáticas.\n- Use tags como #arquitetura, #estudos, #ideias.\n`,
        isProjectSpecific: false
      });
      return this.listNotes(projectPath);
    } else if (!fs.existsSync(initFlagPath)) {
      fs.writeFileSync(initFlagPath, 'true', 'utf-8');
    }

    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // List all folders in vault (including nested subfolders)
  public static listFolders(projectPath?: string): string[] {
    this.ensureDirs(projectPath);
    const folders = new Set<string>(['Geral']);

    const scanFolders = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const fullPath = path.join(currentDir, entry.name);
          const relative = path.relative(GLOBAL_NOTES_DIR, fullPath).replace(/\\/g, '/');
          if (relative) folders.add(relative);
          scanFolders(fullPath);
        }
      }
    };

    scanFolders(GLOBAL_NOTES_DIR);

    // Also include folders and subjects from all existing notes
    const notes = this.listNotes(projectPath);
    for (const note of notes) {
      if (note.folder && !note.folder.startsWith('.')) folders.add(this.sanitizePath(note.folder));
      if (note.subject && !note.subject.startsWith('.')) folders.add(this.sanitizePath(note.subject));
    }

    return Array.from(folders).filter(f => f && !f.startsWith('.')).sort();
  }

  // Create new folder or subfolder (e.g. "Carreira/Vaga Data Engineer")
  public static createFolder(folderName: string): boolean {
    this.ensureDirs();
    const cleanPath = this.sanitizePath(folderName);
    if (!cleanPath || cleanPath === 'Geral') return false;

    const folderPath = path.join(GLOBAL_NOTES_DIR, cleanPath);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      return true;
    }
    return true;
  }

  // Move an entire folder into another parent folder
  public static moveFolder(sourceFolder: string, targetParentFolder: string): boolean {
    this.ensureDirs();
    const cleanSource = this.sanitizePath(sourceFolder);
    const cleanTargetParent = this.sanitizePath(targetParentFolder);
    if (!cleanSource || cleanSource === cleanTargetParent) return false;

    const sourcePath = path.join(GLOBAL_NOTES_DIR, cleanSource);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) return false;

    const folderBaseName = path.basename(sourcePath);
    const targetDir = (cleanTargetParent === 'Geral' || !cleanTargetParent)
      ? path.join(GLOBAL_NOTES_DIR, folderBaseName)
      : path.join(GLOBAL_NOTES_DIR, cleanTargetParent, folderBaseName);

    if (path.resolve(sourcePath) === path.resolve(targetDir)) return true;

    // Prevent moving a folder into its own subfolder
    if (path.resolve(targetDir).startsWith(path.resolve(sourcePath))) return false;

    const targetParentDir = path.dirname(targetDir);
    if (!fs.existsSync(targetParentDir)) {
      fs.mkdirSync(targetParentDir, { recursive: true });
    }

    fs.renameSync(sourcePath, targetDir);
    return true;
  }

  // Delete an entire folder and all its notes (with safety backups)
  public static deleteFolder(folderName: string, projectPath?: string): { success: boolean; deletedNotesCount: number } {
    this.ensureDirs(projectPath);
    const cleanPath = this.sanitizePath(folderName).normalize('NFC');
    if (!cleanPath || cleanPath === 'Geral') {
      return { success: false, deletedNotesCount: 0 };
    }

    const folderPath = path.join(GLOBAL_NOTES_DIR, cleanPath);
    let count = 0;

    // 1. Find and backup all notes within this folder and its subfolders
    const notes = this.listNotes(projectPath);
    const notesToDelete = notes.filter(n => {
      const f = (n.folder || n.subject || 'Geral').normalize('NFC');
      return f === cleanPath || f.startsWith(`${cleanPath}/`);
    });

    for (const note of notesToDelete) {
      const filePath = path.join(GLOBAL_NOTES_DIR, note.relativePath);
      if (fs.existsSync(filePath)) {
        try {
          const existingContent = fs.readFileSync(filePath, 'utf-8');
          const backupFilename = `${note.id}_deleted_folder_${Date.now()}.md`;
          fs.writeFileSync(path.join(BACKUPS_DIR, backupFilename), existingContent, 'utf-8');
          fs.unlinkSync(filePath);
          count++;
        } catch (e) {
          console.error(`Error deleting note file ${filePath}:`, e);
        }
      }
    }

    // 2. Also scan physical folder directly for any leftover .md files to backup before folder deletion
    if (fs.existsSync(folderPath)) {
      const backupRemainingFiles = (dir: string) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              backupRemainingFiles(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
              const existingContent = fs.readFileSync(fullPath, 'utf-8');
              const fileId = entry.name.replace(/\.md$/i, '');
              const backupFilename = `${fileId}_deleted_folder_${Date.now()}.md`;
              fs.writeFileSync(path.join(BACKUPS_DIR, backupFilename), existingContent, 'utf-8');
              count++;
            }
          }
        } catch {
          // ignore
        }
      };

      try {
        backupRemainingFiles(folderPath);
        fs.rmSync(folderPath, { recursive: true, force: true });
      } catch (e) {
        console.error(`Error removing folder directory ${folderPath}:`, e);
      }
    }

    return { success: true, deletedNotesCount: count };
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
    const folder = data.folder ? this.sanitizePath(data.folder) : (data.subject ? this.sanitizePath(data.subject) : 'Geral');

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

    // GitSafe Sanitization: Never write raw API keys or credentials to disk
    const sanitizeResult = PrivacySanitizer.sanitizeText(data.content);
    let finalContent = sanitizeResult.sanitized;
    if (sanitizeResult.redactedCount > 0) {
      console.warn(`[GitSafe Core] Redacted ${sanitizeResult.redactedCount} secret(s) (${sanitizeResult.detectedTypes.join(', ')}) in note: "${safeTitle}"`);
    }

    const subject = data.subject || folder;
    if (!finalContent.includes('<!-- subject:')) {
      finalContent = `<!-- subject: ${subject} -->\n${finalContent}`;
    }

    fs.writeFileSync(filePath, finalContent, 'utf-8');
    return this.parseNote(filePath, folder, data.isProjectSpecific);
  }

  // Zero-LLM BM25-Lite Weighted Fast Search over Notes
  public static searchNotes(
    query: string,
    options?: { folder?: string; limit?: number },
    projectPath?: string
  ): NoteSearchResult[] {
    const allNotes = this.listNotes(projectPath);
    let targetNotes = allNotes;

    if (options?.folder && options.folder !== 'Geral' && options.folder !== 'Todas') {
      const normalizedFolder = this.sanitizePath(options.folder).toLowerCase();
      targetNotes = allNotes.filter(n => {
        const f = (n.folder || n.subject || '').toLowerCase();
        return f === normalizedFolder || f.startsWith(`${normalizedFolder}/`);
      });
    }

    if (!query || !query.trim()) {
      return targetNotes.map(n => ({
        note: n,
        score: 1,
        matchedSnippets: []
      }));
    }

    const cleanQuery = query.toLowerCase().trim();
    // Stopwords in Portuguese and English
    const stopwords = new Set([
      'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
      'por', 'para', 'com', 'sem', 'como', 'um', 'uma', 'uns', 'umas', 'que', 'se', 'e',
      'the', 'and', 'for', 'with', 'to', 'of', 'in', 'on', 'at', 'by', 'an', 'is', 'it'
    ]);

    const rawTokens = cleanQuery.split(/[\s,;:.?!+*#_()\[\]{}"'\\/]+/).filter(t => t.length >= 2);
    const tokens = rawTokens.filter(t => !stopwords.has(t));
    const effectiveTokens = tokens.length > 0 ? tokens : rawTokens;

    const results: NoteSearchResult[] = [];

    for (const note of targetNotes) {
      const titleLower = note.title.toLowerCase();
      const tagsLower = note.tags.map(t => t.toLowerCase());
      const linksLower = note.links.map(l => l.toLowerCase());
      const lines = note.content.split('\n');

      let score = 0;
      const matchedSnippets: string[] = [];

      // 1. Exact query match in title
      if (titleLower === cleanQuery) {
        score += 35;
      } else if (titleLower.includes(cleanQuery)) {
        score += 20;
      }

      // 2. Token matches in title
      for (const tok of effectiveTokens) {
        if (titleLower.includes(tok)) {
          score += 8;
        }
      }

      // 3. Match in tags
      for (const tok of effectiveTokens) {
        for (const tag of tagsLower) {
          if (tag.includes(tok)) {
            score += 7;
          }
        }
      }

      // 4. Match in wikilinks
      for (const tok of effectiveTokens) {
        for (const link of linksLower) {
          if (link.includes(tok)) {
            score += 5;
          }
        }
      }

      // 5. Match in headings and body content
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const lineLower = trimmed.toLowerCase();
        let lineMatched = false;

        if (trimmed.startsWith('#')) {
          // Markdown heading
          for (const tok of effectiveTokens) {
            if (lineLower.includes(tok)) {
              score += 6;
              lineMatched = true;
            }
          }
        } else {
          // Body line
          for (const tok of effectiveTokens) {
            if (lineLower.includes(tok)) {
              score += 2;
              lineMatched = true;
            }
          }
        }

        if (lineMatched && matchedSnippets.length < 3) {
          const snippet = trimmed.length > 140 ? trimmed.substring(0, 137) + '...' : trimmed;
          if (!matchedSnippets.includes(snippet)) {
            matchedSnippets.push(snippet);
          }
        }
      }

      // Frequency saturation cap to avoid giant files dominating unfairly
      if (score > 120) score = 120 + Math.log(score - 119) * 10;

      if (score > 0) {
        results.push({
          note,
          score: Math.round(score),
          matchedSnippets
        });
      }
    }

    results.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt);
    const limit = options?.limit || 50;
    return results.slice(0, limit);
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

  // Move note to a different folder / subfolder
  public static moveNote(id: string, targetFolder: string, projectPath?: string): FrankNote | null {
    this.ensureDirs(projectPath);
    const notes = this.listNotes(projectPath);
    const note = notes.find(n => n.id === id || n.filename === `${id}.md`);
    if (!note) return null;

    const currentFilePath = path.join(GLOBAL_NOTES_DIR, note.relativePath);
    if (!fs.existsSync(currentFilePath)) return null;

    const cleanTargetFolder = this.sanitizePath(targetFolder) || 'Geral';
    let targetDir = GLOBAL_NOTES_DIR;
    if (cleanTargetFolder !== 'Geral') {
      targetDir = path.join(GLOBAL_NOTES_DIR, cleanTargetFolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    const newFilePath = path.join(targetDir, note.filename);

    let content = fs.readFileSync(currentFilePath, 'utf-8');
    // Update or insert <!-- subject: xyz -->
    if (content.match(/<!--\s*subject:\s*(.*?)\s*-->/i)) {
      content = content.replace(/<!--\s*subject:\s*(.*?)\s*-->/i, `<!-- subject: ${cleanTargetFolder} -->`);
    } else {
      content = `<!-- subject: ${cleanTargetFolder} -->\n${content}`;
    }

    // If source and target paths are different, move the file
    if (path.resolve(currentFilePath) !== path.resolve(newFilePath)) {
      fs.writeFileSync(newFilePath, content, 'utf-8');
      try {
        fs.unlinkSync(currentFilePath);
      } catch {
        // ignore if same file
      }
    } else {
      fs.writeFileSync(newFilePath, content, 'utf-8');
    }

    return this.parseNote(newFilePath, cleanTargetFolder, note.isProjectSpecific);
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

  // List deleted / backup notes (Trash Bin)
  public static listDeletedNotes(projectPath?: string): DeletedNoteItem[] {
    this.ensureDirs(projectPath);
    if (!fs.existsSync(BACKUPS_DIR)) return [];

    const items: DeletedNoteItem[] = [];
    const files = fs.readdirSync(BACKUPS_DIR);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const fullPath = path.join(BACKUPS_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Extract timestamp from filename like: note-id_deleted_1787616941222.md or note-id_deleted_folder_1787616941222.md or note-id_backup_1788264300284.md
        const tsMatch = file.match(/_(\d+)\.md$/i);
        const deletedAt = tsMatch ? parseInt(tsMatch[1], 10) : stat.mtimeMs;

        const baseId = file
          .replace(/_(deleted_folder|deleted|backup)_\d+\.md$/i, '')
          .replace(/\.md$/i, '');

        const firstLine = content.split('\n')[0] || '';
        const titleMatch = firstLine.match(/^#+\s*(.*)/);
        const title = titleMatch ? titleMatch[1].trim() : baseId.replace(/[-_]/g, ' ');

        const subjectMatch = content.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
        const originalFolder = subjectMatch ? subjectMatch[1].trim() : 'Geral';

        items.push({
          id: baseId,
          title,
          backupFilename: file,
          originalFolder,
          deletedAt,
          size: stat.size,
          content
        });
      } catch {
        // ignore unreadable file
      }
    }

    return items.sort((a, b) => b.deletedAt - a.deletedAt);
  }

  // Restore a deleted note back to the active vault
  public static restoreDeletedNote(backupFilename: string, projectPath?: string): FrankNote | null {
    this.ensureDirs(projectPath);
    const backupPath = path.join(BACKUPS_DIR, backupFilename);
    if (!fs.existsSync(backupPath)) return null;

    const content = fs.readFileSync(backupPath, 'utf-8');
    const firstLine = content.split('\n')[0] || '';
    const titleMatch = firstLine.match(/^#+\s*(.*)/);
    const id = backupFilename.replace(/_(deleted_folder|deleted|backup)_\d+\.md$/i, '');
    const title = titleMatch ? titleMatch[1].trim() : id.replace(/[-_]/g, ' ');

    const subjectMatch = content.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
    const folder = subjectMatch ? subjectMatch[1].trim() : 'Geral';

    const restoredNote = this.saveNote({
      id,
      title,
      folder,
      subject: folder,
      content,
      isProjectSpecific: false
    }, projectPath);

    // Remove from backups once restored
    try {
      fs.unlinkSync(backupPath);
    } catch {
      // ignore
    }

    return restoredNote;
  }

  // Permanently delete a single note backup from disk
  public static permanentlyDeleteNote(backupFilename: string): boolean {
    const backupPath = path.join(BACKUPS_DIR, backupFilename);
    if (fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
        return true;
      } catch (e) {
        console.error('Error permanently deleting backup:', e);
        return false;
      }
    }
    return false;
  }

  // Permanently empty all deleted notes in trash
  public static emptyTrash(): { success: boolean; count: number } {
    if (!fs.existsSync(BACKUPS_DIR)) return { success: true, count: 0 };
    const files = fs.readdirSync(BACKUPS_DIR);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          fs.unlinkSync(path.join(BACKUPS_DIR, file));
          count++;
        } catch {
          // ignore
        }
      }
    }
    return { success: true, count };
  }

  // Automatic retention cleanup: cleans notes older than specified retention (30d, 90d, 120d, 1y)
  public static cleanupExpiredBackups(retention: string = '90_days'): number {
    if (!retention || retention === 'never') return 0;
    if (!fs.existsSync(BACKUPS_DIR)) return 0;

    let maxAgeMs = 90 * 24 * 60 * 60 * 1000; // default 90 days
    if (retention === '30_days') {
      maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    } else if (retention === '90_days') {
      maxAgeMs = 90 * 24 * 60 * 60 * 1000;
    } else if (retention === '120_days') {
      maxAgeMs = 120 * 24 * 60 * 60 * 1000;
    } else if (retention === '1_year') {
      maxAgeMs = 365 * 24 * 60 * 60 * 1000;
    }

    const now = Date.now();
    const files = fs.readdirSync(BACKUPS_DIR);
    let cleanedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const fullPath = path.join(BACKUPS_DIR, file);
      try {
        const tsMatch = file.match(/_(\d+)\.md$/i);
        const timestamp = tsMatch ? parseInt(tsMatch[1], 10) : fs.statSync(fullPath).mtimeMs;
        if (now - timestamp > maxAgeMs) {
          fs.unlinkSync(fullPath);
          cleanedCount++;
        }
      } catch {
        // ignore
      }
    }

    return cleanedCount;
  }
}
