import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MemoryPalace, BuildRecord, CommitRecord, TestRunRecord, AlterationRecord } from '../../src/services/memory/memoryPalace.js';
import { MemoryEngine } from '../../src/services/memory/memoryEngine.js';

describe('🏛️ Módulo 2: Palácio de Memória & Contexto Contínuo', () => {
  let tempProjectDir: string;

  before(() => {
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_palace_test_'));
  });

  after(() => {
    try {
      if (fs.existsSync(tempProjectDir)) {
        fs.rmSync(tempProjectDir, { recursive: true, force: true });
      }
    } catch {}
  });

  test('1. Inicialização e isolamento do Palácio em .agentic/palace/', () => {
    const palaceDir = MemoryPalace.initPalace(tempProjectDir);
    assert.ok(fs.existsSync(palaceDir), 'Diretório do palácio deve existir');
    assert.ok(fs.existsSync(path.join(palaceDir, 'builds.json')), 'builds.json deve existir');
    assert.ok(fs.existsSync(path.join(palaceDir, 'commits.json')), 'commits.json deve existir');
    assert.ok(fs.existsSync(path.join(palaceDir, 'test_runs.json')), 'test_runs.json deve existir');
    assert.ok(fs.existsSync(path.join(palaceDir, 'alterations.json')), 'alterations.json deve existir');
  });

  test('2. Gravação e consulta cronológica de Builds', () => {
    const b1 = MemoryPalace.recordBuild(tempProjectDir, {
      version: '1.0.0-rc1',
      status: 'success',
      durationMs: 4200,
      summary: 'Build de produção compilada com sucesso'
    });

    assert.ok(b1.id.startsWith('build_'));
    assert.equal(b1.version, '1.0.0-rc1');
    assert.equal(b1.status, 'success');

    const b2 = MemoryPalace.recordBuild(tempProjectDir, {
      version: '1.0.0-rc2',
      status: 'failure',
      durationMs: 1500,
      summary: 'Falha na compilação do bundle'
    });

    const builds = MemoryPalace.listBuilds(tempProjectDir);
    assert.equal(builds.length, 2);
    assert.equal(builds[0].id, b2.id, 'Build mais recente deve vir primeiro');
    assert.equal(builds[1].id, b1.id);

    const retrieved = MemoryPalace.getBuildById(tempProjectDir, b1.id);
    assert.ok(retrieved);
    assert.equal(retrieved?.summary, 'Build de produção compilada com sucesso');
  });

  test('3. Gravação e rastreamento de Commits & Alterações', () => {
    const c1 = MemoryPalace.recordCommit(tempProjectDir, {
      hash: 'a1b2c3d4e5f67890123456789abcdef012345678',
      shortHash: 'a1b2c3d',
      message: 'feat(palace): adicionar palácio de memória',
      author: 'Lucas',
      alteredFiles: ['server/src/services/memory/memoryPalace.ts']
    });

    assert.equal(c1.shortHash, 'a1b2c3d');
    assert.equal(c1.alteredFiles.length, 1);

    const commits = MemoryPalace.listCommits(tempProjectDir);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].message, 'feat(palace): adicionar palácio de memória');

    // Grava alteração de código
    const alt = MemoryPalace.recordAlteration(tempProjectDir, {
      title: 'Atualização do Palácio de Memória',
      description: 'Implementado rastreador de builds e testes',
      category: 'feature',
      filesModified: ['server/src/services/memory/memoryPalace.ts']
    });

    assert.ok(alt.id.startsWith('alt_'));
    const alts = MemoryPalace.listAlterations(tempProjectDir);
    assert.equal(alts.length, 1);
    assert.equal(alts[0].category, 'feature');
  });

  test('4. Gravação e auditoria de Test Runs (Histórico de Confiabilidade)', () => {
    const tr = MemoryPalace.recordTestRun(tempProjectDir, {
      suiteName: 'Suite de Testes de Produção',
      totalTests: 25,
      passed: 25,
      failed: 0,
      durationMs: 950,
      status: 'passed',
      categories: [
        { name: 'TelluNote Vault', passed: 10, failed: 0 },
        { name: 'Memory Palace', passed: 5, failed: 0 },
        { name: 'Voice Vocabulary', passed: 10, failed: 0 }
      ]
    });

    assert.ok(tr.id.startsWith('test_'));
    assert.equal(tr.status, 'passed');
    assert.equal(tr.passed, 25);

    const runs = MemoryPalace.listTestRuns(tempProjectDir);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].suiteName, 'Suite de Testes de Produção');
  });

  test('5. Integração com ActiveContext, Decisões e Handoffs do MemoryEngine', () => {
    MemoryEngine.updateActiveContext(tempProjectDir, '# 🎯 Contexto Ativo de Teste\nTrabalhando na refatoração');
    const ctx = MemoryEngine.getActiveContext(tempProjectDir);
    assert.ok(ctx.includes('Contexto Ativo de Teste'));

    // Grava decisão arquitetural
    MemoryEngine.writeMemoryPage(
      tempProjectDir,
      'decisions',
      'decisao_palacio.md',
      'Adoção do Palácio de Memória',
      'Decidido persistir histórico de builds e commits em .agentic/palace/'
    );

    const pages = MemoryEngine.listMemoryPages(tempProjectDir);
    const decision = pages.find(p => p.filename === 'decisao_palacio.md');
    assert.ok(decision);
    assert.equal(decision?.title, 'Adoção do Palácio de Memória');
  });

  test('6. Visão Geral Consolidada do Palácio (PalaceOverview)', () => {
    const overview = MemoryPalace.getPalaceOverview(tempProjectDir);
    assert.equal(overview.buildsCount, 2);
    assert.equal(overview.commitsCount, 1);
    assert.equal(overview.testRunsCount, 1);
    assert.equal(overview.alterationsCount, 1);
    assert.ok(overview.activeContext.includes('Contexto Ativo'));
    assert.ok(overview.latestBuild);
    assert.ok(overview.latestCommit);
    assert.ok(overview.latestTestRun);
  });

  test('7. Exportação Completa do Palácio de Memória em Markdown', () => {
    const markdown = MemoryPalace.exportPalaceMarkdown(tempProjectDir);
    assert.ok(markdown.includes('# 🏛️ Palácio de Memória'));
    assert.ok(markdown.includes('Histórico de Builds'));
    assert.ok(markdown.includes('Histórico de Commits'));
    assert.ok(markdown.includes('Suites de Testes Automatizados'));
    assert.ok(markdown.includes('Decisões Arquiteturais Gravadas'));
  });
});
