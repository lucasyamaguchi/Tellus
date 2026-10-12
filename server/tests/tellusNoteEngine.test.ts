import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test isolated vault directory
const TEST_VAULT_DIR = path.join(os.tmpdir(), `tellus_test_vault_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
process.env.TELLUS_VAULT_DIR = TEST_VAULT_DIR;

// Import TellusNoteEngine and backward compatibility aliases
import {
  TellusNoteEngine,
  FrankNoteEngine,
  NotesEngine,
  type TellusNote,
  type TellusMDNote,
  type FrankNote
} from '../src/services/notes/frankNoteEngine.js';

describe('TellusMD Note Engine - Automated Verification & Regression Suite', () => {
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

  it('1. Backward Compatibility & Architectural Identity', () => {
    assert.strictEqual(TellusNoteEngine, FrankNoteEngine, 'TellusNoteEngine must be an exact alias of FrankNoteEngine');
    assert.strictEqual(NotesEngine, TellusNoteEngine, 'NotesEngine must reference TellusNoteEngine');
    assert.strictEqual(TellusNoteEngine.VAULT_DIR, TEST_VAULT_DIR, 'VAULT_DIR must resolve to the isolated test vault');

    // Type compatibility test
    const dummy: TellusNote = {
      id: 'test',
      title: 'Test',
      filename: 'test.md',
      folder: 'Geral',
      subject: 'Geral',
      tags: [],
      content: 'hello',
      links: [],
      backlinks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const frankDummy: FrankNote = dummy;
    const tellusMdDummy: TellusMDNote = frankDummy;
    assert.strictEqual(dummy.id, tellusMdDummy.id);
  });

  it('2. Note Creation, Frontmatter, Wikilinks & Tags Parsing', () => {
    const note = TellusNoteEngine.saveNote({
      title: 'Fundamentos de Segurança Web',
      folder: 'Estudos/Seguranca',
      subject: 'Segurança da Informação',
      content: `# Fundamentos de Segurança Web
> Resumo executivo sobre proteção de aplicações web.

## 📌 Conceitos
- Autenticação e Autorização são pilares fundamentais.
- Veja também [[Arquitetura de Microsservicos]] e [[Modelagem de Ameacas]].

#seguranca #web #estudos #owasp`
    });

    assert.ok(note, 'Note must be created');
    assert.strictEqual(note.title, 'Fundamentos de Segurança Web');
    assert.strictEqual(note.folder, 'Estudos/Seguranca');
    assert.strictEqual(note.subject, 'Segurança da Informação');

    // Tags verification
    assert.ok(note.tags.includes('#seguranca'));
    assert.ok(note.tags.includes('#web'));
    assert.ok(note.tags.includes('#estudos'));
    assert.ok(note.tags.includes('#owasp'));

    // Wikilinks verification
    assert.ok(note.links.includes('Arquitetura de Microsservicos'));
    assert.ok(note.links.includes('Modelagem de Ameacas'));

    // Verify physical file was created in correct folder
    const expectedFilePath = path.join(TEST_VAULT_DIR, 'Estudos', 'Seguranca', note.filename);
    assert.ok(fs.existsSync(expectedFilePath), 'Physical Markdown file must exist on disk');
  });

  it('3. Reciprocal Backlinks Computation & Knowledge Graph', () => {
    // Create Note B that links to Note A
    const noteA = TellusNoteEngine.saveNote({
      title: 'Modelagem de Ameacas',
      folder: 'Estudos/Seguranca',
      content: `# Modelagem de Ameacas
Metodologia STRIDE e DREAD.
#seguranca`
    });

    // List notes - Note A should have backlink from the previous note created in step 2
    const allNotes = TellusNoteEngine.listNotes();
    const foundA = allNotes.find(n => n.title === 'Modelagem de Ameacas');
    assert.ok(foundA, 'Modelagem de Ameacas note must be listed');
    assert.ok(
      foundA.backlinks.includes('Fundamentos de Seguranca Web') || foundA.backlinks.some(b => b.includes('Fundamentos')),
      'Note A must contain reciprocal backlink from Fundamentos'
    );

    // Knowledge graph validation
    const graphData = TellusNoteEngine.getGraphData();
    assert.ok(graphData.nodes.length > 0, 'Graph must produce nodes');
    assert.ok(graphData.links.length > 0, 'Graph must produce links connecting notes/tags');

    const noteNode = graphData.nodes.find(n => n.id === `note_${foundA.id}`);
    assert.ok(noteNode, 'Graph must contain note node');
    assert.strictEqual(noteNode.type, 'note');

    const tagNode = graphData.nodes.find(n => n.id === 'tag_#seguranca');
    assert.ok(tagNode, 'Graph must contain tag node for #seguranca');
  });

  it('4. Full-Text Search, Snippets & Filtering', () => {
    const searchAll = TellusNoteEngine.searchNotes('STRIDE');
    assert.ok(searchAll.length > 0, 'Search for STRIDE should return results');
    assert.strictEqual(searchAll[0].note.title, 'Modelagem de Ameacas');
    assert.ok(searchAll[0].matchedSnippets.some(s => s.includes('STRIDE')));

    // Search with folder filter
    const searchFolder = TellusNoteEngine.searchNotes('Segurança', { folder: 'Estudos/Seguranca' });
    assert.ok(searchFolder.length > 0, 'Filtered search must return notes in folder');

    // Search in non-existing folder
    const emptySearch = TellusNoteEngine.searchNotes('Segurança', { folder: 'PastaInexistente' });
    assert.strictEqual(emptySearch.length, 0, 'Search in non-existing folder must return empty');
  });

  it('5. Folder Operations: Create, Move & Hierarchical Listing', () => {
    // Create new folder
    const created = TellusNoteEngine.createFolder('Projetos/TellusEngine');
    assert.strictEqual(created, true, 'Creating nested folder must return true');

    // List folders
    const folders = TellusNoteEngine.listFolders();
    assert.ok(folders.includes('Estudos/Seguranca'));
    assert.ok(folders.includes('Projetos/TellusEngine'));

    // Move folder
    const moved = TellusNoteEngine.moveFolder('Projetos/TellusEngine', 'Arquivados');
    assert.strictEqual(moved, true, 'Moving folder should succeed');

    const updatedFolders = TellusNoteEngine.listFolders();
    assert.ok(updatedFolders.some(f => f.includes('Arquivados')));
  });

  it('6. Move Note Between Notebooks/Folders', () => {
    const note = TellusNoteEngine.saveNote({
      title: 'Nota Para Mover',
      folder: 'Geral',
      content: '# Nota Para Mover\nConteúdo temporário.'
    });

    assert.strictEqual(note.folder, 'Geral');

    // Move note to 'Estudos/Seguranca'
    const movedNote = TellusNoteEngine.moveNote(note.id, 'Estudos/Seguranca');
    assert.ok(movedNote, 'Move note should succeed');
    assert.strictEqual(movedNote.folder, 'Estudos/Seguranca');

    // Verify physical location
    const oldPath = path.join(TEST_VAULT_DIR, note.filename);
    const newPath = path.join(TEST_VAULT_DIR, 'Estudos', 'Seguranca', note.filename);
    assert.strictEqual(fs.existsSync(oldPath), false, 'Old file location must not exist');
    assert.strictEqual(fs.existsSync(newPath), true, 'New file location must exist');
  });

  it('7. Soft-Delete, Trash Bin Retention, Restore & Purge', () => {
    const note = TellusNoteEngine.saveNote({
      title: 'Nota Lixeira Teste',
      folder: 'Testes',
      content: '# Nota Lixeira Teste\nPara ser deletada.'
    });

    // Delete note (soft-delete to .backups)
    const deleted = TellusNoteEngine.deleteNote(note.id);
    assert.strictEqual(deleted, true, 'Delete note must return true');

    // Active notes should not contain it
    const activeNotes = TellusNoteEngine.listNotes();
    assert.strictEqual(activeNotes.some(n => n.id === note.id), false, 'Active notes must not contain deleted note');

    // Trash bin should list it
    const trashItems = TellusNoteEngine.listDeletedNotes();
    const trashItem = trashItems.find(t => t.id === note.id);
    assert.ok(trashItem, 'Trash bin must contain deleted note');
    assert.strictEqual(trashItem.title, 'Nota Lixeira Teste');

    // Restore note
    const restored = TellusNoteEngine.restoreDeletedNote(trashItem.backupFilename);
    assert.ok(restored, 'Restoring deleted note must succeed');
    assert.strictEqual(restored.title, 'Nota Lixeira Teste');

    // Verify active notes contains restored note
    const reloadedActive = TellusNoteEngine.listNotes();
    assert.ok(reloadedActive.some(n => n.id === note.id), 'Active notes must contain restored note');

    // Delete again and test permanent deletion
    TellusNoteEngine.deleteNote(note.id);
    const trashAfterDelete = TellusNoteEngine.listDeletedNotes();
    const backupToDelete = trashAfterDelete.find(t => t.id === note.id);
    assert.ok(backupToDelete);

    const permanentlyDeleted = TellusNoteEngine.permanentlyDeleteNote(backupToDelete.backupFilename);
    assert.strictEqual(permanentlyDeleted, true, 'Permanent deletion must succeed');

    const trashFinal = TellusNoteEngine.listDeletedNotes();
    assert.strictEqual(trashFinal.some(t => t.backupFilename === backupToDelete.backupFilename), false);
  });

  it('8. Media & Attachment Storage with Wikilinks', () => {
    const dummyBuffer = Buffer.from('fake-image-bytes-tellus-test');
    const attachment = TellusNoteEngine.saveAttachment('diagrama_arquitetura.png', dummyBuffer);

    assert.ok(attachment.filename.startsWith('diagrama_arquitetura_'));
    assert.ok(attachment.wikilink.startsWith('![[diagrama_arquitetura_'));
    assert.ok(attachment.urlPath.includes('/api/notes/attachments/'));

    const physicalAttachment = path.join(TellusNoteEngine.ATTACHMENTS_DIR, attachment.filename);
    assert.ok(fs.existsSync(physicalAttachment), 'Attachment file must exist on disk');
  });

  it('9. GitSafe Privacy Sanitization on Note Save', () => {
    const rawContentWithSecret = `# Teste GitSafe Sanitization
Aqui está uma chave secreta que jamais deve ir para disco:
OPENAI_API_KEY=sk-proj-abc1234567890abcdef1234567890abcdef12345
ANTHROPIC_API_KEY=sk-ant-api03-abcdef1234567890abcdef1234567890`;

    const note = TellusNoteEngine.saveNote({
      title: 'Nota Com Segredos',
      folder: 'Seguranca',
      content: rawContentWithSecret
    });

    const fileContent = fs.readFileSync(path.join(TEST_VAULT_DIR, 'Seguranca', note.filename), 'utf-8');
    assert.strictEqual(fileContent.includes('sk-proj-abc1234567890'), false, 'Raw OpenAI key must be sanitized');
    assert.strictEqual(fileContent.includes('sk-ant-api03-abcdef'), false, 'Raw Anthropic key must be sanitized');
  });
});
