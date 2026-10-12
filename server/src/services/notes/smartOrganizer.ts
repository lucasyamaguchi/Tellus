import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { ProviderHub } from '../providers/providerHub.js';
import { ConfigManager } from '../configManager.js';
import { TelluNoteEngine } from './telluNoteEngine.js';

const OBSIDIAN_VAULT_DIR = 'E:\\Die-Sonne\\Vault';

export interface IncomingDropzoneFile {
  name: string;
  type: string;
  size: number;
  base64Data: string;
}

export interface OrganizedFileResult {
  id: string;
  originalName: string;
  savedName: string;
  targetFolder: string;
  fullRelativePath: string;
  fileType: 'pdf' | 'image' | 'text' | 'code' | 'spreadsheet' | 'note' | 'idea' | 'whatsapp' | 'transcript' | 'other';
  size: number;
  reason: string;
  summary: string;
  tags: string[];
  success: boolean;
  error?: string;
  noteTitle?: string;
}

export interface DropzoneOrganizeReport {
  sessionId: string;
  timestamp: number;
  totalFiles: number;
  successfulCount: number;
  failedCount: number;
  vaultPath: string;
  reportNotePath?: string;
  results: OrganizedFileResult[];
}

export interface OrganizeRequestParams {
  files?: IncomingDropzoneFile[];
  textDump?: string;
  customVaultDir?: string;
}

