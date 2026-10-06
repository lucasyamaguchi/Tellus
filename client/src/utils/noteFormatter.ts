import { api } from '../api';

/**
 * Utilities for formatting notes and notebooks for clean, fluid reading and direct download.
 * Supports exporting in PDF (via Print to PDF / formatted HTML print dialog), Word (.doc/.docx compatible document)
 * and Markdown (.md) com ou sem tags, salvando diretamente na pasta Downloads do computador.
 */

export interface FormattableNote {
  id?: string;
  title: string;
  content: string;
  folder?: string;
  subject?: string;
  updatedAt?: number;
}

export type ExportFormat = 'md_clean' | 'md_tags' | 'word' | 'pdf';

/**
 * Strips internal Obsidian/Vault tags, system markers, and converts wikilinks to fluid, clean markdown.
 * Se keepTags for true, preserva as hashtags (#tag) intactas.
 */
export function cleanMarkdownForFluidReading(rawContent: string, noteTitle?: string, keepTags: boolean = false): string {
  if (!rawContent) return '';

  let text = rawContent;

  // 1. Remove YAML Frontmatter (---\n ... \n---)
  text = text.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, '');

  // 2. Remove bracketed system markers: [NOTA], [/NOTA], [DETALHES], [/DETALHES]
  text = text.replace(/\[\/?(NOTA|DETALHES)\]/gi, '');

  // 3. Format special callouts like [DESAFIO DO MECÂNICO X] into clean topics
  text = text.replace(/\[DESAFIO DO MECÂNICO\s*(\d+)?\]/gi, (_match, num) => {
    return `\n\n### 🎯 Desafio do Mecânico ${num || ''}\n`;
  });

  // 4. Convert Wikilinks [[Nota|Nome Exibição]] -> **Nome Exibição** and [[Nota]] -> **Nota**
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '**$2**');
  text = text.replace(/\[\[([^\]]+)\]\]/g, '**$1**');

  if (!keepTags) {
    // 5. Remove dedicated "Tags:" or "🏷️ Tags:" lines
    text = text.replace(/^[ \t]*(?:Tags|🏷️\s*Tags|Categorias)\s*:[ \t]*[^\r\n]*$/gim, '');

    // 6. Strip out hashtag tags (e.g. #estudos #javascript #vaga-nestle),
    // but strictly preserve Markdown Headings (# Heading, ## Subheading, ### Topic)
    text = text.replace(/(^|[ \t])#([a-zA-Z0-9_\-\/]+)(?=[ \t\r\n]|$)/g, (match, prefix, tag) => {
      if (/^\d+$/.test(tag)) return `${prefix}#${tag}`;
      return prefix;
    });
  }

  // 7. Clean emotion / voice tags like [whisper], [excited], [cheerful], [serious]
  text = text.replace(/\[(whisper|sussurro|excited|cheerful|alegre|calm|calmo|serious|sério|thoughtful|curious|empolgado)\]/gi, '');

  // 8. Clean up extra trailing spaces and multiple empty lines (max 2 linebreaks)
  text = text
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 9. Ensure the note has a clear title at the very top if not already present
  if (noteTitle && noteTitle.trim()) {
    const cleanTitle = noteTitle.trim();
    const firstLine = text.split('\n')[0]?.trim() || '';
    if (!firstLine.startsWith('# ') || !firstLine.toLowerCase().includes(cleanTitle.toLowerCase())) {
      text = `# ${cleanTitle}\n\n${text}`;
    }
  }

  return text;
}

/**
 * Converts basic markdown formatting into clean HTML for Word (.doc) and PDF printing.
 */
