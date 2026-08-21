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
  subject: string; // e.g. "Arquitetura", "Segurança", "Ideias", "Geral"
  tags: string[];   // e.g. ["#database", "#performance"]
  content: string;
  links: string[];  // Outbound [[wikilinks]]
  backlinks: string[]; // Inbound notes that reference this note
  createdAt: number;
  updatedAt: number;
  isProjectSpecific?: boolean;
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

  // Extract subject / category from frontmatter or default to "Geral"
  private static parseNote(filePath: string, isProjectSpecific: boolean = false): FrankNote {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const id = filename.replace(/\.md$/, '');

    // Extract title from first H1 or filename
    const firstLine = content.split('\n')[0] || '';
    const titleMatch = firstLine.match(/^#+\s*(.*)/);
    const title = titleMatch ? titleMatch[1].trim() : id.replace(/[-_]/g, ' ');

    // Extract subject/topic if marked with <!-- subject: xyz --> or default to parent directory
    const subjectMatch = content.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'Geral';

    const tags = this.extractTags(content);
    const links = this.extractWikilinks(content);

    return {
      id,
      title,
      filename,
      subject,
      tags,
      content,
      links,
      backlinks: [],
      createdAt: stat.birthtimeMs || stat.mtimeMs,
      updatedAt: stat.mtimeMs,
      isProjectSpecific
    };
  }

  public static listNotes(projectPath?: string): FrankNote[] {
    this.ensureDirs(projectPath);
    const notes: FrankNote[] = [];

    // 1. Read Global Notes (~/.tellus/notes)
    if (fs.existsSync(GLOBAL_NOTES_DIR)) {
      const files = fs.readdirSync(GLOBAL_NOTES_DIR);
      for (const file of files) {
        if (file.endsWith('.md') && !file.startsWith('.')) {
          const filePath = path.join(GLOBAL_NOTES_DIR, file);
          notes.push(this.parseNote(filePath, false));
        }
      }
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

    // If no notes exist yet, create a welcoming FrankMD starter note
    if (notes.length === 0) {
      this.saveNote({
        title: 'Bem-vindo ao FrankMD Notes',
        subject: 'Início',
        content: `# Bem-vindo ao FrankMD Notes

Sistema de anotações seguras baseado no conceito **FrankMD** e no grafo de conhecimento do Obsidian.

## 🛡️ Data Safety
- Arquivos salvos em texto puro Markdown no seu disco.
- Histórico de backups e proteção contra deleção acidental.
- Conexões com wikilinks: use \`[[Nome da Nota]]\` para criar ligações automáticas.
- Use tags como #arquitetura, #segurança, #ideias para categorizar.

## 🔗 Exemplo de Conexão
Crie uma nova nota e vincule a [[Arquitetura do Projeto]]!
`,
        isProjectSpecific: false
      });
      return this.listNotes(projectPath);
    }

    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public static saveNote(data: {
    id?: string;
    title: string;
    subject?: string;
    content: string;
    isProjectSpecific?: boolean;
  }, projectPath?: string): FrankNote {
    this.ensureDirs(projectPath);

    const safeTitle = data.title.trim() || 'Sem Título';
    const id = data.id || safeTitle.toLowerCase().replace(/[^a-z0-9\u00C0-\u00FF]/gi, '-').replace(/-+/g, '-').slice(0, 50);
    const filename = `${id}.md`;

    // Todas as notas, inclusive as marcadas como específicas do projeto,
    // são armazenadas no cofre para que o Obsidian tenha uma fonte única.
    const filePath = path.join(GLOBAL_NOTES_DIR, filename);

    // Data Safety: Backup before overwriting existing file
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf-8');
      const backupFilename = `${id}_backup_${Date.now()}.md`;
      fs.writeFileSync(path.join(BACKUPS_DIR, backupFilename), existingContent, 'utf-8');
    }

    let finalContent = data.content;
    const subject = data.subject || 'Geral';
    if (!finalContent.includes('<!-- subject:')) {
      finalContent = `<!-- subject: ${subject} -->\n${finalContent}`;
    }

    fs.writeFileSync(filePath, finalContent, 'utf-8');
    return this.parseNote(filePath, data.isProjectSpecific);
  }

  public static deleteNote(id: string, isProjectSpecific?: boolean, projectPath?: string): boolean {
    const filePath = path.join(GLOBAL_NOTES_DIR, `${id}.md`);
    if (fs.existsSync(filePath)) {
      // Create backup before deleting
      const existingContent = fs.readFileSync(filePath, 'utf-8');
      const backupFilename = `${id}_deleted_${Date.now()}.md`;
      fs.writeFileSync(path.join(BACKUPS_DIR, backupFilename), existingContent, 'utf-8');
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
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

      if (note.subject) {
        subjects.add(note.subject);
        links.push({
          source: `note_${note.id}`,
          target: `sub_${note.subject}`,
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

    // Add Subject Nodes
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
