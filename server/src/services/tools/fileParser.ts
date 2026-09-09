import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export interface ParsedAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  relativePath: string;
  previewUrl: string;
  parsedContent?: string;
  isImage: boolean;
  isAudio: boolean;
  isPdf: boolean;
  isCsv: boolean;
}

export class FileParser {
  public static getAttachmentsDir(projectPath: string): string {
    const dir = path.join(projectPath, '.agentic', 'attachments');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static async processUpload(
    projectPath: string,
    filename: string,
    mimeType: string,
    base64Data: string
  ): Promise<ParsedAttachment> {
    const attachmentsDir = this.getAttachmentsDir(projectPath);
    const id = 'att_' + Math.random().toString(36).substring(2, 9);
    const sanitizedFilename = `${id}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(attachmentsDir, sanitizedFilename);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const lowerName = filename.toLowerCase();
    const isImage = mimeType.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(lowerName);
    const isAudio = mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(lowerName);
    const isPdf = mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
    const isCsv = mimeType === 'text/csv' || lowerName.endsWith('.csv');

    let parsedContent = '';

    if (isPdf) {
      try {
        const parseFn = (pdfParse as any).default || pdfParse;
        const data = await parseFn(buffer);
        const rawText = data.text ? data.text.trim() : '';
        const maxLen = 35000;
        let displayText = rawText;
        if (rawText.length > maxLen) {
          displayText = `${rawText.slice(0, maxLen)}\n\n[... Restante do PDF (${data.numpages || 1} págs no total, ${(rawText.length / 1000).toFixed(0)}k caracteres) preservado no arquivo (.agentic/attachments/${sanitizedFilename}). O agente pode ler trechos adicionais com read_file se necessário ...]`;
        }
        parsedContent = `[📄 DOCUMENTO PDF IMPORTADO: ${filename} (${data.numpages || 1} páginas, salvo em .agentic/attachments/${sanitizedFilename})]\n\n${displayText}`;
      } catch (err: any) {
        parsedContent = `[PDF ${filename} importado e salvo em .agentic/attachments/${sanitizedFilename}. Erro na extração direta: ${err.message}]`;
      }
    } else if (isCsv) {
      try {
        const text = buffer.toString('utf-8');
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const headers = lines[0] || '';
        const rowCount = lines.length - 1;
        const sampleRows = lines.slice(0, 15).join('\n');
        parsedContent = `[📊 PLANILHA CSV IMPORTADA: ${filename} (${rowCount} linhas)]\nCabeçalhos: ${headers}\nAmostra dos dados:\n\`\`\`csv\n${sampleRows}\n\`\`\``;
      } catch (err: any) {
        parsedContent = `[CSV ${filename} importado: ${err.message}]`;
      }
    } else if (isImage) {
      parsedContent = `[🖼️ IMAGEM IMPORTADA: ${filename} (Armazenada em .agentic/attachments/${sanitizedFilename})]`;
    } else if (isAudio) {
      parsedContent = `[🎵 ÁUDIO IMPORTADO: ${filename} (Armazenado em .agentic/attachments/${sanitizedFilename})]`;
    } else {
      try {
        const text = buffer.toString('utf-8');
        parsedContent = `[📄 ARQUIVO IMPORTADO: ${filename}]\n\`\`\`\n${text.slice(0, 15000)}\n\`\`\``;
      } catch {
        parsedContent = `[ARQUIVO BINÁRIO IMPORTADO: ${filename}]`;
      }
    }

    const relPath = path.relative(projectPath, filePath).replace(/\\/g, '/');

    return {
      id,
      name: filename,
      type: mimeType,
      size: buffer.length,
      relativePath: relPath,
      previewUrl: `/api/attachments/${sanitizedFilename}`,
      parsedContent,
      isImage,
      isAudio,
      isPdf,
      isCsv
    };
  }
}
