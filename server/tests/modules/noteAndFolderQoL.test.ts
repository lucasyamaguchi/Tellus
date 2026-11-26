import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test isolated vault directory
const TEST_VAULT_DIR = path.join(os.tmpdir(), `tellus_test_qol_vault_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
process.env.TELLUS_VAULT_DIR = TEST_VAULT_DIR;

import { TellusNoteEngine } from '../../src/services/notes/tellusNoteEngine.js';

describe('⚡ Módulo: Qualidade de Vida (QoL) - Operações em Lote de Notas & Cadernos', () => {
  before(() => {
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_VAULT_DIR, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
    }
    delete process.env.TELLUS_VAULT_DIR;
  });

  beforeEach(() => {
    // Clear vault between tests
    if (fs.existsSync(TEST_VAULT_DIR)) {
      const entries = fs.readdirSync(TEST_VAULT_DIR);
      for (const entry of entries) {
        fs.rmSync(path.join(TEST_VAULT_DIR, entry), { recursive: true, force: true });
      }
    }
  });

  it('1. mergeNotes: funde múltiplas notas em uma única nota consolidada', () => {
    const note1 = TellusNoteEngine.saveNote({
      title: 'Arquitetura Backend',
      folder: 'Engenharia',
      content: '# Arquitetura Backend\n\nPrincípios de microserviços e alta performance em Node.js.\nTags: #arquitetura #node'
    });

    const note2 = TellusNoteEngine.saveNote({
      title: 'Padrões de Banco de Dados',
      folder: 'Engenharia',
      content: '# Padrões de Banco de Dados\n\nModelagem de dados e índices otimizados para busca vetorial.\nTags: #database #performance'
    });

    assert.ok(note1 && note2, 'Notas originais criadas com sucesso');

    // Executa a mesclagem das duas notas com remoção das originais
    const mergedNote = TellusNoteEngine.mergeNotes(
      [note1.id, note2.id],
      {
        title: 'Engenharia Completa: Backend e Banco',
        targetFolder: 'Engenharia',
        deleteSources: true
      }
    );

    assert.ok(mergedNote, 'Nota consolidada gerada com sucesso');
    assert.strictEqual(mergedNote.title, 'Engenharia Completa: Backend e Banco');
    assert.strictEqual(mergedNote.folder, 'Engenharia');
    assert.ok(mergedNote.content.includes('Arquitetura Backend'), 'Título da primeira nota deve estar presente');
    assert.ok(mergedNote.content.includes('Padrões de Banco de Dados'), 'Título da segunda nota deve estar presente');
    assert.ok(mergedNote.content.includes('Princípios de microserviços'), 'Corpo da nota 1 preservado');
    assert.ok(mergedNote.content.includes('Modelagem de dados e índices'), 'Corpo da nota 2 preservado');

    // Verifica que as notas originais foram excluídas do vault ativo
    const allNotes = TellusNoteEngine.listNotes();
    assert.strictEqual(allNotes.length, 1, 'Deve existir apenas a nota consolidada');
    assert.strictEqual(allNotes[0].id, mergedNote.id);
  });

  it('2. bulkMoveNotes: move múltiplas notas para outro caderno/pasta em lote', () => {
    const noteA = TellusNoteEngine.saveNote({
      title: 'Nota A',
      folder: 'Inbox',
      content: '# Nota A\n\nConteúdo de A'
    });

    const noteB = TellusNoteEngine.saveNote({
      title: 'Nota B',
      folder: 'Inbox',
      content: '# Nota B\n\nConteúdo de B'
    });

    const noteC = TellusNoteEngine.saveNote({
      title: 'Nota C',
      folder: 'Outros',
      content: '# Nota C\n\nConteúdo de C'
    });

    const result = TellusNoteEngine.bulkMoveNotes(
      [noteA.id, noteB.id],
      'Projetos/Core'
    );

    assert.strictEqual(result.successCount, 2, 'Deve ter movido exatamente 2 notas');
    assert.strictEqual(result.updatedNotes.length, 2);

    const notes = TellusNoteEngine.listNotes();
    const reloadedA = notes.find(n => n.id === noteA.id);
    const reloadedB = notes.find(n => n.id === noteB.id);
    const reloadedC = notes.find(n => n.id === noteC.id);

    assert.ok(reloadedA && reloadedB && reloadedC);
    assert.strictEqual(reloadedA.folder, 'Projetos/Core');
    assert.strictEqual(reloadedB.folder, 'Projetos/Core');
    assert.strictEqual(reloadedC.folder, 'Outros', 'Nota C não selecionada deve permanecer intacta');
  });

  it('3. bulkDeleteNotes: move múltiplas notas para lixeira/backups', () => {
    const note1 = TellusNoteEngine.saveNote({
      title: 'Rascunho Descartável 1',
      folder: 'Geral',
      content: '# Rascunho Descartável 1\n\nTexto 1'
    });

    const note2 = TellusNoteEngine.saveNote({
      title: 'Rascunho Descartável 2',
      folder: 'Geral',
      content: '# Rascunho Descartável 2\n\nTexto 2'
    });

    const note3 = TellusNoteEngine.saveNote({
      title: 'Nota Importante',
      folder: 'Geral',
      content: '# Nota Importante\n\nManter salva'
    });

    const result = TellusNoteEngine.bulkDeleteNotes([note1.id, note2.id]);
    assert.strictEqual(result.successCount, 2);
    assert.strictEqual(result.failedCount, 0);

    const activeNotes = TellusNoteEngine.listNotes();
    assert.strictEqual(activeNotes.length, 1);
    assert.strictEqual(activeNotes[0].id, note3.id);

    // Verifica que as notas apagadas estão na lixeira (.backups)
    const backups = TellusNoteEngine.listDeletedNotes();
    assert.ok(backups.length >= 2, 'Backups devem conter as notas removidas em lote');
  });

  it('4. renameFolder: renomeia caderno/pasta e atualiza todas as notas filhas', () => {
    TellusNoteEngine.saveNote({
      title: 'Capítulo 1',
      folder: 'Livros Antigos',
      content: '# Capítulo 1\n\nIntrodução da história'
    });

    TellusNoteEngine.saveNote({
      title: 'Capítulo 2',
      folder: 'Livros Antigos/Ficcao',
      content: '# Capítulo 2\n\nContinuação da trama'
    });

    const renameResult = TellusNoteEngine.renameFolder('Livros Antigos', 'Biblioteca Moderna');
    assert.strictEqual(renameResult.success, true);
    assert.strictEqual(renameResult.movedNotesCount, 2);

    const notes = TellusNoteEngine.listNotes();
    const cap1 = notes.find(n => n.title.toLowerCase().includes('capítulo 1'));
    const cap2 = notes.find(n => n.title.toLowerCase().includes('capítulo 2'));

    assert.ok(cap1 && cap2);
    assert.strictEqual(cap1.folder, 'Biblioteca Moderna');
    assert.strictEqual(cap2.folder, 'Biblioteca Moderna/Ficcao');
  });

  it('5. mergeFolders: agrega múltiplos cadernos em um só sem alterar os corpos das notas', () => {
    const noteAlpha = TellusNoteEngine.saveNote({
      title: 'Pesquisa Alpha',
      folder: 'Caderno Alpha',
      content: '# Pesquisa Alpha\n\nDados originais Alpha intocados.'
    });

    const noteBeta = TellusNoteEngine.saveNote({
      title: 'Pesquisa Beta',
      folder: 'Caderno Beta',
      content: '# Pesquisa Beta\n\nDados originais Beta intocados.'
    });

    const mergeResult = TellusNoteEngine.mergeFolders(
      ['Caderno Alpha', 'Caderno Beta'],
      'Caderno Integrado'
    );

    assert.strictEqual(mergeResult.success, true);
    assert.strictEqual(mergeResult.movedNotesCount, 2);

    const notes = TellusNoteEngine.listNotes();
    const alphaReloaded = notes.find(n => n.id === noteAlpha.id);
    const betaReloaded = notes.find(n => n.id === noteBeta.id);

    assert.ok(alphaReloaded && betaReloaded);
    assert.strictEqual(alphaReloaded.folder, 'Caderno Integrado');
    assert.strictEqual(betaReloaded.folder, 'Caderno Integrado');
    // Integridade dos textos deve ser 100% mantida sem mescla de arquivos
    assert.ok(alphaReloaded.content.includes('Dados originais Alpha intocados.'));
    assert.ok(betaReloaded.content.includes('Dados originais Beta intocados.'));
  });

  it('6. Detecção de arquivos internos e pastas do sistema (isInternalFolder e isInternal)', () => {
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Artefatos do Projeto'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Documentação do Projeto'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('_attachments'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Backend'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Frontend'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Criptografia'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Engenharia'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Infra'), true);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Estudos/Segurança'), false);
    assert.strictEqual(TellusNoteEngine.isInternalFolder('Meus Cadernos'), false);

    const internalNote = TellusNoteEngine.saveNote({
      title: 'Plano de Arquitetura',
      folder: 'Artefatos do Projeto',
      content: '# Arquitetura Interna\nConteúdo protegido.'
    });

    const personalNote = TellusNoteEngine.saveNote({
      title: 'Minhas Anotações de Estudo',
      folder: 'Estudos',
      content: '# Estudos\nConteúdo pessoal do usuário.'
    });

    const notes = TellusNoteEngine.listNotes();
    const foundInternal = notes.find(n => n.id === internalNote.id);
    const foundPersonal = notes.find(n => n.id === personalNote.id);

    assert.ok(foundInternal && foundPersonal);
    assert.strictEqual(foundInternal.isInternal, true, 'Nota em Artefatos do Projeto deve ser marcada como isInternal');
    assert.strictEqual(foundPersonal.isInternal, false, 'Nota em Estudos não deve ser marcada como isInternal');
  });

  it('7. Blindagem de exclusão individual (deleteNote) e de pastas (deleteFolder)', () => {
    const internalNote = TellusNoteEngine.saveNote({
      title: 'API Backend Ref',
      folder: 'Backend',
      content: '# Backend Doc'
    });

    // Rejeição ao tentar excluir nota interna sem forceInternal (retorna false)
    const deleteAttempt = TellusNoteEngine.deleteNote(internalNote.id, false, undefined, false);
    assert.strictEqual(deleteAttempt, false, 'deleteNote deve recusar exclusão de arquivo interno protegido');

    // Rejeição ao tentar excluir pasta interna protegida
    const folderRes = TellusNoteEngine.deleteFolder('Backend');
    assert.strictEqual(folderRes.success, false, 'deleteFolder deve falhar para pasta interna');
    assert.strictEqual(folderRes.protected, true, 'deleteFolder deve retornar protected: true');

    // Permite excluir passando forceInternal = true (ex: em operações internas controladas)
    const deletedWithForce = TellusNoteEngine.deleteNote(internalNote.id, false, undefined, true);
    assert.strictEqual(deletedWithForce, true, 'deleteNote com forceInternal deve permitir exclusão');
  });

  it('8. Blindagem de exclusão em massa (bulkDeleteNotes): preserva arquivos internos e retorna protectedCount', () => {
    const notePersonal1 = TellusNoteEngine.saveNote({
      title: 'Ideia 1',
      folder: 'Rascunhos',
      content: 'Ideia pessoal 1'
    });
    const notePersonal2 = TellusNoteEngine.saveNote({
      title: 'Ideia 2',
      folder: 'Rascunhos',
      content: 'Ideia pessoal 2'
    });
    const internalDoc = TellusNoteEngine.saveNote({
      title: 'Security Blueprint',
      folder: 'Criptografia',
      content: 'Chaves e especificações de segurança do projeto'
    });

    const bulkResult = TellusNoteEngine.bulkDeleteNotes([
      notePersonal1.id,
      notePersonal2.id,
      internalDoc.id
    ]);

    assert.strictEqual(bulkResult.successCount, 2, 'Apenas as 2 notas pessoais devem ser excluídas');
    assert.strictEqual(bulkResult.protectedCount, 1, 'A nota interna deve ser protegida');

    const activeNotes = TellusNoteEngine.listNotes();
    assert.ok(activeNotes.some(n => n.id === internalDoc.id), 'Arquivo interno DEVE permanecer no vault');
    assert.ok(!activeNotes.some(n => n.id === notePersonal1.id), 'Nota pessoal 1 deve ter sido movida');
    assert.ok(!activeNotes.some(n => n.id === notePersonal2.id), 'Nota pessoal 2 deve ter sido movida');
  });
});
