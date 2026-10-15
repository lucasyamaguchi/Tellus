import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { MemoryEngine } from './memoryEngine.js';
import { PrivacySanitizer } from '../security/privacySanitizer.js';

export interface BuildRecord {
  id: string;
  timestamp: number;
  version: string;
  status: 'success' | 'failure';
  durationMs?: number;
  summary: string;
  details?: string;
  commitHash?: string;
}

export interface CommitRecord {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  timestamp: number;
  alteredFiles: string[];
  diffSummary?: string;
}

export interface TestRunCategory {
  name: string;
  passed: number;
  failed: number;
}

export interface TestRunRecord {
  id: string;
  timestamp: number;
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs?: number;
  status: 'passed' | 'failed';
  categories?: TestRunCategory[];
  details?: string;
}

export interface AlterationRecord {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  filesModified: string[];
  category: 'feature' | 'bugfix' | 'refactor' | 'test' | 'config' | 'docs';
  author?: string;
}

export interface PalaceOverview {
  projectName: string;
  projectPath: string;
  activeContext: string;
  latestBuild: BuildRecord | null;
  buildsCount: number;
  recentBuilds: BuildRecord[];
  latestCommit: CommitRecord | null;
  commitsCount: number;
  recentCommits: CommitRecord[];
  latestTestRun: TestRunRecord | null;
  testRunsCount: number;
  recentTestRuns: TestRunRecord[];
  alterationsCount: number;
  recentAlterations: AlterationRecord[];
  decisionsCount: number;
  handoffsCount: number;
  gotchasCount: number;
  lastUpdated: number;
}

export class MemoryPalace {
  public static getPalaceDir(projectPath: string): string {
    return path.join(projectPath, '.agentic', 'palace');
  }

  public static initPalace(projectPath: string): string {
    const palaceDir = this.getPalaceDir(projectPath);
    if (!fs.existsSync(palaceDir)) {
      fs.mkdirSync(palaceDir, { recursive: true });
    }

    const files = [
      { name: 'builds.json', initial: '[]' },
      { name: 'commits.json', initial: '[]' },
      { name: 'test_runs.json', initial: '[]' },
      { name: 'alterations.json', initial: '[]' }
    ];

    for (const f of files) {
      const full = path.join(palaceDir, f.name);
      if (!fs.existsSync(full)) {
        fs.writeFileSync(full, f.initial, 'utf-8');
      }
    }

    return palaceDir;
  }

  // Helper to read JSON array safely
  private static readJsonFile<T>(filePath: string): T[] {
    try {
      if (!fs.existsSync(filePath)) return [];
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Helper to write JSON safely
  private static writeJsonFile<T>(filePath: string, data: T[]): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // 1. BUILDS CHRONOLOGY
  public static recordBuild(
    projectPath: string, 
    data: Omit<BuildRecord, 'id' | 'timestamp'> & { timestamp?: number }
  ): BuildRecord {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'builds.json');
    const existing = this.readJsonFile<BuildRecord>(filePath);

    const record: BuildRecord = {
      id: 'build_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: data.timestamp || Date.now(),
      version: data.version || '1.0.0',
      status: data.status,
      durationMs: data.durationMs || 0,
      summary: PrivacySanitizer.sanitizeText(data.summary).sanitized,
      details: data.details ? PrivacySanitizer.sanitizeText(data.details).sanitized : undefined,
      commitHash: data.commitHash
    };

    const updated = [record, ...existing.filter(b => b.id !== record.id)];
    this.writeJsonFile(filePath, updated);
    return record;
  }

  public static listBuilds(projectPath: string): BuildRecord[] {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'builds.json');
    const list = this.readJsonFile<BuildRecord>(filePath);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public static getBuildById(projectPath: string, buildId: string): BuildRecord | null {
    const list = this.listBuilds(projectPath);
    return list.find(b => b.id === buildId) || null;
  }

  // 2. COMMITS & REPO ALTERATIONS CHRONOLOGY
  public static recordCommit(
    projectPath: string, 
    data: Omit<CommitRecord, 'timestamp'> & { timestamp?: number }
  ): CommitRecord {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'commits.json');
    const existing = this.readJsonFile<CommitRecord>(filePath);

    const record: CommitRecord = {
      hash: data.hash,
      shortHash: data.shortHash || data.hash.slice(0, 7),
      message: PrivacySanitizer.sanitizeText(data.message).sanitized,
      author: data.author || 'Tellus Agent',
      timestamp: data.timestamp || Date.now(),
      alteredFiles: data.alteredFiles || [],
      diffSummary: data.diffSummary ? PrivacySanitizer.sanitizeText(data.diffSummary).sanitized : undefined
    };

    // Upsert: replace if hash already exists
    const withoutCurrent = existing.filter(c => c.hash !== record.hash && c.shortHash !== record.shortHash);
    const updated = [record, ...withoutCurrent];
    this.writeJsonFile(filePath, updated);
    return record;
  }

