import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SessionManager, ChatSession } from '../../src/services/sessionManager.js';
import { AgentLoop } from '../../src/services/agentLoop.js';
import { getDefaultConversationsDir } from '../../src/utils/appPaths.js';

describe('💬 Central de Conversas & Chats Livres (Standalone Chats)', () => {
  const testDir = path.join(os.tmpdir(), `tellus_standalone_test_${Date.now()}`);

  beforeEach(() => {
    process.env.TELLUS_CONVERSATIONS_DIR = testDir;
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    delete process.env.TELLUS_CONVERSATIONS_DIR;
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('1. Deve resolver o diretório de conversas avulsas via getDefaultConversationsDir e SessionManager', () => {
    const dir = getDefaultConversationsDir();
    assert.equal(dir, path.resolve(testDir));
    const sessionDir = SessionManager.getSessionsDir(null);
    assert.equal(sessionDir, path.resolve(testDir));
  });

  it('2. Deve salvar e recuperar uma conversa avulsa (standalone chat) sem projeto vinculado', () => {
    const session: ChatSession = {
      id: 'standalone_session_1',
      title: 'Dúvidas sobre Teorema de Bayes',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'deepseek/deepseek-r1',
      messages: [
        { role: 'user', content: 'Como posso aplicar o Teorema de Bayes em machine learning?' },
        { role: 'assistant', content: 'O Teorema de Bayes calcula a probabilidade posterior...' }
      ],
      isStandalone: true
    };

    const saved = SessionManager.saveSession(null, session);
    assert.equal(saved.isStandalone, true);
    assert.equal(saved.projectName, 'Conversa Livre');
    assert.equal(saved.projectPath, '');

    const loaded = SessionManager.getSession(null, 'standalone_session_1');
    assert.ok(loaded);
    assert.equal(loaded.title, 'Dúvidas sobre Teorema de Bayes');
    assert.equal(loaded.isStandalone, true);
    assert.equal(loaded.messages.length, 2);
  });

  it('3. Deve listar conversas avulsas atribuindo isStandalone e projectName corretos', () => {
    SessionManager.saveSession(null, {
      id: 'session_chat_a',
      title: 'Estudo de Rust e Memory Safety',
      createdAt: Date.now() - 5000,
      updatedAt: Date.now() - 5000,
      model: 'gpt-luna',
      messages: [{ role: 'user', content: 'Explique ownership e borrow checker em Rust' }],
      isStandalone: true
    });

    SessionManager.saveSession(null, {
      id: 'session_chat_b',
      title: 'Brainstorming de Produto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'deepseek/deepseek-r1',
      messages: [{ role: 'user', content: 'Ideias de funcionalidades para o Tellus' }],
      isStandalone: true
    });

    const list = SessionManager.listSessions(null);
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'session_chat_b'); // Mais recente primeiro
    assert.equal(list[0].isStandalone, true);
    assert.equal(list[0].projectName, 'Conversa Livre');
    assert.equal(list[1].isStandalone, true);
  });

  it('4. Deve pesquisar mensagens em conversas avulsas', () => {
    SessionManager.saveSession(null, {
      id: 'search_test_session',
      title: 'Criptografia Quântica',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'deepseek/deepseek-r1',
      messages: [
        { id: 'm1', role: 'user', content: 'O que é o protocolo BB84 de distribuição de chaves?' }
      ],
      isStandalone: true
    });

    const results = SessionManager.searchMessages(null, 'BB84');
    assert.ok(results.length > 0);
    assert.equal(results[0].sessionId, 'search_test_session');
    assert.ok(results[0].matchedSnippet.includes('BB84'));
  });

  it('5. Deve excluir conversas avulsas corretamente', () => {
    SessionManager.saveSession(null, {
      id: 'delete_test_session',
      title: 'Nota efêmera',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'deepseek/deepseek-r1',
      messages: [{ role: 'user', content: 'Excluir depois' }],
      isStandalone: true
    });

    assert.ok(SessionManager.getSession(null, 'delete_test_session'));
    const deleted = SessionManager.deleteSession(null, 'delete_test_session');
    assert.equal(deleted, true);
    assert.equal(SessionManager.getSession(null, 'delete_test_session'), null);
  });

  it('6. Deve bloquear ferramentas de código quando nenhuma pasta de projeto estiver aberta', async () => {
    const readResult = await AgentLoop.executeTool('', 'read_file', JSON.stringify({ path: 'src/index.ts' }), 'gpt-luna');
    assert.ok(readResult.error);
    assert.ok(readResult.error.includes('Conversa Livre sem projeto aberto'));

    const writeResult = await AgentLoop.executeTool('', 'write_file', JSON.stringify({ path: 'test.txt', content: 'hello' }), 'gpt-luna');
    assert.ok(writeResult.error);
    assert.ok(writeResult.error.includes('Conversa Livre sem projeto aberto'));

    const termResult = await AgentLoop.executeTool('', 'run_command', JSON.stringify({ command: 'dir' }), 'gpt-luna');
    assert.ok(termResult.error);
    assert.ok(termResult.error.includes('Conversa Livre sem projeto aberto'));
  });

  it('7. Deve impedir conflito e contaminação cruzada de sessões entre projetos distintos', () => {
    const projAlpha = path.join(testDir, 'ProjectAlpha');
    const projBeta = path.join(testDir, 'ProjectBeta');
    fs.mkdirSync(path.join(projAlpha, '.agentic', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(projBeta, '.agentic', 'sessions'), { recursive: true });

    // Sessão legítima de Alpha
    SessionManager.saveSession(projAlpha, {
      id: 'session_alpha_1',
      title: 'Chat Alpha Exclusivo',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'gpt-luna',
      messages: [{ role: 'user', content: 'Planejamento Alpha' }],
      projectPath: projAlpha
    });

    // Sessão de Beta que acidentalmente foi copiada para dentro de Alpha
    const misplacedBetaFile = path.join(projAlpha, '.agentic', 'sessions', 'session_beta_misplaced.json');
    fs.writeFileSync(misplacedBetaFile, JSON.stringify({
      id: 'session_beta_misplaced',
      title: 'Chat Beta Perdido',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'gpt-luna',
      messages: [{ role: 'user', content: 'Planejamento Beta' }],
      projectPath: projBeta,
      projectName: 'ProjectBeta'
    }, null, 2), 'utf-8');

    // Ao listar sessões de Alpha, não deve listar a sessão de Beta
    const alphaSessions = SessionManager.listSessions(projAlpha);
    assert.equal(alphaSessions.length, 1);
    assert.equal(alphaSessions[0].id, 'session_alpha_1');
    assert.equal(alphaSessions[0].projectName, 'ProjectAlpha');

    // O mecanismo de auto-cura deve ter realocado o arquivo para ProjectBeta
    const betaSessions = SessionManager.listSessions(projBeta);
    assert.equal(betaSessions.length, 1);
    assert.equal(betaSessions[0].id, 'session_beta_misplaced');
    assert.equal(betaSessions[0].projectName, 'ProjectBeta');

    // E o arquivo perdido deve ter sido removido de Alpha
    assert.equal(fs.existsSync(misplacedBetaFile), false);
  });

  it('8. Deve suportar sessões do Arquiteto de Skills e ferramentas de persistência (skill_save, skill_list, skill_get)', async () => {
    // 1. Salvar sessão do Arquiteto de Skills
    const architectSession: ChatSession = {
      id: 'session_skill_architect_1',
      title: '🛠️ Arquiteto: Refatorador Rust',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'gpt-luna',
      isStandalone: true,
      isSkillArchitect: true,
      routineId: 'skill_architect',
      messages: [
        { role: 'user', content: 'Quero uma skill para refatoração de código Rust com foco em segurança de memória' },
        { role: 'assistant', content: 'Perfeito! Vamos estruturar a skill `rust-memory-auditor`.' }
      ]
    };
    SessionManager.saveSession(null, architectSession);

    const retrieved = SessionManager.getSession(null, 'session_skill_architect_1');
    assert.ok(retrieved);
    assert.equal(retrieved?.isSkillArchitect, true);
    assert.equal(retrieved?.routineId, 'skill_architect');

    const standaloneList = SessionManager.listSessions(null);
    const foundMeta = standaloneList.find(s => s.id === 'session_skill_architect_1');
    assert.ok(foundMeta);
    assert.equal(foundMeta?.isSkillArchitect, true);

    // 2. Executar tool skill_save via AgentLoop (mesmo sem projeto aberto, pois skills são globais/Tellus)
    const saveResult = await AgentLoop.executeTool('', 'skill_save', JSON.stringify({
      id: 'test-rust-auditor',
      name: 'Auditor de Memória Rust',
      description: 'Analisa código Rust e valida lifetimes e borrowing.',
      category: 'Análise de Código',
      scope: 'project',
      promptInstructions: 'Você deve examinar structs, traits e lifetimes buscando vulnerabilidades de memória.'
    }), 'gpt-luna');

    assert.ok(!saveResult.error, `Erro inesperado no skill_save: ${saveResult.error}`);
    assert.equal(saveResult.status, 'success');
    assert.equal((saveResult as any).skill?.id, 'test-rust-auditor');
    assert.equal((saveResult as any).skill?.name, 'Auditor de Memória Rust');

    // 3. Executar tool skill_get
    const getResult = await AgentLoop.executeTool('', 'skill_get', JSON.stringify({ id: 'test-rust-auditor' }), 'gpt-luna');
    assert.ok(!getResult.error);
    assert.equal(getResult.status, 'success');
    assert.equal((getResult as any).skill?.id, 'test-rust-auditor');
    assert.equal((getResult as any).skill?.name, 'Auditor de Memória Rust');

    // 4. Executar tool skill_list
    const listResult = await AgentLoop.executeTool('', 'skill_list', '{}', 'gpt-luna');
    assert.ok(!listResult.error);
    assert.equal(listResult.status, 'success');
    const skillsList = (listResult as any).skills;
    assert.ok(Array.isArray(skillsList));
    assert.ok(skillsList.some((s: any) => s.id === 'test-rust-auditor'));
  });

  it('9. Deve mover conversas livres para dentro de um projeto e vice-versa (moveSession)', () => {
    const projTarget = path.join(testDir, 'ProjTarget');
    fs.mkdirSync(path.join(projTarget, '.agentic', 'sessions'), { recursive: true });

    // 1. Criar conversa livre
    SessionManager.saveSession(null, {
      id: 'session_movable_1',
      title: 'Ideia Inicial Livre',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'gpt-luna',
      messages: [{ role: 'user', content: 'Planejamento de arquitetura' }],
      isStandalone: true
    });

    const standaloneDir = SessionManager.getSessionsDir(null);
    const initialFile = path.join(standaloneDir, 'session_movable_1.json');
    assert.ok(fs.existsSync(initialFile));

    // 2. Mover para ProjTarget
    const movedToProj = SessionManager.moveSession('session_movable_1', projTarget, null);
    assert.ok(movedToProj);
    assert.equal(movedToProj?.isStandalone, false);
    assert.equal(movedToProj?.projectPath, projTarget);
    assert.equal(movedToProj?.projectName, 'ProjTarget');

    const projectFile = path.join(projTarget, '.agentic', 'sessions', 'session_movable_1.json');
    assert.ok(fs.existsSync(projectFile), 'Arquivo deve existir no diretório de sessões do projeto');
    assert.equal(fs.existsSync(initialFile), false, 'Arquivo deve ter sido removido das conversas avulsas');

    // 3. Mover de volta para standalone
    const movedBack = SessionManager.moveSession('session_movable_1', null, projTarget);
    assert.ok(movedBack);
    assert.equal(movedBack?.isStandalone, true);
    assert.equal(movedBack?.projectPath, '');
    assert.equal(movedBack?.projectName, 'Conversa Livre');

    assert.ok(fs.existsSync(initialFile), 'Arquivo deve estar de volta no diretório standalone');
    assert.equal(fs.existsSync(projectFile), false, 'Arquivo deve ter sido removido do projeto');
  });

  it('10. Deve garantir segregação estrita e auto-cura para o Arquiteto de Skills', () => {
    const projKentron = path.join(testDir, 'Kentron');
    fs.mkdirSync(path.join(projKentron, '.agentic', 'sessions'), { recursive: true });

    // 1. Salvar skill architect mesmo passando acidentalmente projectPath
    SessionManager.saveSession(projKentron, {
      id: 'session_skill_forge_1',
      title: '🛠️ Arquiteto: Refatorador Rust',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'gpt-luna',
      routineId: 'skill_architect',
      isSkillArchitect: true,
      messages: [{ role: 'user', content: 'Quero forjar uma skill' }]
    });

    // O arquivo DEVE ter sido salvo no diretório global e NÃO em Kentron
    const standaloneDir = SessionManager.getSessionsDir(null);
    const globalFile = path.join(standaloneDir, 'session_skill_forge_1.json');
    const kentronFile = path.join(projKentron, '.agentic', 'sessions', 'session_skill_forge_1.json');

    assert.ok(fs.existsSync(globalFile), 'Sessão do arquiteto de skills deve ficar no diretório global');
    assert.equal(fs.existsSync(kentronFile), false, 'Sessão do arquiteto de skills NUNCA deve poluir o projeto');

    // 2. Simular contaminação acidental por cópia direta em Kentron
    const pollutedFile = path.join(projKentron, '.agentic', 'sessions', 'session_skill_polluted.json');
    fs.writeFileSync(pollutedFile, JSON.stringify({
      id: 'session_skill_polluted',
      title: '🛠️ Arquiteto Poluído',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'gpt-luna',
      isSkillArchitect: true,
      routineId: 'skill_architect',
      messages: [{ role: 'user', content: 'Skill perdida em Kentron' }]
    }, null, 2), 'utf-8');

    // Ao listar sessões de Kentron, o auto-healing deve expulsar a sessão de skill do projeto
    const kentronList = SessionManager.listSessions(projKentron);
    assert.equal(kentronList.some(s => s.id === 'session_skill_polluted'), false);
    assert.equal(fs.existsSync(pollutedFile), false, 'Arquivo contaminado deve ter sido removido de Kentron');

    // E deve estar presente na lista global
    const globalList = SessionManager.listSessions(null);
    assert.ok(globalList.some(s => s.id === 'session_skill_polluted'));
  });
});