export function markdownToStyledHtml(markdown: string, title: string, folder?: string, dateStr?: string): string {
  let html = markdown;

  // Escape HTML characters
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Unescape back allowed formatting tags if needed
  html = html.replace(/&lt;(\/?(?:u|b|i|strong|em|mark|span|table|thead|tbody|tr|th|td|br|div|p))&gt;/gi, '<$1>');
  html = html.replace(/&lt;span style=&quot;(.*?)&quot;&gt;/gi, '<span style="$1">');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #0369a1; margin-top: 1.5em; margin-bottom: 0.5em; font-size: 1.15em; font-weight: 700;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #0f172a; margin-top: 1.8em; margin-bottom: 0.6em; font-size: 1.35em; font-weight: 700; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #0f172a; margin-top: 0.5em; margin-bottom: 0.8em; font-size: 1.85em; font-weight: 800; border-bottom: 2px solid #38bdf8; padding-bottom: 8px;">$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<del style="color: #94a3b8;">$1</del>');

  // Blockquotes / Callouts
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid #38bdf8; margin: 1em 0; padding: 0.75em 1.2em; background-color: #f8fafc; color: #334155; border-radius: 0 8px 8px 0; font-style: normal;">$1</blockquote>');

  // Horizontal Rules
  html = html.replace(/^---$/gim, '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 2em 0;" />');

  // Lists
  html = html.replace(/^- \[ \] (.*$)/gim, '<div style="margin: 0.3em 0; display: flex; align-items: flex-start;"><input type="checkbox" disabled style="margin-right: 8px; margin-top: 4px;" /><span>$1</span></div>');
  html = html.replace(/^- \[x\] (.*$)/gim, '<div style="margin: 0.3em 0; display: flex; align-items: flex-start;"><input type="checkbox" checked disabled style="margin-right: 8px; margin-top: 4px;" /><span style="text-decoration: line-through; color: #64748b;">$1</span></div>');
  html = html.replace(/^- (.*$)/gim, '<li style="margin: 0.3em 0; color: #334155;">$1</li>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li style="margin: 0.3em 0; color: #334155;">$1</li>');

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code style="background-color: #f1f5f9; color: #d97706; padding: 2px 6px; border-radius: 4px; font-family: Consolas, monospace; font-size: 0.9em;">$1</code>');

  // Convert basic Markdown tables
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
    const lines = match.trim().split(/\r?\n/);
    if (lines.length < 2) return match;
    let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: 0.9em;">';
    
    // Header
    const headers = lines[0].split('|').filter(c => c.trim() !== '');
    tableHtml += '<thead><tr style="background-color: #f1f5f9;">';
    headers.forEach(h => {
      tableHtml += `<th style="padding: 10px 14px; text-align: left; font-weight: 700; color: #0284c7; border: 1px solid #cbd5e1;">${h.trim()}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // Body (skip separator line lines[1])
    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split('|').filter(c => c.trim() !== '');
      if (cols.length === 0) continue;
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      tableHtml += `<tr style="background-color: ${bg};">`;
      cols.forEach(c => {
        tableHtml += `<td style="padding: 9px 14px; color: #334155; border: 1px solid #e2e8f0; vertical-align: top;">${c.trim()}</td>`;
      });
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';
    return tableHtml;
  });

  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<table') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr') || trimmed.startsWith('<div') || trimmed.startsWith('<li')) {
        return trimmed;
      }
      return `<p style="margin: 0.8em 0; line-height: 1.7; color: #334155;">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  const formattedDate = dateStr || new Date().toLocaleDateString('pt-BR');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @media print {
      body { margin: 15mm; font-size: 11pt; color: #000; background: #fff; }
      .no-print { display: none !important; }
      a { text-decoration: none; color: #0284c7; }
      h1, h2, h3 { page-break-after: avoid; }
      table, pre, blockquote { page-break-inside: avoid; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 40px auto;
      max-width: 820px;
      padding: 0 20px;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.65;
    }
    .header-box {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 25px;
    }
    .meta {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      font-family: Consolas, monospace;
    }
    .footer {
      margin-top: 50px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      font-family: Consolas, monospace;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div style="display: flex; justify-content: space-between; align-items: baseline;">
      <span style="font-weight: 700; color: #0284c7; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Tellus Notes • Documento de Estudo</span>
      <span class="meta">${formattedDate}</span>
    </div>
    <div class="meta" style="margin-top: 6px;">📂 Pasta: <strong>${folder || 'Geral'}</strong></div>
  </div>

  <main>
    ${html}
  </main>

  <div class="footer">
    Documento exportado pelo Tellus Agentic IDE • Notes Module (Vault)
  </div>
</body>
</html>`;
}

/**
 * Triggers browser download fallback if needed.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Formata e baixa uma anotação individual para a pasta Downloads do PC.
 * Formatos suportados:
 * - 'md_clean': Markdown fluido e limpo para leitura (.md sem hashtags internas)
 * - 'md_tags': Markdown com todas as #tags e wikilinks preservados
 * - 'word': Arquivo compatível com Microsoft Word (.doc / .docx) com formatação rica
 * - 'pdf': Janela de impressão em PDF nativa com diagramação e tipografia moderna
 */
export async function downloadNoteInFormat(
  note: FormattableNote,
  format: ExportFormat = 'md_clean'
): Promise<{ success: boolean; filePath?: string; filename?: string }> {
  const safeFilename = (note.title || 'Anotacao')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .slice(0, 80);

  const dateStr = note.updatedAt 
    ? new Date(note.updatedAt).toLocaleDateString('pt-BR') 
    : new Date().toLocaleDateString('pt-BR');

  // 1. PDF Export
  if (format === 'pdf') {
    const cleanContent = cleanMarkdownForFluidReading(note.content, note.title, false);
    const htmlDocument = markdownToStyledHtml(cleanContent, note.title, note.folder, dateStr);

    // Abre janela popup e invoca window.print() para gerar PDF nativo no destino Downloads / impressora
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlDocument);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {}
      }, 350);
    }

    // Salva também o HTML formatado diretamente na pasta Downloads para acesso instantâneo
    try {
      const res = await api.exportNoteToDownloads({
        filename: `${safeFilename}_Para_PDF.html`,
        content: htmlDocument,
        openFolder: true
      });
      return { success: true, filePath: res.filePath, filename: res.filename };
    } catch {
      triggerFileDownload(htmlDocument, `${safeFilename}_Para_PDF.html`, 'text/html;charset=utf-8');
      return { success: true, filename: `${safeFilename}_Para_PDF.html` };
    }
  }

  // 2. Word Document Export (.doc)
  if (format === 'word') {
    const cleanContent = cleanMarkdownForFluidReading(note.content, note.title, false);
    const htmlDocument = markdownToStyledHtml(cleanContent, note.title, note.folder, dateStr);

    const docFileName = `${safeFilename}.doc`;
    try {
      const res = await api.exportNoteToDownloads({
        filename: docFileName,
        content: htmlDocument,
        openFolder: true
      });
      return { success: true, filePath: res.filePath, filename: res.filename };
    } catch {
      triggerFileDownload(htmlDocument, docFileName, 'application/msword;charset=utf-8');
      return { success: true, filename: docFileName };
    }
  }

  // 3. Markdown Exports (md_clean ou md_tags)
  const isWithTags = format === 'md_tags';
  const cleanContent = cleanMarkdownForFluidReading(note.content, note.title, isWithTags);
  const tagHeader = isWithTags ? 'com Tags do Vault' : 'Formatada para Leitura';
  
  const fullDocument = `*Arquivo de Estudo — Tellus (${tagHeader})*\n*Pasta: ${note.folder || 'Geral'} • Atualizado em: ${dateStr}*\n\n---\n\n${cleanContent}\n`;
  const mdFileName = isWithTags ? `${safeFilename}_ComTags.md` : `${safeFilename}.md`;

  try {
    const res = await api.exportNoteToDownloads({
      filename: mdFileName,
      content: fullDocument,
      openFolder: true
    });
    return { success: true, filePath: res.filePath, filename: res.filename };
  } catch {
    triggerFileDownload(fullDocument, mdFileName, 'text/markdown;charset=utf-8');
    return { success: true, filename: mdFileName };
  }
}

/**
 * Formats and downloads an entire notebook (all its notes) as a unified, cohesive study guide.
 */
export async function downloadFormattedNotebook(
  notebookName: string, 
  notes: FormattableNote[],
  format: ExportFormat = 'md_clean'
): Promise<{ success: boolean; filePath?: string; filename?: string }> {
  if (!notes || notes.length === 0) return { success: false };

  const dateStr = new Date().toLocaleDateString('pt-BR');
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isWithTags = format === 'md_tags';

  // 1. Cover and Table of Contents
  let notebookDoc = `# 📚 Caderno: ${notebookName}\n\n`;
  notebookDoc += `> **Caderno de Estudos e Anotações — Tellus**\n`;
  notebookDoc += `> **Data de Exportação:** ${dateStr} às ${timeStr}\n`;
  notebookDoc += `> **Total de Anotações:** ${notes.length} tópicos\n\n`;
  notebookDoc += `---\n\n`;

  notebookDoc += `## 📑 Sumário do Caderno\n\n`;
  notes.forEach((note, idx) => {
    const folderInfo = note.folder && note.folder !== notebookName ? ` *(Subpasta: ${note.folder})*` : '';
    notebookDoc += `${idx + 1}. **${note.title}**${folderInfo}\n`;
  });

  notebookDoc += `\n---\n\n`;

  // 2. Append each note
  notes.forEach((note, idx) => {
    const cleanNoteBody = cleanMarkdownForFluidReading(note.content, note.title, isWithTags);
    notebookDoc += `\n\n<!-- Início da Nota ${idx + 1} -->\n`;
    notebookDoc += `${cleanNoteBody}\n\n`;
    notebookDoc += `---\n`;
  });

  const safeNotebookFilename = notebookName
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .slice(0, 80);

  if (format === 'pdf') {
    const htmlDocument = markdownToStyledHtml(notebookDoc, `Caderno: ${notebookName}`, notebookName, dateStr);
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlDocument);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {}
      }, 400);
    }
    const htmlName = `${safeNotebookFilename}_Caderno_Completo_PDF.html`;
    try {
      const res = await api.exportNoteToDownloads({
        filename: htmlName,
        content: htmlDocument,
        openFolder: true
      });
      return { success: true, filePath: res.filePath, filename: res.filename };
    } catch {
      triggerFileDownload(htmlDocument, htmlName, 'text/html;charset=utf-8');
      return { success: true, filename: htmlName };
    }
  }

  if (format === 'word') {
    const htmlDocument = markdownToStyledHtml(notebookDoc, `Caderno: ${notebookName}`, notebookName, dateStr);
    const docName = `${safeNotebookFilename}_Caderno_Completo.doc`;
    try {
      const res = await api.exportNoteToDownloads({
        filename: docName,
        content: htmlDocument,
        openFolder: true
      });
      return { success: true, filePath: res.filePath, filename: res.filename };
    } catch {
      triggerFileDownload(htmlDocument, docName, 'application/msword;charset=utf-8');
      return { success: true, filename: docName };
    }
  }

  const ext = isWithTags ? '_Caderno_Completo_ComTags.md' : '_Caderno_Completo.md';
  const mdName = `${safeNotebookFilename}${ext}`;

  try {
    const res = await api.exportNoteToDownloads({
      filename: mdName,
      content: notebookDoc,
      openFolder: true
    });
    return { success: true, filePath: res.filePath, filename: res.filename };
  } catch {
    triggerFileDownload(notebookDoc, mdName, 'text/markdown;charset=utf-8');
    return { success: true, filename: mdName };
  }
}

/**
 * Mantém compatibilidade com chamadas anteriores
 */
export function downloadFormattedNote(note: FormattableNote): void {
  downloadNoteInFormat(note, 'md_clean');
}

/**
 * Converte Markdown salvo no Vault para HTML rico e formatado para o editor visual (WYSIWYG/ContentEditable).
 * O usuário interage exclusivamente com a versão formatada (sem ver hashtags, asteriscos ou pipes).
 */
export function markdownToEditorHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return '<p><br></p>';

  let html = markdown;

  // 1. Remove YAML frontmatter e comentários internos de subject
  html = html.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, '');
  html = html.replace(/<!--\s*subject:\s*(.*?)\s*-->/g, '');

  // 2. Proteger blocos de código
  const codeBlocks: { lang: string; code: string }[] = [];
  html = html.replace(/```([a-z0-9_-]*)\r?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const id = `___CODE_BLOCK_${codeBlocks.length}___`;
    codeBlocks.push({ lang, code });
    return id;
  });

  // 3. Proteger e formatar tabelas Markdown para tabelas HTML ricas e editáveis
  const tables: string[] = [];
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
    const lines = match.trim().split(/\r?\n/);
    if (lines.length < 2) return match;
    const id = `___TABLE_BLOCK_${tables.length}___`;

    let tableHtml = '<div class="my-4 overflow-x-auto rounded-xl border border-card-border/80 bg-panel/30 shadow-md"><table class="w-full border-collapse text-left text-xs leading-relaxed" style="width: 100%; border-collapse: collapse;">';
    const headers = lines[0].split('|').map(s => s.trim()).filter((s, idx, arr) => (idx > 0 && idx < arr.length - 1) || s !== '');
    tableHtml += '<thead class="bg-card/90 text-slate-200 border-b border-card-border"><tr style="border-bottom: 1px solid rgba(255,255,255,0.15);">';
    headers.forEach(h => {
      tableHtml += `<th class="px-3.5 py-2.5 font-bold text-accent-light border-r border-card-border/40 last:border-r-0" style="padding: 8px 12px; font-weight: 700; color: #38bdf8; border-right: 1px solid rgba(255,255,255,0.1);">${h}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split('|').map(s => s.trim()).filter((s, idx, arr) => (idx > 0 && idx < arr.length - 1) || s !== '');
      if (cols.length === 0) continue;
      tableHtml += '<tr class="hover:bg-card/40 border-b border-card-border/30 last:border-b-0" style="border-bottom: 1px solid rgba(255,255,255,0.06);">';
      cols.forEach(c => {
        tableHtml += `<td class="px-3.5 py-2.5 align-top border-r border-card-border/30 last:border-r-0 text-slate-300" style="padding: 8px 12px; border-right: 1px solid rgba(255,255,255,0.06);">${c}</td>`;
      });
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table></div>';
    tables.push(tableHtml);
    return id;
  });

  // 4. Wikilinks [[Nota|Nome]] ou [[Nota]] -> Badges interativos
  html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="wikilink-badge inline-flex items-center px-2 py-0.5 rounded-lg bg-accent/15 border border-accent/30 text-accent-light font-medium text-xs cursor-pointer select-none" data-wikilink="$1" data-label="$2">[[ $2 ]]</span>');
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink-badge inline-flex items-center px-2 py-0.5 rounded-lg bg-accent/15 border border-accent/30 text-accent-light font-medium text-xs cursor-pointer select-none" data-wikilink="$1">[[ $1 ]]</span>');

  // 5. Imagens ![alt](url) -> <img> com preview moderno
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-2xl max-h-[460px] w-auto max-w-full my-4 border border-card-border/80 shadow-2xl object-contain" style="max-width: 100%; border-radius: 12px; margin: 12px 0; display: block;" />');

  // 6. Cabeçalhos H1, H2, H3, H4
  html = html.replace(/^#### (.*$)/gim, '<h4 class="text-sm font-bold text-slate-200 mt-4 mb-2">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-accent-light mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-100 mt-6 mb-2.5 pb-1 border-b border-card-border/60">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-slate-500 mt-6 mb-3 pb-2 border-b-2 border-accent">$1</h1>');

  // 7. Citações / Callouts
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-accent pl-3.5 my-3 italic text-slate-400 bg-card/40 py-2 rounded-r-xl">$1</blockquote>');

  // 8. Linhas horizontais
  html = html.replace(/^---$/gim, '<hr class="border-0 border-t border-card-border/80 my-6" />');

  // 9. Checklists interativos (- [ ] e - [x])
  html = html.replace(/^- \[ \] (.*$)/gim, '<div class="note-task-row flex items-start space-x-2.5 my-1.5" data-task="true"><input type="checkbox" class="mt-1 w-4 h-4 rounded border-slate-600 accent-emerald-500 cursor-pointer" /><span>$1</span></div>');
  html = html.replace(/^- \[x\] (.*$)/gim, '<div class="note-task-row flex items-start space-x-2.5 my-1.5 opacity-70" data-task="true"><input type="checkbox" checked class="mt-1 w-4 h-4 rounded border-slate-600 accent-emerald-500 cursor-pointer" /><span class="line-through text-slate-400">$1</span></div>');

  // 10. Listas de marcadores e listas numeradas
  html = html.replace(/^- (.*$)/gim, '<li class="ml-5 list-disc my-1">$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gim, '<li class="ml-5 list-decimal my-1">$2</li>');

  // 11. Formatação inline: Negrito, Itálico, Tachado, Código
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-card border border-card-border/60 text-amber-300 px-1.5 py-0.5 rounded-md font-mono text-xs">$1</code>');

  // 12. Restaurar Tabelas
  tables.forEach((tbl, idx) => {
    html = html.replace(`___TABLE_BLOCK_${idx}___`, tbl);
  });

  // 13. Restaurar Blocos de Código
  codeBlocks.forEach((cb, idx) => {
    const cbHtml = `<pre class="bg-[#090b10] border border-card-border rounded-xl p-3 my-3 font-mono text-xs overflow-x-auto text-slate-300"><code class="language-${cb.lang}">${cb.code}</code></pre>`;
    html = html.replace(`___CODE_BLOCK_${idx}___`, cbHtml);
  });

  // 14. Quebras de parágrafo estruturadas
  const rawLines = html.split('\n');
  const result: string[] = [];
  let inUl = false;

  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i];
    const trimmed = l.trim();
    if (!trimmed) {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      result.push('<p><br></p>');
      continue;
    }

    if (
      trimmed.startsWith('<h1') || trimmed.startsWith('<h2') || trimmed.startsWith('<h3') || trimmed.startsWith('<h4') ||
      trimmed.startsWith('<div') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr') ||
      trimmed.startsWith('<pre') || trimmed.startsWith('<table')
    ) {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      result.push(trimmed);
    } else if (trimmed.startsWith('<li')) {
      if (!inUl) {
        result.push('<ul class="my-2 space-y-1">');
        inUl = true;
      }
      result.push(trimmed);
    } else {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      result.push(`<p class="my-1.5 leading-relaxed">${trimmed}</p>`);
    }
  }

  if (inUl) {
    result.push('</ul>');
  }

  return result.join('\n');
}

