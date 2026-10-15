import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SessionManager, ChatSession } from '../../src/services/sessionManager.js';

describe('💬 Módulo 4: Gerenciador de Sessões de Chat & Multi-Projeto', () => {
  let projectAlpha: string;
  let projectBeta: string;

  before(() => {
    projectAlpha = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_chat_alpha_'));
    projectBeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_chat_beta_'));
  });

  after(() => {
    try {
      if (fs.existsSync(projectAlpha)) fs.rmSync(projectAlpha, { recursive: true, force: true });
      if (fs.existsSync(projectBeta)) fs.rmSync(projectBeta, { recursive: true, force: true });
    } catch {}
  });

  test('1. Criação e persistência de sessão vinculada ao projeto com metadados', () => {
    const session1: ChatSession = {
      id: 'session_alpha_1',
      title: 'Discussão de Arquitetura do Tellus',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'anthropic/claude-3.7-sonnet',
      messages: [
        { role: 'user', content: 'Como estruturar o Palácio de Memória no projeto?' },
        { role: 'assistant', content: 'Utilize uma pasta .agentic/palace com arquivos JSON para builds e commits.' }
      ],
      isLiveVoice: false,
      liveVoiceMode: 'mixed'
    };

    const saved = SessionManager.saveSession(projectAlpha, session1);
    assert.equal(saved.id, 'session_alpha_1');

    const sessions = SessionManager.listSessions(projectAlpha);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, 'session_alpha_1');
    assert.equal(sessions[0].title, 'Discussão de Arquitetura do Tellus');
    assert.equal(sessions[0].projectPath, projectAlpha);
    assert.equal(sessions[0].projectName, path.basename(projectAlpha));
    assert.equal(sessions[0].messageCount, 2);
  });

  test('2. Isolamento de sessões entre projetos distintos (Alpha vs Beta)', () => {
    const sessionBeta: ChatSession = {
      id: 'session_beta_1',
      title: 'Configuração do App Beta',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'user', content: 'Iniciando o projeto Beta' }
      ]
    };

    SessionManager.saveSession(projectBeta, sessionBeta);

    const alphaSessions = SessionManager.listSessions(projectAlpha);
    const betaSessions = SessionManager.listSessions(projectBeta);

    assert.equal(alphaSessions.length, 1);
    assert.equal(alphaSessions[0].id, 'session_alpha_1');

    assert.equal(betaSessions.length, 1);
    assert.equal(betaSessions[0].id, 'session_beta_1');

    // Sessão do Alpha não existe no Beta
    assert.equal(SessionManager.getSession(projectBeta, 'session_alpha_1'), null);
    assert.equal(SessionManager.getSession(projectAlpha, 'session_beta_1'), null);
  });

  test('3. Atualização de sessão com modo Live Voice e novas mensagens', () => {
    const session = SessionManager.getSession(projectAlpha, 'session_alpha_1');
    assert.ok(session);

    session.isLiveVoice = true;
    session.liveVoiceMode = 'voice_only';
    session.messages.push({
      role: 'user',
      content: 'Executar teste de áudio com Fish Voice'
    });

    SessionManager.saveSession(projectAlpha, session);

    const reloaded = SessionManager.getSession(projectAlpha, 'session_alpha_1');
    assert.ok(reloaded?.isLiveVoice);
    assert.equal(reloaded?.liveVoiceMode, 'voice_only');
    assert.equal(reloaded?.messages.length, 3);
  });

  test('4. Pesquisa de mensagens dentro das sessões do projeto (searchMessages)', () => {
    const matches = SessionManager.searchMessages(projectAlpha, 'Palácio de Memória');
    assert.ok(matches.length > 0);
    assert.equal(matches[0].sessionId, 'session_alpha_1');
    assert.ok(matches[0].content.includes('Palácio de Memória'));
  });

  test('5. Exclusão segura de sessão e integridade do repositório', () => {
    const deleted = SessionManager.deleteSession(projectAlpha, 'session_alpha_1');
    assert.equal(deleted, true);

    const remaining = SessionManager.listSessions(projectAlpha);
    assert.equal(remaining.length, 0);

    // Beta continua intacto
    const betaSessions = SessionManager.listSessions(projectBeta);
    assert.equal(betaSessions.length, 1);
  });
});
