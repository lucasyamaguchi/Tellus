import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { ProviderHub } from '../providers/providerHub.js';
import { ConfigManager } from '../configManager.js';
import { FrankNoteEngine } from './frankNoteEngine.js';

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
  fileType: 'pdf' | 'image' | 'text' | 'code' | 'spreadsheet' | 'other';
  size: number;
  reason: string;
  summary: string;
  tags: string[];
  success: boolean;
  error?: string;
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

export class SmartOrganizer {
  private static getVaultDir(): string {
    if (!fs.existsSync(OBSIDIAN_VAULT_DIR)) {
      try {
        fs.mkdirSync(OBSIDIAN_VAULT_DIR, { recursive: true });
      } catch {
        return path.resolve('./Vault');
      }
    }
    return OBSIDIAN_VAULT_DIR;
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
    const isText = file.type.startsWith('text/') || /\.(txt|md|markdown|rtf|log)$/i.test(lowerName);

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
        const preview = str.slice(0, 3500).replace(/\r/g, '');
        return {
          excerpt: preview,
          detectedType: isSpreadsheet ? 'spreadsheet' : (isCode ? 'code' : 'text')
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

  public static async organizeFiles(
    files: IncomingDropzoneFile[],
    customVaultDir?: string
  ): Promise<DropzoneOrganizeReport> {
    const vaultDir = customVaultDir && fs.existsSync(customVaultDir) ? customVaultDir : this.getVaultDir();
    const existingFolders = this.listExistingFolders(vaultDir);
    const sessionId = 'drop_' + Date.now().toString(36);
    const results: OrganizedFileResult[] = [];

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

    const config = ConfigManager.getConfig();
    const activeModel = config.defaultModel || 'deepseek/deepseek-chat';
    const activeProvider = config.defaultProvider || 'openrouter';

    const fileDescriptions = preparedFiles.map((pf, idx) => {
      return `### Arquivo ${idx + 1}:
- Nome Original: "${pf.file.name}"
- Tamanho: ${(pf.file.size / 1024).toFixed(1)} KB
- Tipo Detectado: ${pf.detectedType}
- Conteúdo / Amostra:
${pf.excerpt.slice(0, 800)}
`;
    }).join('\n---\n');

    const prompt = `Você é o Arquivista e Curador Inteligente do Tellus.
Sua missão é classificar e organizar arquivos recém-inseridos na Dropzone dentro do Vault de notas e conhecimento do usuário.

PASTAS EXISTENTES NO VAULT:
${existingFolders.map(f => '- ' + f).join('\n')}

DIRETRIZES DE ORGANIZAÇÃO:
1. Priorize alocar nas pastas existentes se houver afinidade temática evidente (ex: arquivos de TI/código em "Estudos/...", imagens em "Imagens/...", documentos em "Documentos/...").
2. Se o tema for novo e relevante, você pode sugerir uma nova subpasta lógica (ex: "Estudos/Python", "Carreira/Curriculos", "Imagens/Diagramas").
3. Nunca invente caminhos estranhos ou caracteres proibidos no Windows (<>:"|?*). Use '/' para separar subpastas.
4. Para CADA arquivo, você DEVE explicar com clareza em 1 ou 2 frases em Português: "Por que ele foi colocado nessa pasta específica e qual o contexto detectado".
5. Forneça tags (#tag) coerentes para facilitar indexação.

ARQUIVOS A ORGANIZAR:
${fileDescriptions}

RESPONDA EXCLUSIVAMENTE COM UM ARRAY JSON VÁLIDO no seguinte formato (sem markdown em volta se possível, ou com \`\`\`json):
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

    let llmResponseText = '';
    try {
      await ProviderHub.streamChat(
        activeProvider,
        activeModel,
        [
          { role: 'system', content: 'Você é um organizador e arquivista de arquivos de alta precisão. Responda em JSON rigoroso.' },
          { role: 'user', content: prompt }
        ],
        [],
        {
          onContentChunk: (chunk) => { llmResponseText += chunk; },
          onReasoningChunk: () => {},
          onToolCalls: () => {}
        }
      );
    } catch (err: any) {
      console.warn('[SmartOrganizer] LLM call failed or offline, using contextual heuristic fallback:', err.message);
    }

    let parsedDecisions: Array<{
      index: number;
      targetFolder: string;
      cleanedFilename: string;
      reason: string;
      summary: string;
      tags: string[];
    }> = [];

    try {
      const jsonMatch = llmResponseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        parsedDecisions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[SmartOrganizer] Failed to parse LLM JSON:', e);
    }

    for (let i = 0; i < preparedFiles.length; i++) {
      const pf = preparedFiles[i];
      const decision = parsedDecisions.find(d => d.index === (i + 1)) || parsedDecisions[i];

      let targetFolder = decision?.targetFolder ? FrankNoteEngine.sanitizePath(decision.targetFolder) : '';
      let cleanedFilename = decision?.cleanedFilename ? FrankNoteEngine.sanitizeName(decision.cleanedFilename) : '';
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
        cleanedFilename = FrankNoteEngine.sanitizeName(pf.file.name);
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
          id: `org_${i}_${Date.now()}`,
          originalName: pf.file.name,
          savedName: cleanedFilename,
          targetFolder,
          fullRelativePath: relativePath,
          fileType: pf.detectedType,
          size: pf.file.size,
          reason,
          summary,
          tags,
          success: true
        });
      } catch (err: any) {
        results.push({
          id: `org_err_${i}`,
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

    const reportMarkdown = `# 📑 Relatório de Organização Automática da Dropzone

**Data:** ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}
**Arquivos Processados:** ${results.length} (${successfulCount} alocados com sucesso, ${failedCount} erros)
**Modelo Responsável:** \`${activeModel}\`

---

## Arquivos e Justificativas de Alocação

| Arquivo Original | Destino no Vault | Motivo da Alocação (Por que foi colocado aqui?) |
| :--- | :--- | :--- |
${results.map(r => `| **${r.originalName}** | \`📂 ${r.targetFolder}/${r.savedName}\` | ${r.reason} |`).join('\n')}

---

## Detalhamento dos Itens Organizados

${results.map((r, idx) => `
### ${idx + 1}. \`${r.savedName}\`
- **Arquivo de Origem:** \`${r.originalName}\`
- **Pasta de Destino:** \`${r.targetFolder}\`
- **Tamanho:** ${(r.size / 1024).toFixed(1)} KB
- **Tags:** ${r.tags.join(' ') || 'Nenhuma'}
- **Justificativa da IA:** ${r.reason}
${r.summary ? `- **Resumo do Conteúdo:** ${r.summary}` : ''}
- **Acesso Direto:** [[${r.savedName}]]
`).join('\n')}

> *Relatório gerado automaticamente pela Smart Dropzone do Tellus.*
`;

    try {
      fs.writeFileSync(reportFullPath, reportMarkdown, 'utf-8');
    } catch (e) {
      console.error('[SmartOrganizer] Failed to write report note:', e);
    }

    return {
      sessionId,
      timestamp: now.getTime(),
      totalFiles: files.length,
      successfulCount,
      failedCount,
      vaultPath: vaultDir,
      reportNotePath: reportRelativePath,
      results
    };
  }
}