export class SmartOrganizer {
  private static getVaultDir(): string {
    const dir = process.env.TELLUS_VAULT_DIR || process.env.OBSIDIAN_VAULT_DIR || OBSIDIAN_VAULT_DIR;
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        return path.resolve('./Vault');
      }
    }
    return dir;
  }

  public static listExistingFolders(baseDir: string = this.getVaultDir()): string[] {
    const folders: string[] = [];
    
    const scan = (currentDir: string, relative: string = '') => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const rel = relative ? `${relative}/${entry.name}` : entry.name;
            folders.push(rel.replace(/\\/g, '/'));
            scan(path.join(currentDir, entry.name), rel);
          }
        }
      } catch {
        // ignore errors
      }
    };

    scan(baseDir);
    return folders.length > 0 ? folders : ['Geral', 'Estudos', 'Documentos', 'Imagens', 'Projetos'];
  }

  private static async extractFileExcerpt(file: IncomingDropzoneFile, buffer: Buffer): Promise<{ excerpt: string; detectedType: OrganizedFileResult['fileType'] }> {
    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(lowerName);
    const isSpreadsheet = file.type.includes('sheet') || file.type.includes('csv') || /\.(csv|xlsx?|tsv)$/i.test(lowerName);
    const isCode = /\.(ts|tsx|js|jsx|py|java|cpp|c|go|rs|php|html|css|json|yaml|yml|sh|sql)$/i.test(lowerName);
    const isText = file.type.startsWith('text/') || /\.(txt|md|markdown|rtf|log|vtt|srt)$/i.test(lowerName);

    if (isPdf) {
      try {
        const parseFn = (pdfParse as any).default || pdfParse;
        const parsed = await parseFn(buffer);
        const text = parsed.text ? parsed.text.trim() : '';
        const preview = text.slice(0, 3500).replace(/\s+/g, ' ');
        return {
          excerpt: `[PDF ${parsed.numpages || 1} páginas]: ${preview || 'Documento PDF sem texto extraível.'}`,
          detectedType: 'pdf'
        };
      } catch (err: any) {
        return {
          excerpt: `[PDF ${file.name}]: Erro ao extrair texto direto: ${err.message}`,
          detectedType: 'pdf'
        };
      }
    }

    if (isImage) {
      return {
        excerpt: `[Imagem ${file.name} - Tamanho: ${(file.size / 1024).toFixed(1)} KB, Formato: ${file.type || path.extname(file.name)}]`,
        detectedType: 'image'
      };
    }

    if (isSpreadsheet || isText || isCode) {
      try {
        const str = buffer.toString('utf-8');
        const preview = str.slice(0, 4000).replace(/\r/g, '');
        let type: OrganizedFileResult['fileType'] = 'text';
        if (isSpreadsheet) type = 'spreadsheet';
        else if (isCode) type = 'code';
        else if (/\.(vtt|srt)$/i.test(lowerName) || /-->|\d{2}:\d{2}:\d{2}/.test(preview)) type = 'transcript';
        else if (/\[\d{2}\/\d{2}\/\d{2,4}|\d{2}:\d{2}\]/.test(preview)) type = 'whatsapp';

        return {
          excerpt: preview,
          detectedType: type
        };
      } catch {
        return {
          excerpt: `[Arquivo]: ${file.name}`,
          detectedType: 'other'
        };
      }
    }

    return {
      excerpt: `[Arquivo]: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      detectedType: 'other'
    };
  }

  public static async organize(
    params: OrganizeRequestParams
  ): Promise<DropzoneOrganizeReport> {
    const { files = [], textDump = '', customVaultDir } = params;
    const vaultDir = customVaultDir && fs.existsSync(customVaultDir) ? customVaultDir : this.getVaultDir();
    const existingFolders = this.listExistingFolders(vaultDir);
    const existingNotes = TelluNoteEngine.listNotes(vaultDir).slice(0, 40).map(n => ({
      title: n.title,
      folder: n.folder
    }));

    const sessionId = 'drop_' + Date.now().toString(36);
    const results: OrganizedFileResult[] = [];

    const config = ConfigManager.getConfig();
    const activeModel = config.defaultModel || 'deepseek/deepseek-chat';
    const activeProvider = config.defaultProvider || 'openrouter';

    // 1. Process Text Dump (Ideas, WhatsApp dumps, Video transcripts)
    if (textDump && textDump.trim().length > 0) {
      const isWhatsAppLike = /\[?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,\s*\d{1,2}:\d{2}(?::\d{2})?\s*\]?|[-~]\s*[^:]+:/i.test(textDump);
      const isTranscriptLike = /-->|\d{1,2}:\d{2}(?::\d{2})?|transcri|palestr|vídeo|video|youtube/i.test(textDump);

      const textPrompt = `Você é o Arquivista, Curador e Organizador Inteligente do Tellus.
O usuário enviou uma massa de texto bruto para a Smart Dropzone / Brain Dump.
O conteúdo pode conter:
- Mensagens anotadas ou exportadas do WhatsApp com múltiplos tópicos;
- Transcrições de palestras, aulas ou vídeos do YouTube;
- Fluxo de pensamentos, ideias técnicas e anotações de estudo desordenadas.

PASTAS EXISTENTES NO VAULT:
${existingFolders.map(f => '- ' + f).join('\n')}

ALGUMAS NOTAS EXISTENTES NO VAULT:
${existingNotes.map(n => `- [[${n.title}]] na pasta "${n.folder}"`).join('\n')}

SUA MISSÃO OBRIGATÓRIA:
1. Decompor criticamente o texto em TODOS os temas, ideias ou assuntos distintos. Não junte assuntos desconexos em uma só nota. Se houver 3 tópicos diferentes (ex: Segurança Web, Docker, Carreira), crie 3 notas separadas.
2. Para CADA tema/ideia identificada:
   - "title": Título claro, conciso e representativo em português (ex: "Autenticacao_JWT_Boas_Praticas", "Docker_Otimizacao_Imagens").
   - "targetFolder": Pasta no Vault onde faz mais sentido colocar (aproveite pastas existentes se houver afinidade, ou crie uma subpasta limpa, ex: "Estudos/Seguranca", "Estudos/DevOps").
   - "reason": Justificativa detalhada de por que foi colocado nessa pasta específica e como esse contexto foi interpretado e separado das demais ideias.
   - "summary": Resumo conciso de 1 parágrafo da ideia central.
   - "tags": Array com tags úteis (ex: ["#seguranca", "#jwt", "#estudos"]).
   - "content": O conteúdo completo e enriquecido da nota em Markdown elegante no estilo Obsidian/TellusMD, estruturado com seções:
     # [Título]
     > Resumo executivo / insight central.
     ## 📌 Conceitos-Chave e Detalhes
     ## 💡 Recomendações e Aplicações Práticas
     ## 🔗 Conexões e Referências [[Wikilinks]]
   - "sourceType": "${isWhatsAppLike ? 'whatsapp' : (isTranscriptLike ? 'transcript' : 'idea')}"

TEXTO BRUTO ENVIADO PELO USUÁRIO:
"""
${textDump.slice(0, 14000)}
"""

RESPONDA EXCLUSIVAMENTE COM UM ARRAY JSON VÁLIDO (sem markdown ou com \`\`\`json):
[
  {
    "title": "Nome_Da_Nota",
    "targetFolder": "Estudos/Exemplo",
    "reason": "Por que esta nota foi alocada nesta pasta e qual a relação com o tema.",
    "summary": "Resumo executivo do conteúdo.",
    "tags": ["#tag1", "#tag2"],
    "content": "# Conteúdo completo em Markdown...",
    "sourceType": "idea"
  }
]`;

      let textLlmResponse = '';
      try {
        await ProviderHub.streamChat(
          activeProvider,
          activeModel,
          [
            { role: 'system', content: 'Você é um arquivista e curador de conhecimento pessoal de alta precisão. Responda em JSON rigoroso.' },
            { role: 'user', content: textPrompt }
          ],
          [],
          {
            onContentChunk: (chunk) => { textLlmResponse += chunk; },
            onReasoningChunk: () => {},
            onToolCalls: () => {}
          }
        );
      } catch (err: any) {
        console.warn('[SmartOrganizer] Text dump LLM call failed:', err.message);
      }

      let parsedTextDecisions: Array<{
        title: string;
        targetFolder: string;
        reason: string;
        summary: string;
        tags: string[];
        content: string;
        sourceType?: OrganizedFileResult['fileType'];
      }> = [];

      try {
        const jsonMatch = textLlmResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          parsedTextDecisions = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('[SmartOrganizer] Failed to parse Text JSON:', e);
      }

      // Fallback if LLM failed to return array
      if (parsedTextDecisions.length === 0) {
        parsedTextDecisions = [{
          title: `Brain_Dump_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '_')}`,
          targetFolder: 'Geral/Brain Dump',
          reason: 'Anotações livres inseridas na Dropzone compiladas e salvas em pasta dedicada.',
          summary: 'Ideias e anotações brutas coletadas pelo usuário.',
          tags: ['#braindump', '#anotacoes'],
          content: `# 🧠 Brain Dump\n\n**Data:** ${new Date().toLocaleDateString('pt-BR')}\n\n---\n\n${textDump}`,
          sourceType: 'idea'
        }];
      }

      // Save each parsed topic note into the Vault
      for (let i = 0; i < parsedTextDecisions.length; i++) {
        const decision = parsedTextDecisions[i];
        const cleanTitle = TelluNoteEngine.sanitizeName(decision.title || `Ideia_${i + 1}`);
        const cleanFolder = TelluNoteEngine.sanitizePath(decision.targetFolder || 'Geral/Ideias');

        try {
          const savedNote = TelluNoteEngine.saveNote({
            title: cleanTitle,
            folder: cleanFolder,
            subject: cleanFolder,
            content: decision.content || `# ${cleanTitle}\n\n${decision.summary || ''}`
          }, vaultDir);

          results.push({
            id: `text_${i}_${Date.now()}`,
            originalName: `Texto: ${cleanTitle}`,
            savedName: `${cleanTitle}.md`,
            targetFolder: cleanFolder,
            fullRelativePath: savedNote.relativePath || `${cleanFolder}/${cleanTitle}.md`,
            fileType: decision.sourceType || 'note',
            size: Buffer.byteLength(decision.content, 'utf-8'),
            reason: decision.reason || 'Nota estruturada a partir de anotações livres.',
            summary: decision.summary || '',
            tags: decision.tags || [],
            noteTitle: cleanTitle,
            success: true
          });
        } catch (err: any) {
          results.push({
            id: `text_err_${i}`,
            originalName: cleanTitle,
            savedName: `${cleanTitle}.md`,
            targetFolder: cleanFolder,
            fullRelativePath: `${cleanFolder}/${cleanTitle}.md`,
            fileType: 'note',
            size: 0,
            reason: `Erro ao salvar nota: ${err.message}`,
            summary: '',
            tags: [],
            success: false,
            error: err.message
          });
        }
      }
    }

    // 2. Process Binary/Document Files if uploaded
    if (files && files.length > 0) {
      const preparedFiles: Array<{
        file: IncomingDropzoneFile;
        buffer: Buffer;
        excerpt: string;
        detectedType: OrganizedFileResult['fileType'];
      }> = [];

      for (const f of files) {
        const buffer = Buffer.from(f.base64Data, 'base64');
        const { excerpt, detectedType } = await this.extractFileExcerpt(f, buffer);
        preparedFiles.push({ file: f, buffer, excerpt, detectedType });
      }

      const fileDescriptions = preparedFiles.map((pf, idx) => {
        return `### Arquivo ${idx + 1}:
- Nome Original: "${pf.file.name}"
- Tamanho: ${(pf.file.size / 1024).toFixed(1)} KB
- Tipo Detectado: ${pf.detectedType}
- Conteúdo / Amostra:
${pf.excerpt.slice(0, 800)}
`;
      }).join('\n---\n');

      const filesPrompt = `Você é o Arquivista e Curador Inteligente do Tellus.
Sua missão é classificar e organizar arquivos recém-inseridos na Dropzone dentro do Vault de notas e conhecimento do usuário.

PASTAS EXISTENTES NO VAULT:
${existingFolders.map(f => '- ' + f).join('\n')}

DIRETRIZES DE ORGANIZAÇÃO:
1. Priorize alocar nas pastas existentes se houver afinidade temática evidente.
2. Se o tema for novo e relevante, você pode sugerir uma nova subpasta lógica.
3. Para CADA arquivo, explique com clareza em 1 ou 2 frases em Português: "Por que ele foi colocado nessa pasta específica e qual o contexto detectado".
4. Forneça tags (#tag) coerentes para facilitar indexação.

ARQUIVOS A ORGANIZAR:
${fileDescriptions}

RESPONDA EXCLUSIVAMENTE COM UM ARRAY JSON VÁLIDO:
[
  {
    "index": 1,
    "targetFolder": "NomeDaPasta/Subpasta",
    "cleanedFilename": "Nome_Limpo_Do_Arquivo.ext",
    "reason": "Justificativa clara em português de por que foi colocado aqui.",
    "summary": "Resumo do conteúdo.",
    "tags": ["#tag1", "#tag2"]
  }
]`;

      let filesLlmResponse = '';
      try {
        await ProviderHub.streamChat(
          activeProvider,
          activeModel,
          [
            { role: 'system', content: 'Você é um organizador e arquivista de arquivos de alta precisão. Responda em JSON rigoroso.' },
            { role: 'user', content: filesPrompt }
          ],
          [],
          {
            onContentChunk: (chunk) => { filesLlmResponse += chunk; },
            onReasoningChunk: () => {},
            onToolCalls: () => {}
          }
        );
      } catch (err: any) {
        console.warn('[SmartOrganizer] Files LLM call failed:', err.message);
      }

      let parsedFileDecisions: Array<{
        index: number;
        targetFolder: string;
        cleanedFilename: string;
        reason: string;
        summary: string;
        tags: string[];
      }> = [];

      try {
        const jsonMatch = filesLlmResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          parsedFileDecisions = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('[SmartOrganizer] Failed to parse Files JSON:', e);
      }

      for (let i = 0; i < preparedFiles.length; i++) {
        const pf = preparedFiles[i];
        const decision = parsedFileDecisions.find(d => d.index === (i + 1)) || parsedFileDecisions[i];

        let targetFolder = decision?.targetFolder ? TelluNoteEngine.sanitizePath(decision.targetFolder) : '';
        let cleanedFilename = decision?.cleanedFilename ? TelluNoteEngine.sanitizeName(decision.cleanedFilename) : '';
        let reason = decision?.reason || '';
        let summary = decision?.summary || '';
        let tags = decision?.tags || [];

        if (!targetFolder || !reason) {
          if (pf.detectedType === 'image') {
            targetFolder = 'Imagens';
            reason = 'Identificado como arquivo de imagem visual; alocado no repositório de mídias e imagens do Vault.';
          } else if (pf.detectedType === 'pdf') {
            targetFolder = 'Documentos/PDFs';
            reason = 'Arquivo de documento portátil (PDF); arquivado na pasta central de documentos e leituras.';
          } else if (pf.detectedType === 'code') {
            targetFolder = 'Estudos/Codigos';
            reason = 'Código-fonte ou script técnico; alocado na pasta de estudos de desenvolvimento.';
          } else if (pf.detectedType === 'spreadsheet') {
            targetFolder = 'Documentos/Tabelas';
            reason = 'Planilha ou conjunto de dados tabulares; arquivado em documentos estruturados.';
          } else {
            targetFolder = 'Geral';
            reason = 'Arquivo de texto ou formato diverso; alocado na pasta geral de anotações.';
          }
        }

        if (!cleanedFilename) {
          cleanedFilename = TelluNoteEngine.sanitizeName(pf.file.name);
        }

        const originalExt = path.extname(pf.file.name);
        if (originalExt && !cleanedFilename.toLowerCase().endsWith(originalExt.toLowerCase())) {
          cleanedFilename = `${cleanedFilename}${originalExt}`;
        }

        const destFolderDir = path.join(vaultDir, targetFolder);
        if (!fs.existsSync(destFolderDir)) {
          fs.mkdirSync(destFolderDir, { recursive: true });
        }

        const destFilePath = path.join(destFolderDir, cleanedFilename);
        const relativePath = path.relative(vaultDir, destFilePath).replace(/\\/g, '/');

        try {
          fs.writeFileSync(destFilePath, pf.buffer);

          if (pf.detectedType === 'pdf' || pf.detectedType === 'image') {
            const companionNoteName = `${path.basename(cleanedFilename, originalExt)}_info.md`;
            const companionNotePath = path.join(destFolderDir, companionNoteName);
            if (!fs.existsSync(companionNotePath)) {
              const companionContent = `<!-- subject: ${targetFolder} -->
# 📎 ${cleanedFilename}

**Tipo:** ${pf.detectedType.toUpperCase()} | **Tamanho:** ${(pf.file.size / 1024).toFixed(1)} KB
**Data de Importação:** ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
**Tags:** ${tags.join(' ')}

> **Por que foi colocado nesta pasta:**
> ${reason}

---

## Prévia / Anotações
${pf.detectedType === 'image' ? `![[${cleanedFilename}]]` : `[[${cleanedFilename}]]`}

${summary ? `**Resumo:** ${summary}` : ''}
`;
              fs.writeFileSync(companionNotePath, companionContent, 'utf-8');
            }
          }

          results.push({
            id: `file_${i}_${Date.now()}`,
            originalName: pf.file.name,
            savedName: cleanedFilename,
            targetFolder,
            fullRelativePath: relativePath,
            fileType: pf.detectedType,
            size: pf.file.size,
            reason,
            summary,
            tags,
            noteTitle: path.basename(cleanedFilename, path.extname(cleanedFilename)),
            success: true
          });
        } catch (err: any) {
          results.push({
            id: `file_err_${i}`,
            originalName: pf.file.name,
            savedName: cleanedFilename,
            targetFolder,
            fullRelativePath: relativePath,
            fileType: pf.detectedType,
            size: pf.file.size,
            reason: `Falha ao salvar no disco: ${err.message}`,
            summary: '',
            tags: [],
            success: false,
            error: err.message
          });
        }
      }
    }

    // 3. Generate Unified Audit Report
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
    const timeFormatted = now.toLocaleTimeString('pt-BR').replace(/:/g, 'h');
    const reportDir = path.join(vaultDir, 'Relatorios de Organizacao');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFilename = `Relatorio - ${dateFormatted} ${timeFormatted}.md`;
    const reportFullPath = path.join(reportDir, reportFilename);
    const reportRelativePath = path.relative(vaultDir, reportFullPath).replace(/\\/g, '/');

    const successfulCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    const reportMarkdown = `# 📑 Relatório de Ingestão & Organização Automática da Dropzone

**Data:** ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}
**Itens / Tópicos Processados:** ${results.length} (${successfulCount} organizados com sucesso, ${failedCount} erros)
**Modelo Responsável:** \`${activeModel}\`

---

## 🧭 Mapa de Destinos e Justificativas de Alocação

| Origem / Tópico | Destino no Vault | Tipo | Justificativa (Por que e Como foi guardado?) |
| :--- | :--- | :--- | :--- |
${results.map(r => `| **${r.originalName}** | \`📂 ${r.targetFolder}/${r.savedName}\` | \`${r.fileType}\` | ${r.reason} |`).join('\n')}

