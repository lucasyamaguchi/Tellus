import fs from 'fs';
import path from 'path';
import os from 'os';
import { PrivacySanitizer } from '../security/privacySanitizer.js';
import { ConfigManager } from '../configManager.js';
import { SecurityShield } from '../sync/securityShield.js';
import { getDefaultVaultDir } from '../../utils/appPaths.js';

// Diretório padrão do cofre Obsidian usado pelo TellusMD.
// Caso não exista na máquina atual (ex: outro notebook), utiliza Documents/Tellus Vault ou o caminho escolhido nas Configurações.
const OBSIDIAN_VAULT_DIR = path.join(os.homedir(), 'Documents', 'Tellus Vault');

export interface InkPoint {
  x: number;
  y: number;
  pressure?: number;
  t?: number;
}

export interface InkStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'marker' | 'line' | 'arrow' | 'rect';
  color: string;
  width: number;
  opacity: number;
  layer?: 'overlay' | 'canvas';
  points: InkPoint[];
  createdAt: number;
}

export interface NoteInkData {
  noteId: string;
  version: number;
  updatedAt: number;
  backgroundPattern: 'none' | 'ruled' | 'dots' | 'grid' | 'lines' | 'blank';
  overlayMode?: 'hybrid' | 'canvas_only';
  canvasHeight: number;
  strokes: InkStroke[];
  overlayStrokes?: InkStroke[];
  canvasStrokes?: InkStroke[];
  svgPreview?: string;
}

export interface NoteSearchResult {
  note: TellusNote;
  score: number;
  matchedSnippets: string[];
}

export interface TellusNote {
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
  hasInk?: boolean;
  inkStrokeCount?: number;
  ownerAccountHash?: string | null;
  isAccountProtected?: boolean;
  isInternal?: boolean;
}

export type TelluNote = TellusNote;
export type TellusMDNote = TellusNote;
export type FrankNote = TellusNote;

export interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'subject' | 'tag' | 'macro_category' | 'keyword' | string;
  val: number; // size/weight
  color?: string;
  details?: string;
  level?: 1 | 2 | 3 | 4;
  hotness?: number;
  macroCategory?: string;
  linkedNoteIds?: string[];
  parentId?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'wikilink' | 'tag' | 'subject' | 'macro_subject' | 'keyword' | string;
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

function getGlobalNotesDir(): string {
  if (process.env.TELLUS_VAULT_DIR || process.env.OBSIDIAN_VAULT_DIR) {
    return (process.env.TELLUS_VAULT_DIR || process.env.OBSIDIAN_VAULT_DIR)!;
  }
  try {
    const config = ConfigManager.getConfig();
    if (config.vaultPath && config.vaultPath.trim() && fs.existsSync(config.vaultPath.trim())) {
      return config.vaultPath.trim();
    }
  } catch {}
  if (fs.existsSync(getDefaultVaultDir())) {
    return getDefaultVaultDir();
  }
  if (fs.existsSync(OBSIDIAN_VAULT_DIR)) {
    return OBSIDIAN_VAULT_DIR;
  }
  return getDefaultVaultDir();
}

function getBackupsDir(): string {
  return path.join(getGlobalNotesDir(), '.backups');
}

function getInkDir(): string {
  return path.join(getGlobalNotesDir(), '.ink');
}

export class TellusNoteEngine {
  public static get VAULT_DIR(): string {
    return getGlobalNotesDir();
  }
  public static get BACKUPS_DIR(): string {
    return getBackupsDir();
  }
  public static get ATTACHMENTS_DIR(): string {
    return path.join(getGlobalNotesDir(), '_attachments');
  }
  public static get INK_DIR(): string {
    return getInkDir();
  }

  private static deletionHooks: Array<(relativePath: string, isFolder: boolean) => void> = [];
  private static saveHooks: Array<(relativePath: string) => void> = [];

  public static registerDeletionHook(hook: (relativePath: string, isFolder: boolean) => void): void {
    this.deletionHooks.push(hook);
  }

  public static registerSaveHook(hook: (relativePath: string) => void): void {
    this.saveHooks.push(hook);
  }

