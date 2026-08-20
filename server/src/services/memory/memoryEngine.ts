import fs from 'fs';
import path from 'path';

export interface MemoryPage {
  category: 'decisions' | 'procedures' | 'gotchas' | 'handoffs' | 'general';
  filename: string;
  title: string;
  content: string;
  tags?: string[];
  lastModified: number;
}

export interface MemorySearchResult {
  page: MemoryPage;
  score: number;
  matchedSnippets: string[];
}

export interface HandoffPacket {
  id: string;
  timestamp: string;
  fromModel?: string;
  toModel?: string;
  currentObjective: string;
  completedTasks: string[];
  activeDecisions: string[];
  openIssues: string[];
  immediateNextSteps: string[];
  summary: string;
}

export class MemoryEngine {
  public static getMemoryDir(projectPath: string): string {
    return path.join(projectPath, '.agentic', 'memory');
  }

  public static initProjectMemory(projectPath: string) {
    const memoryDir = this.getMemoryDir(projectPath);
    const subdirs = ['decisions', 'procedures', 'gotchas', 'handoffs'];

    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    for (const sub of subdirs) {
      const subPath = path.join(memoryDir, sub);
      if (!fs.existsSync(subPath)) {
        fs.mkdirSync(subPath, { recursive: true });
      }
    }

    const activeContextPath = path.join(memoryDir, 'active_context.md');
    if (!fs.existsSync(activeContextPath)) {
      const initialActiveContext = `# 🎯 Active Context & Estado do Projeto

## 📌 Objetivo Atual
- Inicialização do projeto e configuração do ambiente de desenvolvimento.

## 📂 Arquivos em Foco
- Nenhum arquivo ativo no momento.

## 🚀 Progresso Recente
- [x] Repositório inicializado e memória de longo prazo configurada.

## ⚡ Próximos Passos Imediatos
- Definir escopo da tarefa inicial com o agente.
- Mapear dependências e requisitos de código.

## ❓ Questões em Aberto e Restrições
- Nenhuma restrição crítica no momento.
`;
      fs.writeFileSync(activeContextPath, initialActiveContext, 'utf-8');
    }
  }

  public static getActiveContext(projectPath: string): string {
    this.initProjectMemory(projectPath);
    const activeContextPath = path.join(this.getMemoryDir(projectPath), 'active_context.md');
    try {
      return fs.readFileSync(activeContextPath, 'utf-8');
    } catch {
      return '';
    }
  }

  public static updateActiveContext(projectPath: string, content: string): void {
    this.initProjectMemory(projectPath);
    const activeContextPath = path.join(this.getMemoryDir(projectPath), 'active_context.md');
    fs.writeFileSync(activeContextPath, content, 'utf-8');
  }