---

## 📋 Detalhamento dos Itens Criados

${results.map((r, idx) => `
### ${idx + 1}. \`${r.savedName}\`
- **Origem / Identificação:** ${r.originalName}
- **Pasta no Vault:** \`${r.targetFolder}\`
- **Tipo de Conteúdo:** \`${r.fileType}\`
- **Tags:** ${r.tags.join(' ') || 'Nenhuma'}
- **Justificativa da IA:** ${r.reason}
${r.summary ? `- **Resumo do Tópico:** ${r.summary}` : ''}
- **Acesso Direto à Nota:** [[${r.savedName.replace(/\.md$/i, '')}]]
`).join('\n')}

---

> *Relatório gerado automaticamente pela Smart Dropzone & Brain Dump do Tellus.*
`;

    try {
      fs.writeFileSync(reportFullPath, reportMarkdown, 'utf-8');
    } catch (e) {
      console.error('[SmartOrganizer] Failed to write report note:', e);
    }

    return {
      sessionId,
      timestamp: now.getTime(),
      totalFiles: results.length,
      successfulCount,
      failedCount,
      vaultPath: vaultDir,
      reportNotePath: reportRelativePath,
      results
    };
  }

  // Alias for backward compatibility
  public static async organizeFiles(
    files: IncomingDropzoneFile[],
    customVaultDir?: string
  ): Promise<DropzoneOrganizeReport> {
    return this.organize({ files, customVaultDir });
  }
}