/**
 * Converte o HTML editado visualmente pelo usuário de volta para Markdown limpo para salvar no Vault (.md em background).
 */
export function editorHtmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html;

  // Normalizar quebras de linha
  md = md.replace(/\r\n/g, '\n');

  // Cabeçalhos
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');

  // Tabelas
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableContent) => {
    const rows: string[] = [];
    const trMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    trMatches.forEach((tr: string, rIdx: number) => {
      const cells: string[] = [];
      const cellMatches = tr.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
      cellMatches.forEach((c: string) => {
        const text = c.replace(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi, '$1').trim();
        cells.push(text);
      });
      if (cells.length > 0) {
        rows.push('| ' + cells.join(' | ') + ' |');
        if (rIdx === 0) {
          rows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        }
      }
    });
    return '\n\n' + rows.join('\n') + '\n\n';
  });

  // Wikilinks
  md = md.replace(/<span[^>]*data-wikilink="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, '[[$1]]');

  // Imagens
  md = md.replace(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]+)"[^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]*src="([^"]+)"[^>]*\/?>/gi, '![]($1)');

  // Task rows / Checklists
  md = md.replace(/<div[^>]*class="[^"]*note-task-row[^"]*"[^>]*>[\s\S]*?<input[^>]*checked[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi, '- [x] $1\n');
  md = md.replace(/<div[^>]*class="[^"]*note-task-row[^"]*"[^>]*>[\s\S]*?<input[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi, '- [ ] $1\n');
  md = md.replace(/<div[^>]*data-task="true"[^>]*>[\s\S]*?<input[^>]*checked[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi, '- [x] $1\n');
  md = md.replace(/<div[^>]*data-task="true"[^>]*>[\s\S]*?<input[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi, '- [ ] $1\n');

  // Checkboxes dentro de <li>
  md = md.replace(/<li[^>]*>[\s\S]*?<input[^>]*checked[^>]*>([\s\S]*?)<\/li>/gi, '- [x] $1\n');
  md = md.replace(/<li[^>]*>[\s\S]*?<input[^>]*>([\s\S]*?)<\/li>/gi, '- [ ] $1\n');

  // Listas comuns
  md = md.replace(/<li[^>]*list-decimal[^>]*>([\s\S]*?)<\/li>/gi, '1. $1\n');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Citações / Callouts
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');

  // Linhas horizontais
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n\n');

  // Blocos de código e código inline
  md = md.replace(/<pre[^>]*><code[^>]*class="language-([^"]*)"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```$1\n$2\n```\n\n');
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Formatação rica básica: Negrito, Itálico, Tachado
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~');

  // Parágrafos, Divs e quebras de linha
  md = md.replace(/<p[^>]*><br\s*\/?>\s*<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n');

  // Limpeza de quebras de linha excessivas
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

