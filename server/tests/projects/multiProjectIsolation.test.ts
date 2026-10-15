import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TelluNoteEngine } from '../../src/services/notes/telluNoteEngine.js';
import { MemoryPalace } from '../../src/services/memory/memoryPalace.js';
import { SessionManager } from '../../src/services/sessionManager.js';
import { MemoryEngine } from '../../src/services/memory/memoryEngine.js';

describe('🏢 Classificação por Projetos: Isolamento Estrito & Palácio de Memória Exclusivo', () => {
  let projectX: string;
  let projectY: string;

  before(() => {
    projectX = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_proj_x_'));
    projectY = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_proj_y_'));
  });

  after(() => {
    try {
      if (fs.existsSync(projectX)) fs.rmSync(projectX, { recursive: true, force: true });
      if (fs.existsSync(projectY)) fs.rmSync(projectY, { recursive: true, force: true });
    } catch {}
  });

  test('1. Isolamento de Páginas de Memória e Decisões (.agentic/memory/)', () => {
    // Cria página de decisão no Projeto X
    MemoryEngine.writeMemoryPage(
      projectX,
      'decisions',
      'decisao_proj_x.md',
      'Decisão Arquitetural do Projeto X',
      'Especificações técnicas exclusivas do Projeto X.'
    );

    // Cria página de decisão no Projeto Y
    MemoryEngine.writeMemoryPage(
      projectY,
      'decisions',
      'decisao_proj_y.md',
      'Decisão Arquitetural do Projeto Y',
      'Especificações visuais exclusivas do Projeto Y.'
    );

    const pagesX = MemoryEngine.listMemoryPages(projectX);
    const pagesY = MemoryEngine.listMemoryPages(projectY);

    assert.ok(pagesX.some(p => p.filename === 'decisao_proj_x.md'), 'Projeto X deve conter sua decisão');
    assert.ok(!pagesX.some(p => p.filename === 'decisao_proj_y.md'), 'Projeto X NÃO deve conter a decisão do Projeto Y');

    assert.ok(pagesY.some(p => p.filename === 'decisao_proj_y.md'), 'Projeto Y deve conter sua decisão');
    assert.ok(!pagesY.some(p => p.filename === 'decisao_proj_x.md'), 'Projeto Y NÃO deve conter a decisão do Projeto X');
  });

  test('2. Isolamento do Palácio de Memória (Builds & Commits Exclusivos por Projeto)', () => {
    // Registra build no Projeto X
    MemoryPalace.recordBuild(projectX, {
      version: 'x-v1.0.0',
      status: 'success',
      durationMs: 3100,
      summary: 'Build do microserviço X'
    });

    // Registra build no Projeto Y
    MemoryPalace.recordBuild(projectY, {
      version: 'y-v2.0.0',
      status: 'failure',
      durationMs: 1200,
      summary: 'Falha no webpack do Projeto Y'
    });

    const buildsX = MemoryPalace.listBuilds(projectX);
    const buildsY = MemoryPalace.listBuilds(projectY);

    assert.equal(buildsX.length, 1);
    assert.equal(buildsX[0].version, 'x-v1.0.0');

    assert.equal(buildsY.length, 1);
    assert.equal(buildsY[0].version, 'y-v2.0.0');

    // Registra commit no Projeto X
    MemoryPalace.recordCommit(projectX, {
      hash: '1111111111111111111111111111111111111111',
      shortHash: '1111111',
      message: 'feat(x): primeira funcionalidade',
      author: 'DevX',
      alteredFiles: ['src/x.ts']
    });

    const commitsX = MemoryPalace.listCommits(projectX);
    const commitsY = MemoryPalace.listCommits(projectY);

    assert.equal(commitsX.length, 1);
    assert.equal(commitsX[0].author, 'DevX');
    assert.equal(commitsY.length, 0, 'Projeto Y não deve herdar commits do Projeto X');
  });

  test('3. Isolamento de Sessões de Chat entre Projetos', () => {
    SessionManager.saveSession(projectX, {
      id: 'chat_proj_x',
      title: 'Discussão Projeto X',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'anthropic/claude-3.7-sonnet',
      messages: [{ role: 'user', content: 'Planejar sprint do projeto X' }]
    });

    SessionManager.saveSession(projectY, {
      id: 'chat_proj_y',
      title: 'Discussão Projeto Y',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Planejar design do projeto Y' }]
    });

    const sessionsX = SessionManager.listSessions(projectX);
    const sessionsY = SessionManager.listSessions(projectY);

    assert.equal(sessionsX.length, 1);
    assert.equal(sessionsX[0].id, 'chat_proj_x');

    assert.equal(sessionsY.length, 1);
    assert.equal(sessionsY[0].id, 'chat_proj_y');
  });

  test('4. Active Context e Decisões Independentes', () => {
    MemoryEngine.updateActiveContext(projectX, '🎯 Contexto do Projeto X: Desenvolvimento de API');
    MemoryEngine.updateActiveContext(projectY, '🎯 Contexto do Projeto Y: Prototipação de UI');

    const ctxX = MemoryEngine.getActiveContext(projectX);
    const ctxY = MemoryEngine.getActiveContext(projectY);

    assert.ok(ctxX.includes('Desenvolvimento de API'));
    assert.ok(ctxY.includes('Prototipação de UI'));
  });
});
