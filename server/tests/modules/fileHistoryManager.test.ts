import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileHistoryManager } from '../../src/services/history/fileHistoryManager';

describe('📜 Módulo: FileHistoryManager & Rastreamento de Alterações', () => {
  let tempDir: string;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-history-test-'));
  });

  after(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('1. computeDiff calcula adições, remoções e range de linhas com precisão', () => {
    const oldContent = 'line 1\nline 2\nline 3\n';
    const newContent = 'line 1\nline 2 modified\nline 2.5 added\nline 3\n';

    const result = fileHistoryManager.computeDiff('src/test.ts', oldContent, newContent);

    assert.ok(result.diff.includes('--- a/src/test.ts'));
    assert.ok(result.diff.includes('+++ b/src/test.ts'));
    assert.strictEqual(result.linesAdded, 2);
    assert.strictEqual(result.linesRemoved, 1);
    assert.strictEqual(result.lineRange.start, 2);
  });

  it('2. recordChange persiste alteração com motivo e metadados da sessão', async () => {
    const filePath = 'server/src/utils.ts';
    const absFile = path.join(tempDir, filePath);
    fs.mkdirSync(path.dirname(absFile), { recursive: true });
    fs.writeFileSync(absFile, 'export const a = 1;\n', 'utf-8');

    const entry = fileHistoryManager.recordChange(tempDir, {
      filePath,
      action: 'modify',
      sessionId: 'session_abc',
      sessionTitle: 'Refatoração da API',
      messageId: 'msg_123',
      reason: 'Adicionando nova função auxiliar getStatus',
      oldContent: 'export const a = 1;\n',
      newContent: 'export const a = 1;\nexport const getStatus = () => "ok";\n',
      linesAdded: 1,
      linesRemoved: 0,
      diff: '--- a/server/src/utils.ts\n+++ b/server/src/utils.ts\n+export const getStatus = () => "ok";\n'
    });

    assert.ok(entry.id.startsWith('chg_'));
    assert.strictEqual(entry.reason, 'Adicionando nova função auxiliar getStatus');
    assert.strictEqual(entry.sessionId, 'session_abc');
    assert.strictEqual(entry.linesAdded, 1);
    assert.strictEqual(entry.linesRemoved, 0);

    const list = fileHistoryManager.getChanges(tempDir);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, entry.id);
    assert.strictEqual(list[0].filePath, filePath);
  });

  it('3. getChanges permite filtrar por sessão de chat específica', async () => {
    fileHistoryManager.recordChange(tempDir, {
      filePath: 'config.json',
      action: 'modify',
      sessionId: 'session_xyz',
      sessionTitle: 'Ajuste de Configurações',
      messageId: 'msg_999',
      reason: 'Atualizando porta do servidor',
      oldContent: '{"port": 3000}',
      newContent: '{"port": 8080}',
      linesAdded: 1,
      linesRemoved: 1,
      diff: '-{"port": 3000}\n+{"port": 8080}'
    });

    const allChanges = fileHistoryManager.getChanges(tempDir);
    assert.strictEqual(allChanges.length, 2);

    const chatXyzChanges = fileHistoryManager.getChanges(tempDir, 'session_xyz');
    assert.strictEqual(chatXyzChanges.length, 1);
    assert.strictEqual(chatXyzChanges[0].sessionId, 'session_xyz');
    assert.strictEqual(chatXyzChanges[0].filePath, 'config.json');

    const chatAbcChanges = fileHistoryManager.getChanges(tempDir, 'session_abc');
    assert.strictEqual(chatAbcChanges.length, 1);
    assert.strictEqual(chatAbcChanges[0].sessionId, 'session_abc');
  });

  it('4. revertChange reverte o arquivo para o estado anterior com segurança', async () => {
    const fileToRevert = 'server/src/utils.ts';
    const absFile = path.join(tempDir, fileToRevert);
    fs.writeFileSync(absFile, 'export const a = 1;\nexport const getStatus = () => "ok";\n', 'utf-8');

    const changes = fileHistoryManager.getChanges(tempDir);
    const targetChange = changes.find(c => c.filePath === fileToRevert);
    assert.ok(targetChange);

    const result = fileHistoryManager.revertChange(tempDir, targetChange.id);
    assert.strictEqual(result.success, true);

    const contentAfterRevert = fs.readFileSync(absFile, 'utf-8');
    assert.strictEqual(contentAfterRevert, 'export const a = 1;\n');
  });

  it('5. syncFromChatSessions importa histórico existente de sessões antigas', async () => {
    const sessionsDir = path.join(tempDir, '.agentic', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });

    const mockSession = {
      id: 'session_legacy_1',
      title: 'Chat Antigo com Frank',
      messages: [
        {
          id: 'msg_leg_1',
          role: 'assistant',
          toolCalls: [
            {
              id: 'tc_1',
              name: 'write_file',
              arguments: JSON.stringify({
                path: 'docs/readme.md',
                content: '# Projeto Tellus\nDocumentação inicial',
                description: 'Criando documentação inicial'
              }),
              status: 'completed'
            }
          ]
        }
      ]
    };

    fs.writeFileSync(path.join(sessionsDir, 'session_legacy_1.json'), JSON.stringify(mockSession, null, 2), 'utf-8');

    const imported = await fileHistoryManager.syncFromChatSessions(tempDir);
    assert.ok(imported.length >= 1);
    const docChange = imported.find(c => c.filePath === 'docs/readme.md');
    assert.ok(docChange);
    assert.strictEqual(docChange.reason, 'Criando documentação inicial');
    assert.strictEqual(docChange.sessionId, 'session_legacy_1');
  });
});