  public static listMemoryPages(projectPath: string): MemoryPage[] {
    this.initProjectMemory(projectPath);
    const memoryDir = this.getMemoryDir(projectPath);
    const categories: Array<'decisions' | 'procedures' | 'gotchas' | 'handoffs'> = [
      'decisions',
      'procedures',
      'gotchas',
      'handoffs'
    ];
    const pages: MemoryPage[] = [];

    for (const cat of categories) {
      const catDir = path.join(memoryDir, cat);
      if (!fs.existsSync(catDir)) continue;

      const files = fs.readdirSync(catDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(catDir, file);
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const firstLine = content.split('\n')[0] || file;
        const title = firstLine.replace(/^#+\s*/, '').trim();

        pages.push({
          category: cat,
          filename: file,
          title: title || file,
          content,
          lastModified: stat.mtimeMs
        });
      }
    }

    return pages.sort((a, b) => b.lastModified - a.lastModified);
  }

  public static writeMemoryPage(
    projectPath: string,
    category: 'decisions' | 'procedures' | 'gotchas' | 'handoffs',
    filename: string,
    title: string,
    content: string,
    tags?: string[]
  ): MemoryPage {
    this.initProjectMemory(projectPath);
    const sanitizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    const catDir = path.join(this.getMemoryDir(projectPath), category);
    const filePath = path.join(catDir, sanitizedFilename);

    let fullBody = content;
    if (!content.trim().startsWith('#')) {
      fullBody = `# ${title}\n\n${content}`;
    }

    if (tags && tags.length > 0) {
      fullBody = `<!-- tags: ${tags.join(', ')} -->\n${fullBody}`;
    }

    fs.writeFileSync(filePath, fullBody, 'utf-8');
    const stat = fs.statSync(filePath);

    return {
      category,
      filename: sanitizedFilename,
      title,
      content: fullBody,
      tags,
      lastModified: stat.mtimeMs
    };
  }

  public static queryMemory(projectPath: string, query: string): MemorySearchResult[] {
    const pages = this.listMemoryPages(projectPath);
    if (!query || query.trim() === '') {
      return pages.map(p => ({ page: p, score: 1, matchedSnippets: [] }));
    }

    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const results: MemorySearchResult[] = [];

    for (const page of pages) {
      const lowerContent = page.content.toLowerCase();
      const lowerTitle = page.title.toLowerCase();
      let matchCount = 0;
      const matchedSnippets: string[] = [];

      for (const token of queryTokens) {
        if (lowerTitle.includes(token)) matchCount += 3;
        if (lowerContent.includes(token)) matchCount += 1;
      }

      if (matchCount > 0) {
        const lines = page.content.split('\n');
        for (const line of lines) {
          if (queryTokens.some(tok => line.toLowerCase().includes(tok))) {
            matchedSnippets.push(line.trim());
            if (matchedSnippets.length >= 3) break;
          }
        }

        results.push({
          page,
          score: matchCount,
          matchedSnippets
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  public static createHandoff(
    projectPath: string,
    fromModel: string,
    summary: string,
    immediateNextSteps: string[] = [],
    openQuestions: string[] = []
  ): MemoryPage {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `handoff-${timestamp}.md`;
    const title = `Handoff Snapshot - ${new Date().toLocaleString()}`;

    const content = `# ${title}
**Origem / Modelo**: \`${fromModel}\`
**Data**: ${new Date().toISOString()}

## 📋 Resumo do Estado
${summary}

## ⚡ Próximos Passos Recomendados
${immediateNextSteps.length > 0 ? immediateNextSteps.map(s => `- [ ] ${s}`).join('\n') : '- Continuar a execução conforme active_context.md'}

## ❓ Questões em Aberto
${openQuestions.length > 0 ? openQuestions.map(q => `- ${q}`).join('\n') : '- Nenhuma questão pendente registrada.'}
`;

    return this.writeMemoryPage(projectPath, 'handoffs', filename, title, content, ['handoff', fromModel]);
  }

  public static buildContextPrompt(projectPath: string, activeRoutineName?: string): string {
    const activeContext = this.getActiveContext(projectPath);
    const pages = this.listMemoryPages(projectPath);

    const decisions = pages.filter(p => p.category === 'decisions').slice(0, 5);
    const gotchas = pages.filter(p => p.category === 'gotchas').slice(0, 5);
    const latestHandoff = pages.filter(p => p.category === 'handoffs')[0];

    let memoryInjection = `\n\n=== 🧠 MEMÓRIA CONTÍNUA DO PROJETO (ai-memory system) ===\n`;
    memoryInjection += `[ACTIVE CONTEXT - ESTADO ATUAL]:\n${activeContext}\n\n`;

    if (latestHandoff) {
      memoryInjection += `[ÚLTIMO HANDOFF / ONDE PAROU O AGENTE ANTERIOR]:\n${latestHandoff.content}\n\n`;
    }

    if (decisions.length > 0) {
      memoryInjection += `[DECISÕES ARQUITETURAIS RELEVANTES]:\n`;
      for (const d of decisions) {
        memoryInjection += `- **${d.title}**: ${d.content.slice(0, 300)}...\n`;
      }
      memoryInjection += `\n`;
    }

    if (gotchas.length > 0) {
      memoryInjection += `[ARMADILHAS E GOTCHAS CONHECIDOS]:\n`;
      for (const g of gotchas) {
        memoryInjection += `- **${g.title}**: ${g.content.slice(0, 300)}...\n`;
      }
      memoryInjection += `\n`;
    }

    memoryInjection += `INSTRUÇÃO DE MEMÓRIA:
1. Mantenha sempre a continuidade com o Active Context acima.
2. Quando tomar uma decisão arquitetural crucial, chame a ferramenta 'memory_write_page' (category: 'decisions').
3. Quando resolver um erro complexo ou descobrir uma restrição importante, registre com 'memory_write_page' (category: 'gotchas').
4. Se o objetivo avançar significativamente, atualize o 'active_context.md' chamando 'memory_update_context'.
5. Ao concluir ou pausar uma grande etapa para troca de modelo, registre um resumo com 'memory_create_handoff'.\n`;

    return memoryInjection;
  }
}