  public static listCommits(projectPath: string): CommitRecord[] {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'commits.json');
    const list = this.readJsonFile<CommitRecord>(filePath);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Automatically sync with git log if the project is a Git repository
  public static syncGitHistory(projectPath: string, maxCommits = 15): CommitRecord[] {
    this.initPalace(projectPath);
    const gitDir = path.join(projectPath, '.git');
    if (!fs.existsSync(gitDir)) {
      return this.listCommits(projectPath);
    }

    try {
      const gitLogCmd = `git log -n ${maxCommits} --pretty=format:"%H|%h|%an|%at|%s"`;
      const stdout = execSync(gitLogCmd, { cwd: projectPath, encoding: 'utf-8', timeout: 5000 });
      const lines = stdout.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 5) {
          const [hash, shortHash, author, timestampStr, ...msgParts] = parts;
          const message = msgParts.join('|');
          const timestamp = parseInt(timestampStr, 10) * 1000 || Date.now();

          let alteredFiles: string[] = [];
          try {
            const filesOut = execSync(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
              cwd: projectPath,
              encoding: 'utf-8',
              timeout: 3000
            });
            alteredFiles = filesOut.trim().split('\n').filter(Boolean);
          } catch {}

          this.recordCommit(projectPath, {
            hash,
            shortHash,
            author,
            timestamp,
            message,
            alteredFiles
          });
        }
      }
    } catch {
      // Git not installed or command failed; harmless fallback to existing recorded commits
    }

    return this.listCommits(projectPath);
  }

  // 3. AUTOMATED TEST SUITES CHRONOLOGY & AUDITING
  public static recordTestRun(
    projectPath: string,
    data: Omit<TestRunRecord, 'id' | 'timestamp'> & { timestamp?: number }
  ): TestRunRecord {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'test_runs.json');
    const existing = this.readJsonFile<TestRunRecord>(filePath);

    const record: TestRunRecord = {
      id: 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: data.timestamp || Date.now(),
      suiteName: data.suiteName,
      totalTests: data.totalTests,
      passed: data.passed,
      failed: data.failed,
      durationMs: data.durationMs || 0,
      status: data.status,
      categories: data.categories || [],
      details: data.details ? PrivacySanitizer.sanitizeText(data.details).sanitized : undefined
    };

    const updated = [record, ...existing.filter(t => t.id !== record.id)];
    this.writeJsonFile(filePath, updated);
    return record;
  }

  public static listTestRuns(projectPath: string): TestRunRecord[] {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'test_runs.json');
    const list = this.readJsonFile<TestRunRecord>(filePath);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  // 4. DETAILED ALTERATIONS & CHANGELOG TRACKING
  public static recordAlteration(
    projectPath: string,
    data: Omit<AlterationRecord, 'id' | 'timestamp'> & { timestamp?: number }
  ): AlterationRecord {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'alterations.json');
    const existing = this.readJsonFile<AlterationRecord>(filePath);

    const record: AlterationRecord = {
      id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: data.timestamp || Date.now(),
      title: PrivacySanitizer.sanitizeText(data.title).sanitized,
      description: PrivacySanitizer.sanitizeText(data.description).sanitized,
      filesModified: data.filesModified || [],
      category: data.category,
      author: data.author || 'Tellus Agent'
    };

    const updated = [record, ...existing.filter(a => a.id !== record.id)];
    this.writeJsonFile(filePath, updated);
    return record;
  }

  public static listAlterations(projectPath: string): AlterationRecord[] {
    this.initPalace(projectPath);
    const filePath = path.join(this.getPalaceDir(projectPath), 'alterations.json');
    const list = this.readJsonFile<AlterationRecord>(filePath);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  // 5. UNIFIED PALACE OVERVIEW AGGREGATION
  public static getPalaceOverview(projectPath: string): PalaceOverview {
    this.initPalace(projectPath);
    const builds = this.listBuilds(projectPath);
    const commits = this.listCommits(projectPath);
    const testRuns = this.listTestRuns(projectPath);
    const alterations = this.listAlterations(projectPath);
    const memoryPages = MemoryEngine.listMemoryPages(projectPath);
    const activeContext = MemoryEngine.getActiveContext(projectPath);

    const decisionsCount = memoryPages.filter(p => p.category === 'decisions').length;
    const handoffsCount = memoryPages.filter(p => p.category === 'handoffs').length;
    const gotchasCount = memoryPages.filter(p => p.category === 'gotchas').length;

    return {
      projectName: path.basename(projectPath),
      projectPath,
      activeContext,
      latestBuild: builds[0] || null,
      buildsCount: builds.length,
      recentBuilds: builds.slice(0, 5),
      latestCommit: commits[0] || null,
      commitsCount: commits.length,
      recentCommits: commits.slice(0, 8),
      latestTestRun: testRuns[0] || null,
      testRunsCount: testRuns.length,
      recentTestRuns: testRuns.slice(0, 5),
      alterationsCount: alterations.length,
      recentAlterations: alterations.slice(0, 6),
      decisionsCount,
      handoffsCount,
      gotchasCount,
      lastUpdated: Date.now()
    };
  }

  // 6. EXPORT COMPREHENSIVE PALACE MARKDOWN REPORT
  public static exportPalaceMarkdown(projectPath: string): string {
    const overview = this.getPalaceOverview(projectPath);
    const memoryPages = MemoryEngine.listMemoryPages(projectPath);
    const decisions = memoryPages.filter(p => p.category === 'decisions');
    const gotchas = memoryPages.filter(p => p.category === 'gotchas');
    const handoffs = memoryPages.filter(p => p.category === 'handoffs');

    let md = `# 🏛️ Palácio de Memória: ${overview.projectName}\n\n`;
    md += `> **Caminho**: \`${overview.projectPath}\`  \n`;
    md += `> **Atualizado em**: ${new Date(overview.lastUpdated).toLocaleString()}  \n`;
    md += `> **Resumo de Integridade**: ${overview.buildsCount} builds gravadas, ${overview.commitsCount} commits rastreados, ${overview.testRunsCount} execuções de testes, ${overview.decisionsCount} decisões de arquitetura mantidas.\n\n`;

    md += `## 🎯 1. Active Context & Estado Atual\n\n`;
    md += overview.activeContext ? overview.activeContext : '_Nenhum contexto ativo registrado._';
    md += `\n\n---\n\n`;

    md += `## 🚀 2. Histórico de Builds & Estabilidade\n\n`;
    if (overview.recentBuilds.length === 0) {
      md += `_Nenhum build registrado ainda._\n\n`;
    } else {
      md += `| Data/Hora | Versão | Status | Duração | Resumo |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      for (const b of overview.recentBuilds) {
        const time = new Date(b.timestamp).toLocaleString();
        const statusBadge = b.status === 'success' ? '✅ Sucesso' : '❌ Falha';
        md += `| ${time} | \`${b.version}\` | ${statusBadge} | ${b.durationMs ? `${b.durationMs}ms` : '-'} | ${b.summary} |\n`;
      }
      md += `\n`;
    }

    md += `## 📜 3. Histórico de Commits & Modificações\n\n`;
    if (overview.recentCommits.length === 0) {
      md += `_Nenhum commit registrado ainda._\n\n`;
    } else {
      md += `| Hash | Autor | Data/Hora | Mensagem | Arquivos Alterados |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      for (const c of overview.recentCommits) {
        const time = new Date(c.timestamp).toLocaleString();
        const filesCount = c.alteredFiles.length > 0 ? `${c.alteredFiles.length} arquivo(s)` : '-';
        md += `| \`${c.shortHash}\` | ${c.author} | ${time} | ${c.message} | ${filesCount} |\n`;
      }
      md += `\n`;
    }

    md += `## 🧪 4. Suites de Testes Automatizados\n\n`;
    if (overview.recentTestRuns.length === 0) {
      md += `_Nenhuma execução de testes registrada no palácio._\n\n`;
    } else {
      md += `| Data/Hora | Suite | Status | Passou / Total | Duração |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      for (const t of overview.recentTestRuns) {
        const time = new Date(t.timestamp).toLocaleString();
        const statusBadge = t.status === 'passed' ? '✅ Passou' : '❌ Falhou';
        md += `| ${time} | ${t.suiteName} | ${statusBadge} | ${t.passed}/${t.totalTests} | ${t.durationMs ? `${t.durationMs}ms` : '-'} |\n`;
      }
      md += `\n`;
    }

    md += `## 💡 5. Decisões Arquiteturais Gravadas (${decisions.length})\n\n`;
    if (decisions.length === 0) {
      md += `_Nenhuma decisão gravada ainda._\n\n`;
    } else {
      for (const d of decisions) {
        md += `### 📌 ${d.title}\n`;
        md += `${d.content}\n\n`;
      }
    }

    md += `## ⚠️ 6. Gotchas & Armadilhas Superadas (${gotchas.length})\n\n`;
    if (gotchas.length === 0) {
      md += `_Nenhum gotcha registrado._\n\n`;
    } else {
      for (const g of gotchas) {
        md += `### 🛡️ ${g.title}\n`;
        md += `${g.content}\n\n`;
      }
    }

    md += `## 🤝 7. Handoffs de Modelos (${handoffs.length})\n\n`;
    if (handoffs.length === 0) {
      md += `_Nenhum handoff gravado._\n\n`;
    } else {
      for (const h of handoffs.slice(0, 3)) {
        md += `### 🔄 ${h.title}\n`;
        md += `${h.content}\n\n`;
      }
    }

    return md;
  }
}
