import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { FileTools } from './fileTools.js';

export class WebScraper {
  public static async scrapeUrl(
    projectPath: string,
    url: string,
    exportPath?: string,
    format: 'markdown' | 'text' | 'html' | 'json' = 'markdown'
  ): Promise<{ url: string; title: string; length: number; exportedFile?: string; content: string }> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });

    const html: string = response.data;
    
    // Simple HTML to readable text / markdown extraction
    let title = 'Sem título';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    let outputContent = '';

    if (format === 'html') {
      outputContent = cleaned;
    } else {
      // Basic markdown conversion
      let md = cleaned
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
        .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

      outputContent = `# ${title}\n**URL de Origem**: ${url}\n**Data de Coleta**: ${new Date().toISOString()}\n\n---\n\n${md}`;
    }

    let exportedFile: string | undefined = undefined;
    if (exportPath) {
      const ext = format === 'html' ? '.html' : format === 'json' ? '.json' : '.md';
      const targetFile = exportPath.endsWith(ext) ? exportPath : `${exportPath}${ext}`;
      FileTools.writeFile(projectPath, targetFile, outputContent);
      exportedFile = targetFile;
    }

    return {
      url,
      title,
      length: outputContent.length,
      exportedFile,
      content: outputContent.slice(0, 10000)
    };
  }
}