  private static ensureDirs(projectPath?: string) {
    const vaultDir = getGlobalNotesDir();
    const backupsDir = getBackupsDir();
    const inkDir = getInkDir();
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true });
    }
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    if (!fs.existsSync(inkDir)) {
      fs.mkdirSync(inkDir, { recursive: true });
    }
    if (!fs.existsSync(this.ATTACHMENTS_DIR)) {
      fs.mkdirSync(this.ATTACHMENTS_DIR, { recursive: true });
    }
  }

  // Save an image/file attachment into Vault _attachments folder
  public static saveAttachment(originalName: string, buffer: Buffer): { filename: string; relativePath: string; urlPath: string; wikilink: string } {
    this.ensureDirs();
    const ext = path.extname(originalName) || '.png';
    const baseName = this.sanitizeName(path.basename(originalName, ext)) || 'imagem';
    const timestamp = Date.now();
    const safeFilename = `${baseName}_${timestamp}${ext}`;
    const targetPath = path.join(this.ATTACHMENTS_DIR, safeFilename);
    fs.writeFileSync(targetPath, buffer);
    return {
      filename: safeFilename,
      relativePath: `_attachments/${safeFilename}`,
      urlPath: `/api/notes/attachments/${encodeURIComponent(safeFilename)}`,
      wikilink: `![[${safeFilename}]]`
    };
  }

  // Extract [[Wikilinks]] from markdown content (supporting aliases [[Target|Alias]])
  private static extractWikilinks(content: string): string[] {
    const matches = content.match(/\[\[(.*?)\]\]/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/\[\[|\]\]/g, '').split('|')[0].trim())));
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
    // Normaliza qualquer notação plana com hífen "Caderno - Subpasta" -> "Caderno/Subpasta"
    let normalized = folderPath.replace(/\\/g, '/').trim();
    normalized = normalized.replace(/\s+-\s+/g, '/');
    return normalized
      .split('/')
      .map(part => part.replace(/[<>:"|?*]/g, '_').trim())
      .filter(part => part && part !== '.' && part !== '..')
      .join('/') || 'Geral';
  }

  // Helper para normalização preventiva de termos em espanhol/portunhol em títulos e pastas
  public static normalizePortuguese(text: string): string {
    if (!text) return text;
    let normalized = text;
    const replacements: [RegExp, string][] = [
      [/\bArquitectura\b/gi, 'Arquitetura'],
      [/\bIntroducción\b/gi, 'Introdução'],
      [/\bConceptos\b/gi, 'Conceitos'],
      [/\bFundamentos y\b/gi, 'Fundamentos e'],
      [/\bEjercicios\b/gi, 'Exercícios'],
      [/\bProgramación\b/gi, 'Programação'],
      [/\bConfiguración\b/gi, 'Configuração'],
      [/\bQué es la\b/gi, 'O que é a'],
      [/\bQué es el\b/gi, 'O que é o'],
      [/\bQué son los\b/gi, 'O que são os'],
      [/\bQué son las\b/gi, 'O que são as'],
      [/\bPatrones de Diseño\b/gi, 'Padrões de Projeto'],
      [/\bMicroservicios\b/gi, 'Microsserviços'],
      [/\bInformación\b/gi, 'Informação'],
      [/\bComentarios\b/gi, 'Comentários'],
      [/\bDescripción\b/gi, 'Descrição'],
      [/\bIntegración\b/gi, 'Integração'],
      [/\bDocumentación\b/gi, 'Documentação'],
      [/\bSeguridad\b/gi, 'Segurança'],
      [/\bGestión\b/gi, 'Gestão'],
      [/\bAutenticación\b/gi, 'Autenticação'],
      [/\bAutorización\b/gi, 'Autorização']
    ];

    for (const [pattern, target] of replacements) {
      normalized = normalized.replace(pattern, target);
    }
    return normalized;
  }

  // Extract subject / category from frontmatter or default to "Geral"
  private static parseNote(
    filePath: string, 
    folderName: string = 'Geral', 
    isProjectSpecific: boolean = false, 
    preloadedCfg?: any,
    customRelativePath?: string
  ): TelluNote | null {
    const rawFileContent = fs.readFileSync(filePath, 'utf-8');
    // Ensure config is loaded so active session vault key is restored if present
    const cfg = preloadedCfg || ConfigManager.getConfig();
    const viewScope = cfg.syncConfig?.vaultViewScope || 'all_accessible';
    const securityCheck = SecurityShield.inspectAndUnwrapNote(rawFileContent);
    if (!securityCheck.canAccess) {
      // Strictly isolate notes linked to another or unauthenticated Google Account
      return null;
    }
    // Filter by active view scope (Local Only vs Active Account Only vs All Accessible)
    if (viewScope === 'local_only' && securityCheck.ownerAccountHash) {
      return null;
    }
    if (viewScope === 'account_only' && SecurityShield.getActiveAccountHash()) {
      if (securityCheck.ownerAccountHash !== SecurityShield.getActiveAccountHash()) {
        return null;
      }
    }
    const content = securityCheck.content;
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const id = filename.replace(/\.md$/i, '');
    const relativePath = customRelativePath 
      ? customRelativePath 
      : path.relative(getGlobalNotesDir(), filePath).replace(/\\/g, '/');

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
    const dirRelative = customRelativePath
      ? path.dirname(customRelativePath).replace(/\\/g, '/')
      : path.relative(getGlobalNotesDir(), path.dirname(filePath)).replace(/\\/g, '/');
    const physicalFolder = (folderName && folderName !== 'Geral') ? folderName : (dirRelative && dirRelative !== '.' ? dirRelative : 'Geral');

    const subjectMatch = content.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
    let rawSubject = subjectMatch ? subjectMatch[1].trim() : (physicalFolder.includes('/') ? physicalFolder.split('/').slice(1).join('/') : physicalFolder);
    if (rawSubject.includes(' - ')) {
      const parts = rawSubject.split(/\s+-\s+/);
      rawSubject = parts[parts.length - 1];
    }
    const subject = this.normalizePortuguese(rawSubject);
    const folder = this.sanitizePath(physicalFolder !== 'Geral' ? physicalFolder : (folderName !== 'Geral' ? folderName : 'Geral'));

    const sanitizedFolder = this.sanitizePath(folder);
    const topFolder = sanitizedFolder.split('/')[0].trim().toLowerCase();
    const internalFolderNames = [
      'artefatos do projeto',
      'documentação do projeto',
      'notas do projeto',
      '_attachments',
      'backend',
      'frontend',
      'criptografia',
      'engenharia',
      'infra',
      'handoffs'
    ];
    const isInternalFolder = internalFolderNames.includes(topFolder) || sanitizedFolder.toLowerCase().startsWith('_attachments');
    const internalMatch = content.match(/<!--\s*internal:\s*(true|false)\s*-->/i);
    const isExplicitlyInternal = internalMatch ? internalMatch[1].toLowerCase() === 'true' : false;
    const isInternal = Boolean(isProjectSpecific || isInternalFolder || isExplicitlyInternal);

    const tags = this.extractTags(content);
    const links = this.extractWikilinks(content);

    // Check if note has associated Ink Mode vector strokes (.ink/<id>.ink.json)
    let hasInk = false;
    let inkStrokeCount = 0;
    try {
      const inkFilePath = path.join(getInkDir(), `${this.sanitizeName(id)}.ink.json`);
      if (fs.existsSync(inkFilePath)) {
        const inkRaw = JSON.parse(fs.readFileSync(inkFilePath, 'utf-8'));
        const count =
          (Array.isArray(inkRaw.strokes) ? inkRaw.strokes.length : 0) +
          (Array.isArray(inkRaw.overlayStrokes) ? inkRaw.overlayStrokes.length : 0) +
          (Array.isArray(inkRaw.canvasStrokes) ? inkRaw.canvasStrokes.length : 0);
        if (count > 0) {
          hasInk = true;
          inkStrokeCount = count;
        }
      }
    } catch {}

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
      relativePath,
      hasInk,
      inkStrokeCount,
      ownerAccountHash: securityCheck.ownerAccountHash,
      isAccountProtected: Boolean(securityCheck.ownerAccountHash),
      isInternal
    };
  }

  public static listNotes(projectPath?: string): TelluNote[] {
    this.ensureDirs(projectPath);
    const notes: TelluNote[] = [];
    const cfg = ConfigManager.getConfig();

    const scanDir = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // skip hidden dirs/files like .backups, .obsidian

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const relativeDir = path.relative(getGlobalNotesDir(), currentDir).replace(/\\/g, '/');
          const folderName = relativeDir && relativeDir !== '.' ? relativeDir : 'Geral';
          const parsedNote = this.parseNote(fullPath, folderName, false, cfg);
          if (parsedNote) {
            notes.push(parsedNote);
          }
        }
      }
    };

    scanDir(getGlobalNotesDir());

    // 2. Scan active project directories if projectPath is provided
    if (projectPath && fs.existsSync(projectPath)) {
      const resolvedProj = path.resolve(projectPath);

      // 2a. Scan .agentic/artifacts (e.g. visao_inicial_kentron.md)
      const artifactsDir = path.join(resolvedProj, '.agentic', 'artifacts');
      if (fs.existsSync(artifactsDir)) {
        try {
          const files = fs.readdirSync(artifactsDir);
          for (const file of files) {
            if (file.endsWith('.md')) {
              const fullPath = path.join(artifactsDir, file);
              const rel = path.join('.agentic', 'artifacts', file).replace(/\\/g, '/');
              const parsed = this.parseNote(fullPath, 'Artefatos do Projeto', true, cfg, rel);
              if (parsed) {
                parsed.subject = 'Artefatos';
                notes.push(parsed);
              }
            }
          }
        } catch {}
      }

      // 2b. Scan project notes and anotacoes folders
      const projectNotesDirs = [
        path.join(resolvedProj, 'notes'),
        path.join(resolvedProj, 'anotacoes'),
        path.join(resolvedProj, '.agentic', 'notes')
      ];

      for (const pDir of projectNotesDirs) {
        if (fs.existsSync(pDir)) {
          const scanProjNotes = (curDir: string) => {
            try {
              const entries = fs.readdirSync(curDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                const full = path.join(curDir, entry.name);
                if (entry.isDirectory()) {
                  scanProjNotes(full);
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                  const relToProj = path.relative(resolvedProj, full).replace(/\\/g, '/');
                  const relDir = path.relative(pDir, curDir).replace(/\\/g, '/');
                  const folderName = relDir && relDir !== '.' ? `Notas do Projeto/${relDir}` : 'Notas do Projeto';
                  const parsed = this.parseNote(full, folderName, true, cfg, relToProj);
                  if (parsed) {
                    parsed.subject = 'Projeto';
                    notes.push(parsed);
                  }
                }
              }
            } catch {}
          };
          scanProjNotes(pDir);
        }
      }

      // 2c. Scan root documentation markdown files (e.g. README.md, ROADMAP.md, PLAN.md)
      try {
        const rootEntries = fs.readdirSync(resolvedProj, { withFileTypes: true });
        for (const entry of rootEntries) {
          if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
            const full = path.join(resolvedProj, entry.name);
            const parsed = this.parseNote(full, 'Documentação do Projeto', true, cfg, entry.name);
            if (parsed) {
              parsed.subject = 'Documentação';
              notes.push(parsed);
            }
          }
        }
      } catch {}
    }

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
    const initFlagPath = path.join(getGlobalNotesDir(), '.initialized');
    if (!fs.existsSync(initFlagPath) && notes.length === 0) {
      fs.writeFileSync(initFlagPath, 'true', 'utf-8');
      this.saveNote({
        title: 'Bem-vindo ao TellusMD Vault',
        folder: 'Início',
        subject: 'Início',
        content: `# Bem-vindo ao TellusMD Vault\n\nSistema de anotações seguras TellusMD (fundamentado no conceito **Frank MD** e na arquitetura **AI-Memory**) com suporte ao grafo de conhecimento do Obsidian.\n\n## 🛡️ Pastas e Organização\n- Arquivos organizados em pastas e subpastas no seu cofre Obsidian (\`~/Documents/Tellus Vault\`).\n- Conexões com wikilinks: use \`[[Nome da Nota]]\` para criar ligações automáticas.\n- Use tags como #arquitetura, #estudos, #ideias.\n- Seus dados permanecem 100% locais e protegidos com sanitização de segredos antes da gravação.\n`,
        isProjectSpecific: false
      });
      return this.listNotes(projectPath);
    } else if (!fs.existsSync(initFlagPath)) {
      fs.writeFileSync(initFlagPath, 'true', 'utf-8');
    }

    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Retrieve a specific note by ID, title, filename, or relative path
  public static getNote(idOrTitleOrPath: string, projectPath?: string): TelluNote | null {
    if (!idOrTitleOrPath) return null;
    const clean = idOrTitleOrPath.trim();
    const cleanLower = clean.toLowerCase();
    const cleanNoExt = clean.replace(/\.md$/i, '').toLowerCase();

    // 1. Search in all listed notes (vault + project)
    const notes = this.listNotes(projectPath);
    for (const n of notes) {
      if (
        n.id.toLowerCase() === cleanLower ||
        n.id.toLowerCase() === cleanNoExt ||
        n.title.toLowerCase() === cleanLower ||
        n.filename.toLowerCase() === cleanLower ||
        n.filename.toLowerCase() === `${cleanNoExt}.md` ||
        n.relativePath.toLowerCase() === cleanLower ||
        n.relativePath.toLowerCase().endsWith('/' + cleanLower) ||
        n.relativePath.toLowerCase().endsWith('/' + cleanNoExt + '.md')
      ) {
        return n;
      }
    }

    // 2. Direct filesystem lookup fallback
    const candidatePaths: string[] = [];
    if (projectPath) {
      candidatePaths.push(
        path.resolve(projectPath, clean),
        path.resolve(projectPath, `${cleanNoExt}.md`),
        path.resolve(projectPath, '.agentic', 'artifacts', clean),
        path.resolve(projectPath, '.agentic', 'artifacts', `${cleanNoExt}.md`),
        path.resolve(projectPath, 'notes', clean),
        path.resolve(projectPath, 'notes', `${cleanNoExt}.md`)
      );
    }
    candidatePaths.push(
      path.resolve(getGlobalNotesDir(), clean),
      path.resolve(getGlobalNotesDir(), `${cleanNoExt}.md`),
      path.resolve(clean)
    );

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile() && cand.endsWith('.md')) {
        const isProj = projectPath ? cand.toLowerCase().startsWith(path.resolve(projectPath).toLowerCase()) : false;
        const rel = isProj && projectPath 
          ? path.relative(projectPath, cand).replace(/\\/g, '/') 
          : path.relative(getGlobalNotesDir(), cand).replace(/\\/g, '/');
        const folder = isProj 
          ? (cand.includes('artifacts') ? 'Artefatos do Projeto' : 'Notas do Projeto')
          : 'Geral';
        const parsed = this.parseNote(cand, folder, isProj, undefined, rel);
        if (parsed) return parsed;
      }
    }

    return null;
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
          const relative = path.relative(getGlobalNotesDir(), fullPath).replace(/\\/g, '/');
          if (relative) folders.add(relative);
          scanFolders(fullPath);
        }
      }
    };

    scanFolders(getGlobalNotesDir());

    // Also include folders from all existing notes (do not treat subject as folder)
    const notes = this.listNotes(projectPath);
    for (const note of notes) {
      if (note.folder && !note.folder.startsWith('.')) {
        folders.add(this.sanitizePath(note.folder));
      }
    }

    return Array.from(folders).filter(f => f && !f.startsWith('.')).sort();
  }

  // Create new folder or subfolder (e.g. "Carreira/Vaga Data Engineer")
  public static createFolder(folderName: string): boolean {
    this.ensureDirs();
    const cleanPath = this.sanitizePath(folderName);
    if (!cleanPath || cleanPath === 'Geral') return false;

    const folderPath = path.join(getGlobalNotesDir(), cleanPath);
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

    const sourcePath = path.join(getGlobalNotesDir(), cleanSource);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) return false;

    const folderBaseName = path.basename(sourcePath);
    const targetDir = (cleanTargetParent === 'Geral' || !cleanTargetParent)
      ? path.join(getGlobalNotesDir(), folderBaseName)
      : path.join(getGlobalNotesDir(), cleanTargetParent, folderBaseName);

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

  public static isInternalFolder(folderName: string): boolean {
    const clean = (folderName || '').replace(/\\/g, '/').trim();
    const top = clean.split('/')[0].trim().toLowerCase();
    const internalTops = [
      'artefatos do projeto',
      'documentação do projeto',
      'notas do projeto',
      '_attachments',
      'backend',
      'frontend',
      'criptografia',
      'engenharia',
      'infra',
      'handoffs'
    ];
    return internalTops.includes(top) || clean.toLowerCase().startsWith('_attachments');
  }

  // Delete an entire folder and all its notes (with safety backups)
  public static deleteFolder(folderName: string, projectPath?: string): { success: boolean; deletedNotesCount: number; protected?: boolean } {
    this.ensureDirs(projectPath);
    const cleanPath = this.sanitizePath(folderName).normalize('NFC');
    if (!cleanPath || cleanPath === 'Geral') {
      return { success: false, deletedNotesCount: 0 };
    }

    if (this.isInternalFolder(cleanPath)) {
      return { success: false, deletedNotesCount: 0, protected: true };
    }

    const folderPath = path.join(getGlobalNotesDir(), cleanPath);
    let count = 0;

    // 1. Find and backup all notes within this folder and its subfolders
    const notes = this.listNotes(projectPath);
    const notesToDelete = notes.filter(n => {
      const f = (n.folder || n.subject || 'Geral').normalize('NFC');
      return f === cleanPath || f.startsWith(`${cleanPath}/`);
    });

    for (const note of notesToDelete) {
      let filePath = path.join(getGlobalNotesDir(), note.relativePath);
      if (!fs.existsSync(filePath) && projectPath) {
        const pPath = path.join(projectPath, note.relativePath);
        if (fs.existsSync(pPath)) {
          filePath = pPath;
        }
      }
      if (fs.existsSync(filePath)) {
        try {
          const existingContent = fs.readFileSync(filePath, 'utf-8');
          const backupFilename = `${note.id}_deleted_folder_${Date.now()}.md`;
          fs.writeFileSync(path.join(getBackupsDir(), backupFilename), existingContent, 'utf-8');
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
              fs.writeFileSync(path.join(getBackupsDir(), backupFilename), existingContent, 'utf-8');
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

    // 3. Trigger deletion hooks (Cloud Sync tombstones & remote mirror cleanup)
    for (const hook of this.deletionHooks) {
      try {
        hook(cleanPath, true);
      } catch {}
    }

    return { success: true, deletedNotesCount: count };
  }

  // Rename a notebook / folder across all notes and disk
  public static renameFolder(
    oldName: string,
    newName: string,
    projectPath?: string
  ): { success: boolean; movedNotesCount: number } {
    this.ensureDirs(projectPath);
    const cleanOld = this.sanitizePath(oldName).normalize('NFC');
    const cleanNew = this.sanitizePath(newName).normalize('NFC');

    if (!cleanOld || !cleanNew || cleanOld === cleanNew || cleanOld === 'Geral') {
      return { success: false, movedNotesCount: 0 };
    }

    const oldPath = path.join(getGlobalNotesDir(), cleanOld);
    const newPath = path.join(getGlobalNotesDir(), cleanNew);

    let movedNotesCount = 0;
    const notes = this.listNotes(projectPath);

    for (const note of notes) {
      const noteFolder = (note.folder || 'Geral').normalize('NFC');
      if (noteFolder === cleanOld || noteFolder.startsWith(`${cleanOld}/`)) {
        const subSuffix = noteFolder === cleanOld ? '' : noteFolder.slice(cleanOld.length);
        const updatedTargetFolder = `${cleanNew}${subSuffix}`;
        this.moveNote(note.id, updatedTargetFolder, projectPath);
        movedNotesCount++;
      }
    }

    if (fs.existsSync(oldPath)) {
      try {
        if (!fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
        } else {
          try { fs.rmSync(oldPath, { recursive: true, force: true }); } catch {}
        }
      } catch {}
    }

    return { success: true, movedNotesCount };
  }

  // Merge multiple notebooks/folders into a single notebook/folder (aggregates notes without merging note bodies)
  public static mergeFolders(
    sourceFolders: string[],
    targetFolder: string,
    projectPath?: string
  ): { success: boolean; movedNotesCount: number } {
    this.ensureDirs(projectPath);
    const cleanTarget = this.sanitizePath(targetFolder).normalize('NFC');
    if (!cleanTarget || !sourceFolders || sourceFolders.length === 0) {
      return { success: false, movedNotesCount: 0 };
    }

    let movedNotesCount = 0;
    const notes = this.listNotes(projectPath);

    for (const src of sourceFolders) {
      const cleanSrc = this.sanitizePath(src).normalize('NFC');
      if (!cleanSrc || cleanSrc === cleanTarget) continue;

      for (const note of notes) {
        const noteFolder = (note.folder || 'Geral').normalize('NFC');
        if (noteFolder === cleanSrc || noteFolder.startsWith(`${cleanSrc}/`)) {
          const subSuffix = noteFolder === cleanSrc ? '' : noteFolder.slice(cleanSrc.length);
          const updatedTargetFolder = `${cleanTarget}${subSuffix}`;
          const moved = this.moveNote(note.id, updatedTargetFolder, projectPath);
          if (moved) movedNotesCount++;
        }
      }

      const oldPath = path.join(getGlobalNotesDir(), cleanSrc);
      if (fs.existsSync(oldPath)) {
        try {
          fs.rmSync(oldPath, { recursive: true, force: true });
        } catch {}
      }
    }

    return { success: true, movedNotesCount };
  }

  // Bulk move notes to target folder
  public static bulkMoveNotes(
    noteIds: string[],
    targetFolder: string,
    projectPath?: string
  ): { successCount: number; updatedNotes: TelluNote[] } {
    this.ensureDirs(projectPath);
    let successCount = 0;
    const updatedNotes: TelluNote[] = [];

    for (const id of noteIds) {
      const res = this.moveNote(id, targetFolder, projectPath);
      if (res) {
        successCount++;
        updatedNotes.push(res);
      }
    }

    return { successCount, updatedNotes };
  }

  // Bulk delete notes with safe backups
  public static bulkDeleteNotes(
    noteIds: string[],
    projectPath?: string
  ): { successCount: number; failedCount: number; protectedCount: number } {
    this.ensureDirs(projectPath);
    let successCount = 0;
    let failedCount = 0;
    let protectedCount = 0;

    const allNotes = this.listNotes(projectPath);
    const notesMap = new Map(allNotes.map(n => [n.id, n]));

    for (const id of noteIds) {
      const note = notesMap.get(id);
      if (note && note.isInternal) {
        protectedCount++;
        continue; // PROTECT: never delete internal files during bulk operations!
      }
      const success = this.deleteNote(id, false, projectPath);
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return { successCount, failedCount, protectedCount };
  }

  // Merge multiple notes into a single unified note
  public static mergeNotes(
    noteIds: string[],
    options: {
      title?: string;
      targetFolder?: string;
      deleteSources?: boolean;
    } = {},
    projectPath?: string
  ): TelluNote | null {
    this.ensureDirs(projectPath);
    if (!noteIds || noteIds.length < 2) return null;

    const notes = this.listNotes(projectPath);
    const selectedNotes = noteIds
      .map(id => notes.find(n => n.id === id || n.filename === `${id}.md`))
      .filter((n): n is TelluNote => Boolean(n));

    if (selectedNotes.length < 2) return null;

    const targetTitle = (options.title && options.title.trim())
      ? options.title.trim()
      : selectedNotes.map(n => n.title).join(' & ');

    const targetFolder = (options.targetFolder && options.targetFolder.trim())
      ? options.targetFolder.trim()
      : (selectedNotes[0].folder || 'Geral');

    const allTags = new Set<string>();
    selectedNotes.forEach(n => (n.tags || []).forEach(t => allTags.add(t)));

    let mergedBody = `# ${targetTitle}\n\n`;
    mergedBody += `> ℹ️ **Nota Unificada:** Consolidação das seguintes anotações:\n`;
    for (const n of selectedNotes) {
      mergedBody += `> - [[${n.title}]]\n`;
    }
    if (allTags.size > 0) {
      mergedBody += `>\n> **Tags:** ${Array.from(allTags).join(' ')}\n`;
    }
    mergedBody += `\n---\n\n`;

    for (let i = 0; i < selectedNotes.length; i++) {
      const n = selectedNotes[i];
      mergedBody += `## [[${n.title}]]\n\n`;
      let sectionContent = n.content.trim();
      sectionContent = sectionContent.replace(/^<!--[\s\S]*?-->\r?\n?/gm, '').trim();
      const firstLine = sectionContent.split('\n')[0] || '';
      if (firstLine.replace(/^#+\s*/, '').trim().toLowerCase() === n.title.toLowerCase()) {
        sectionContent = sectionContent.slice(firstLine.length).trim();
      }
      mergedBody += sectionContent;
      if (i < selectedNotes.length - 1) {
        mergedBody += `\n\n---\n\n`;
      }
    }

    const saved = this.saveNote({
      title: targetTitle,
      folder: targetFolder,
      subject: targetFolder.includes('/') ? targetFolder.split('/')[0] : targetFolder,
      content: mergedBody,
      isProjectSpecific: selectedNotes[0].isProjectSpecific
    }, projectPath);

    if (options.deleteSources) {
      for (const n of selectedNotes) {
        if (n.id !== saved.id) {
          this.deleteNote(n.id, n.isProjectSpecific, projectPath, true);
        }
      }
    }

    return saved;
  }

  public static saveNote(data: {
    id?: string;
    title: string;
    folder?: string;
    subject?: string;
    content: string;
    isProjectSpecific?: boolean;
  }, projectPath?: string): TelluNote {
    this.ensureDirs(projectPath);

    const safeTitle = this.normalizePortuguese(data.title.trim()) || 'Sem Título';
    const id = data.id || safeTitle.toLowerCase().replace(/[^a-z0-9\u00C0-\u00FF]/gi, '-').replace(/-+/g, '-').slice(0, 50);
    const filename = `${id}.md`;
    const rawFolder = data.folder ? this.normalizePortuguese(data.folder) : (data.subject ? this.normalizePortuguese(data.subject) : 'Geral');
    const folder = this.sanitizePath(rawFolder);

    let targetDir = getGlobalNotesDir();
    if (folder && folder !== 'Geral') {
      targetDir = path.join(getGlobalNotesDir(), folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    const filePath = path.join(targetDir, filename);

    // Data Safety: Backup before overwriting existing file
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf-8');
      const backupFilename = `${id}_backup_${Date.now()}.md`;
      fs.writeFileSync(path.join(getBackupsDir(), backupFilename), existingContent, 'utf-8');
    }

    // GitSafe Sanitization: Never write raw API keys or credentials to disk
    const sanitizeResult = PrivacySanitizer.sanitizeText(data.content);
    let finalContent = sanitizeResult.sanitized;
    if (sanitizeResult.redactedCount > 0) {
      console.warn(`[GitSafe Core] Redacted ${sanitizeResult.redactedCount} secret(s) (${sanitizeResult.detectedTypes.join(', ')}) in note: "${safeTitle}"`);
    }

    let subject = data.subject || (folder.includes('/') ? folder.split('/').slice(1).join('/') : folder);
    if (subject.includes(' - ')) {
      const parts = subject.split(/\s+-\s+/);
      subject = parts[parts.length - 1];
    }
    subject = this.normalizePortuguese(subject.trim());

    const subjectToPersist = data.subject ? this.normalizePortuguese(data.subject.trim()) : folder;

    if (!finalContent.includes('<!-- subject:')) {
      finalContent = `<!-- subject: ${subjectToPersist} -->\n${finalContent}`;
    } else {
      finalContent = finalContent.replace(/<!--\s*subject:\s*(.*?)\s*-->/i, `<!-- subject: ${subjectToPersist} -->`);
    }

    // Account Ownership Tagging: if user is logged in and isolateAccountNotes is enabled,
    // stamp the note with their verified accountHash so only that Google Account can access it
    const cfg = ConfigManager.getConfig();
    const activeHash = SecurityShield.getActiveAccountHash();
    if (activeHash && cfg.syncConfig?.isolateAccountNotes !== false) {
      if (!finalContent.match(/<!--\s*tellus_owner:\s*([a-f0-9]+)\s*-->/i)) {
        finalContent = `<!-- tellus_owner: ${activeHash} -->\n${finalContent}`;
      } else {
        finalContent = finalContent.replace(/<!--\s*tellus_owner:\s*([a-f0-9]+)\s*-->/i, `<!-- tellus_owner: ${activeHash} -->`);
      }
    }

    fs.writeFileSync(filePath, finalContent, 'utf-8');

    // Trigger save hooks (Clear tombstone if note was recreated or saved)
    try {
      const rel = path.relative(getGlobalNotesDir(), filePath).replace(/\\/g, '/');
      for (const hook of TellusNoteEngine.saveHooks) {
        try { hook(rel); } catch {}
      }
    } catch {}

    const parsed = this.parseNote(filePath, folder, data.isProjectSpecific);
    if (!parsed) {
      return {
        id,
        title: safeTitle,
        filename,
        folder,
        subject,
        tags: this.extractTags(finalContent),
        content: finalContent,
        links: this.extractWikilinks(finalContent),
        backlinks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isProjectSpecific: data.isProjectSpecific,
        relativePath: path.relative(getGlobalNotesDir(), filePath).replace(/\\/g, '/')
      };
    }
    return parsed;
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

  public static deleteNote(id: string, isProjectSpecific?: boolean, projectPath?: string, forceInternal: boolean = false): boolean {
    const notes = this.listNotes(projectPath);
    const note = notes.find(n => n.id === id || n.filename === `${id}.md`);
    if (!note) return false;

    // Shield: Protect internal/system/project files from accidental deletion
    if (note.isInternal && !forceInternal) {
      return false;
    }

    let filePath = path.join(getGlobalNotesDir(), note.relativePath);
    if (!fs.existsSync(filePath) && projectPath) {
      const pPath = path.join(projectPath, note.relativePath);
      if (fs.existsSync(pPath)) {
        filePath = pPath;
      }
    }

    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf-8');
      const backupFilename = `${id}_deleted_${Date.now()}.md`;
      fs.writeFileSync(path.join(getBackupsDir(), backupFilename), existingContent, 'utf-8');
      fs.unlinkSync(filePath);

      // Trigger deletion hooks (Cloud Sync tombstones & remote mirror cleanup)
      for (const hook of TellusNoteEngine.deletionHooks) {
        try {
          hook(note.relativePath, false);
        } catch {}
      }

      return true;
    }
    return false;
  }

  // Move note to a different folder / subfolder
  public static moveNote(id: string, targetFolder: string, projectPath?: string): TelluNote | null {
    this.ensureDirs(projectPath);
    const notes = this.listNotes(projectPath);
    const note = notes.find(n => n.id === id || n.filename === `${id}.md`);
    if (!note) return null;

    let currentFilePath = path.join(getGlobalNotesDir(), note.relativePath);
    if (!fs.existsSync(currentFilePath) && projectPath) {
      const pPath = path.join(projectPath, note.relativePath);
      if (fs.existsSync(pPath)) {
        currentFilePath = pPath;
      }
    }

    if (!fs.existsSync(currentFilePath)) return null;

    const cleanTargetFolder = this.sanitizePath(targetFolder) || 'Geral';
    let targetDir = getGlobalNotesDir();
    if (cleanTargetFolder !== 'Geral') {
      targetDir = path.join(getGlobalNotesDir(), cleanTargetFolder);
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

  // Generate Obsidian-style Hierarchical & Semantic Interactive Graph (Progressive Levels & Hot Terms)
  public static getGraphData(projectPath?: string): GraphData {
    const notes = this.listNotes(projectPath);
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const STOPWORDS = new Set([
      'sobre', 'para', 'como', 'onde', 'quando', 'mais', 'menos', 'muito', 'pouco',
      'esta', 'este', 'essa', 'esse', 'isso', 'aquilo', 'projeto', 'anotação', 'anotacao',
      'nota', 'notas', 'com', 'sem', 'por', 'entre', 'cada', 'tudo', 'nada', 'qual',
      'quais', 'suas', 'seus', 'dele', 'dela', 'deles', 'delas', 'from', 'with', 'that',
      'this', 'then', 'than', 'into', 'some', 'about', 'note', 'notes'
    ]);

    // Helper to categorize notes into macro categories (Level 1)
    const getMacroCategory = (note: TellusNote): { id: string; label: string; icon: string; color: string } => {
      const folder = (note.folder || '').trim();
      const subject = (note.subject || '').trim();
      const lowerFolder = folder.toLowerCase();

      if (note.isProjectSpecific || lowerFolder.startsWith('projeto') || lowerFolder.includes('kentron') || lowerFolder.includes('csnades') || lowerFolder.includes('agenticide')) {
        return { id: 'macro_projetos', label: 'Projetos', icon: '📁', color: '#6366f1' };
      }
      if (lowerFolder.startsWith('estudo') || lowerFolder.includes('concurso') || lowerFolder.includes('modulo') || lowerFolder.includes('módulo') || subject.toLowerCase().includes('estudo')) {
        return { id: 'macro_estudos', label: 'Estudos', icon: '🎓', color: '#38bdf8' };
      }
      if (!folder || folder === 'Geral' || lowerFolder.includes('quick') || lowerFolder.includes('rapida') || lowerFolder.includes('rápida') || lowerFolder.includes('_attachments') || lowerFolder.includes('inbox')) {
        return { id: 'macro_rapidas', label: 'Anotações Rápidas', icon: '⚡', color: '#10b981' };
      }
      if (lowerFolder.includes('cripto') || lowerFolder.includes('seguranc') || lowerFolder.includes('seguranç')) {
        return { id: 'macro_seguranca', label: 'Segurança & Criptografia', icon: '🔐', color: '#f59e0b' };
      }
      if (lowerFolder.includes('backend') || lowerFolder.includes('frontend') || lowerFolder.includes('engenharia')) {
        return { id: 'macro_engenharia', label: 'Engenharia de Software', icon: '⚙️', color: '#ec4899' };
      }

      const rootName = folder.split('/')[0].split('\\')[0].trim() || 'Cadernos Gerais';
      const safeId = rootName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      return { id: `macro_${safeId}`, label: rootName, icon: '📚', color: '#a855f7' };
    };

    const macroBuckets = new Map<string, { label: string; icon: string; color: string; noteCount: number; subjects: Set<string> }>();
    const subjectBuckets = new Map<string, { label: string; macroId: string; noteCount: number; noteIds: string[] }>();
    const keywordToNotes = new Map<string, Set<string>>();
    const keywordToSubjects = new Map<string, Set<string>>();

    // 1. Process all notes, map them to Macro Categories (Level 1) & Subjects (Level 2)
    for (const note of notes) {
      const macro = getMacroCategory(note);
      if (!macroBuckets.has(macro.id)) {
        macroBuckets.set(macro.id, {
          label: macro.label,
          icon: macro.icon,
          color: macro.color,
          noteCount: 0,
          subjects: new Set()
        });
      }
      const macroData = macroBuckets.get(macro.id)!;
      macroData.noteCount++;

      // Subject determination: subfolder or specific subject
      let subName = note.folder || note.subject || 'Principal';
      if (subName.includes('/') || subName.includes('\\')) {
        const parts = subName.split(/[\/\\]/).filter(Boolean);
        subName = parts.length > 1 ? parts.slice(1).join(' / ') : parts[0];
      }
      if (!subName.trim()) subName = 'Principal';

      const subId = `sub_${macro.id}_${subName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      macroData.subjects.add(subId);

      if (!subjectBuckets.has(subId)) {
        subjectBuckets.set(subId, {
          label: subName,
          macroId: macro.id,
          noteCount: 0,
          noteIds: []
        });
      }
      const subData = subjectBuckets.get(subId)!;
      subData.noteCount++;
      subData.noteIds.push(`note_${note.id}`);

      // 2. Extract Keywords / Hot Terms (Tags, Wikilinks & Key Concepts)
      const extractedTerms: string[] = [];

      // A) Tags
      for (const t of note.tags) {
        const cleanTag = t.replace(/^#+/, '').trim().toLowerCase();
        if (cleanTag && cleanTag.length > 2) extractedTerms.push(cleanTag);
      }

      // B) Wikilinks
      for (const wl of note.links) {
        const cleanWl = wl.trim().toLowerCase();
        if (cleanWl && cleanWl.length > 2 && !STOPWORDS.has(cleanWl)) extractedTerms.push(cleanWl);
      }

      // C) Significant words from title (nouns / technical terms)
      const titleWords = note.title
        .toLowerCase()
        .replace(/[^a-z0-9áàâãéèêíïóôõöúçñ\-_ ]/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
      for (const tw of titleWords) {
        extractedTerms.push(tw);
      }

      // Record terms for this note & subject
      for (const term of extractedTerms) {
        if (!keywordToNotes.has(term)) {
          keywordToNotes.set(term, new Set());
          keywordToSubjects.set(term, new Set());
        }
        keywordToNotes.get(term)!.add(`note_${note.id}`);
        keywordToSubjects.get(term)!.add(subId);
      }

      // Note Node (Level 4)
      nodes.push({
        id: `note_${note.id}`,
        label: note.title,
        type: 'note',
        level: 4,
        val: Math.max(7, Math.min(22, 6 + (note.backlinks.length * 3) + (note.links.length * 2))),
        color: note.isProjectSpecific ? '#38bdf8' : '#818cf8',
        parentId: subId,
        macroCategory: macro.label,
        details: `Caderno: ${note.folder || 'Geral'} | Links: ${note.links.length} | Backlinks: ${note.backlinks.length}`
      });

      // Link Note -> Subject
      links.push({
        source: `note_${note.id}`,
        target: subId,
        type: 'subject'
      });

      // Wikilinks between notes
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

    // 3. Emit Macro Category Nodes (Level 1)
    for (const [macroId, macro] of macroBuckets.entries()) {
      nodes.push({
        id: macroId,
        label: `${macro.icon} ${macro.label}`,
        type: 'macro_category',
        level: 1,
        val: Math.max(26, Math.min(42, 20 + macro.noteCount * 1.5)),
        color: macro.color,
        details: `${macro.noteCount} nota(s) em ${macro.subjects.size} tema(s)`
      });
    }

    // 4. Emit Subject / Theme Nodes (Level 2) & Macro -> Subject Links
    for (const [subId, sub] of subjectBuckets.entries()) {
      nodes.push({
        id: subId,
        label: `📂 ${sub.label}`,
        type: 'subject',
        level: 2,
        val: Math.max(14, Math.min(26, 11 + sub.noteCount * 1.2)),
        color: '#f59e0b',
        parentId: sub.macroId,
        linkedNoteIds: sub.noteIds,
        details: `${sub.noteCount} nota(s) organizadas neste tema`
      });

      // Link Macro Category -> Subject
      links.push({
        source: sub.macroId,
        target: subId,
        type: 'macro_subject'
      });
    }

    // 5. Emit Significant Keywords / Hot Terms (Level 3) & Links
    // Keep terms that connect at least 2 notes or are explicit tags/links, sorted by hotness
    const hotTermEntries = Array.from(keywordToNotes.entries())
      .filter(([term, noteSet]) => {
        const isExplicitTag = notes.some(n => n.tags.some(t => t.toLowerCase().includes(term)));
        return noteSet.size >= 2 || (isExplicitTag && noteSet.size >= 1);
      })
      .sort((a, b) => b[1].size - a[1].size);

    // Limit to top 45 most relevant / hot terms to prevent overcrowding
    for (const [term, noteSet] of hotTermEntries.slice(0, 45)) {
      const hotness = noteSet.size;
      const kwId = `kw_${term.replace(/[^a-z0-9_]/g, '_')}`;
      const isVeryHot = hotness >= 3;

      nodes.push({
        id: kwId,
        label: isVeryHot ? `🔥 #${term}` : `#${term}`,
        type: 'keyword',
        level: 3,
        val: Math.max(10, Math.min(24, 9 + hotness * 2.5)),
        color: isVeryHot ? '#f43f5e' : '#ec4899', // radiant coral/rose for hot terms
        hotness,
        linkedNoteIds: Array.from(noteSet),
        details: `Termo frequente e conectado a ${hotness} nota(s)`
      });

      // Link Keyword -> connected Notes
      for (const noteNodeId of Array.from(noteSet)) {
        links.push({
          source: noteNodeId,
          target: kwId,
          type: 'keyword'
        });
      }

      // Link Keyword -> connected Subjects (for contextual clustering)
      const relSubjects = keywordToSubjects.get(term);
      if (relSubjects) {
        for (const sId of Array.from(relSubjects).slice(0, 3)) {
          links.push({
            source: sId,
            target: kwId,
            type: 'keyword'
          });
        }
      }
    }

    return { nodes, links };
  }

  // List deleted / backup notes (Trash Bin)
  public static listDeletedNotes(projectPath?: string): DeletedNoteItem[] {
    this.ensureDirs(projectPath);
    if (!fs.existsSync(getBackupsDir())) return [];

    const items: DeletedNoteItem[] = [];
    const files = fs.readdirSync(getBackupsDir());

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const fullPath = path.join(getBackupsDir(), file);
      try {
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Extract timestamp from filename like: note-id_deleted_1787616941222.md or note-id_deleted_folder_1787616941222.md or note-id_backup_1788264300284.md
        const tsMatch = file.match(/_(\d+)\.md$/i);
        const deletedAt = tsMatch ? parseInt(tsMatch[1], 10) : stat.mtimeMs;

        const baseId = file
          .replace(/_(deleted_folder|deleted|backup)_\d+\.md$/i, '')
          .replace(/\.md$/i, '');

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
          title = baseId.replace(/[-_]/g, ' ');
        }

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
  public static restoreDeletedNote(backupFilename: string, projectPath?: string): TelluNote | null {
    this.ensureDirs(projectPath);
    const backupPath = path.join(getBackupsDir(), backupFilename);
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
    const backupPath = path.join(getBackupsDir(), backupFilename);
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
    if (!fs.existsSync(getBackupsDir())) return { success: true, count: 0 };
    const files = fs.readdirSync(getBackupsDir());
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          fs.unlinkSync(path.join(getBackupsDir(), file));
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
    if (!fs.existsSync(getBackupsDir())) return 0;

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
    const files = fs.readdirSync(getBackupsDir());
    let cleanedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const fullPath = path.join(getBackupsDir(), file);
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

  // =========================================================================
  // INK MODE (DUAL-FORMAT VECTOR PEN & TOUCH ANNOTATIONS)
  // =========================================================================

  public static getInkData(noteId: string): NoteInkData {
    this.ensureDirs();
    const safeId = this.sanitizeName(noteId);
    const inkFilePath = path.join(getInkDir(), `${safeId}.ink.json`);

    const defaultData: NoteInkData = {
      noteId,
      version: 1,
      updatedAt: 0,
      backgroundPattern: 'dots',
      canvasHeight: 720,
      strokes: [],
      overlayStrokes: [],
      canvasStrokes: []
    };

    if (!fs.existsSync(inkFilePath)) {
      return defaultData;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(inkFilePath, 'utf-8'));
      return {
        ...defaultData,
        ...parsed,
        strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
        overlayStrokes: Array.isArray(parsed.overlayStrokes) ? parsed.overlayStrokes : [],
        canvasStrokes: Array.isArray(parsed.canvasStrokes) ? parsed.canvasStrokes : []
      };
    } catch {
      return defaultData;
    }
  }

  public static saveInkData(noteId: string, updates: Partial<NoteInkData>): NoteInkData {
    this.ensureDirs();
    const safeId = this.sanitizeName(noteId);
    const inkFilePath = path.join(getInkDir(), `${safeId}.ink.json`);
    const current = this.getInkData(noteId);

    const updated: NoteInkData = {
      ...current,
      ...updates,
      noteId,
      updatedAt: Date.now()
    };

    fs.writeFileSync(inkFilePath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  public static deleteInkData(noteId: string): boolean {
    this.ensureDirs();
    const safeId = this.sanitizeName(noteId);
    const inkFilePath = path.join(getInkDir(), `${safeId}.ink.json`);
    if (fs.existsSync(inkFilePath)) {
      try {
        fs.unlinkSync(inkFilePath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Returns a complete security breakdown of the Vault:
   * - How many notes are in the Local Personal PC Vault (unlinked)
   * - How many notes are linked to the currently authenticated Google Account
   * - How many notes are locked/hidden because they belong to an unauthenticated or different Google Account
   */
  public static getVaultSecuritySummary(): {
    totalFilesOnDisk: number;
    accessibleNotesCount: number;
    localPcNotesCount: number;
    linkedToActiveAccountCount: number;
    lockedForeignNotesCount: number;
    activeAccountHash: string | null;
    isVaultUnlocked: boolean;
    countsByAccountHash: Record<string, number>;
  } {
    this.ensureDirs();
    ConfigManager.getConfig();
    const activeHash = SecurityShield.getActiveAccountHash();

    let totalFilesOnDisk = 0;
    let accessibleNotesCount = 0;
    let localPcNotesCount = 0;
    let linkedToActiveAccountCount = 0;
    let lockedForeignNotesCount = 0;
    const countsByAccountHash: Record<string, number> = {};

    const scanDir = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          totalFilesOnDisk++;
          try {
            const raw = fs.readFileSync(fullPath, 'utf-8');
            const check = SecurityShield.inspectAndUnwrapNote(raw);
            if (!check.ownerAccountHash) {
              localPcNotesCount++;
              accessibleNotesCount++;
            } else {
              countsByAccountHash[check.ownerAccountHash] = (countsByAccountHash[check.ownerAccountHash] || 0) + 1;
              if (check.canAccess && check.ownerAccountHash === activeHash) {
                linkedToActiveAccountCount++;
                accessibleNotesCount++;
              } else {
                lockedForeignNotesCount++;
              }
            }
          } catch {}
        }
      }
    };

    scanDir(getGlobalNotesDir());

    return {
      totalFilesOnDisk,
      accessibleNotesCount,
      localPcNotesCount,
      linkedToActiveAccountCount,
      lockedForeignNotesCount,
      activeAccountHash: activeHash,
      isVaultUnlocked: SecurityShield.isVaultUnlocked(),
      countsByAccountHash
    };
  }

  /**
   * Links or unlinks existing local PC notes to the currently authenticated Google Account
   */
  public static setVaultNotesOwnership(mode: 'bind_to_account' | 'release_to_local_pc'): { updatedCount: number } {
    this.ensureDirs();
    ConfigManager.getConfig();
    const activeHash = SecurityShield.getActiveAccountHash();
    if (!activeHash) {
      throw new Error('É necessário estar autenticado com sua conta Google e chave do cofre para vincular ou desvincular notas.');
    }

    let updatedCount = 0;
    const scanDir = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const raw = fs.readFileSync(fullPath, 'utf-8');
            const check = SecurityShield.inspectAndUnwrapNote(raw);
            if (!check.canAccess) continue; // Never touch notes belonging to another user

            let updatedContent = check.content;
            if (mode === 'bind_to_account') {
              if (!updatedContent.match(/<!--\s*tellus_owner:\s*([a-f0-9]+)\s*-->/i)) {
                updatedContent = `<!-- tellus_owner: ${activeHash} -->\n${updatedContent}`;
                fs.writeFileSync(fullPath, updatedContent, 'utf-8');
                updatedCount++;
              }
            } else if (mode === 'release_to_local_pc' && check.ownerAccountHash === activeHash) {
              updatedContent = updatedContent.replace(/<!--\s*tellus_owner:\s*([a-f0-9]+)\s*-->\r?\n?/gi, '');
              fs.writeFileSync(fullPath, updatedContent, 'utf-8');
              updatedCount++;
            }
          } catch {}
        }
      }
    };

    scanDir(getGlobalNotesDir());
    return { updatedCount };
  }
}

export const TelluNoteEngine = TellusNoteEngine;
export const NotesEngine = TellusNoteEngine;
export const FrankNoteEngine = TellusNoteEngine;
export default TellusNoteEngine;
