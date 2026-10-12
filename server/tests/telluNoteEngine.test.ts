import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test isolated vault directory
const TEST_VAULT_DIR = path.join(os.tmpdir(), `tellu_test_vault_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
process.env.TELLUS_VAULT_DIR = TEST_VAULT_DIR;

// Import TelluNoteEngine and backward compatibility aliases
import {
  TelluNoteEngine,
  TellusNoteEngine,
  FrankNoteEngine,
  NotesEngine,
  type TelluNote,
  type TellusNote,
  type TellusMDNote,
  type FrankNote
} from '../src/services/notes/telluNoteEngine.js';

// Import from backward compatibility forwarder
import {
  TelluNoteEngine as ForwardedTelluEngine,
  FrankNoteEngine as ForwardedFrankEngine
} from '../src/services/notes/frankNoteEngine.js';

describe('TelluNote Engine & Vault Verification Suite', () => {
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
    assert.strictEqual(TelluNoteEngine, TellusNoteEngine, 'TellusNoteEngine must be an exact alias of TelluNoteEngine');
    assert.strictEqual(TelluNoteEngine, FrankNoteEngine, 'FrankNoteEngine must be an exact alias of TelluNoteEngine');
    assert.strictEqual(NotesEngine, TelluNoteEngine, 'NotesEngine must reference TelluNoteEngine');
    assert.strictEqual(ForwardedTelluEngine, TelluNoteEngine, 'forwarder frankNoteEngine must re-export TelluNoteEngine');
    assert.strictEqual(ForwardedFrankEngine, TelluNoteEngine, 'forwarder frankNoteEngine must re-export FrankNoteEngine');
    assert.strictEqual(TelluNoteEngine.VAULT_DIR, TEST_VAULT_DIR, 'VAULT_DIR must resolve to the isolated test vault');

    // Type compatibility test
    const dummy: TelluNote = {
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
    const tellusDummy: TellusNote = dummy;
    const frankDummy: FrankNote = tellusDummy;
    const tellusMdDummy: TellusMDNote = frankDummy;
    assert.strictEqual(dummy.id, tellusMdDummy.id);
  });

  it('2. Client Component Standardization (TelluNoteView & FrankNoteView)', () => {
    const telluViewPath = path.resolve(process.cwd(), '../client/src/components/TelluNoteView.tsx');
    const frankViewPath = path.resolve(process.cwd(), '../client/src/components/FrankNoteView.tsx');

    assert.ok(fs.existsSync(telluViewPath), 'client/src/components/TelluNoteView.tsx must exist');
    assert.ok(fs.existsSync(frankViewPath), 'client/src/components/FrankNoteView.tsx must exist for backward compatibility');

    const telluContent = fs.readFileSync(telluViewPath, 'utf-8');
    assert.ok(telluContent.includes('export const TelluNoteView'), 'TelluNoteView component must be exported');
    assert.ok(telluContent.includes('export const FrankNoteView'), 'FrankNoteView alias must be exported');

    const frankContent = fs.readFileSync(frankViewPath, 'utf-8');
    assert.ok(frankContent.includes('TelluNoteView'), 'FrankNoteView must bridge to TelluNoteView');
  });

  it('3. Note Creation, Frontmatter, Wikilinks & Tags Parsing', () => {
    const sampleContent = `---
subject: Seguranca Web
tags:
  - webapp
  - autenticacao
---
# Modulo 01: Fundamentos de Seguranca

Aqui estao as anotacoes sobre seguranca em [[Modulo 02: Autenticacao]] e [[00_Roteiro]].
#owasp #appsec
`;

    const note = TelluNoteEngine.saveNote({
      title: 'Modulo 01: Fundamentos de Seguranca',
      folder: 'Estudos/Seguranca Web',
      content: sampleContent
    });

    assert.ok(note, 'Note must be created');
    assert.strictEqual(note.folder, 'Estudos/Seguranca Web');
    assert.strictEqual(note.title, 'Modulo 01: Fundamentos de Seguranca');
    assert.ok(note.links.includes('Modulo 02: Autenticacao'), 'Must extract outbound wikilink');
    assert.ok(note.links.includes('00_Roteiro'), 'Must extract outbound wikilink 00_Roteiro');
    assert.ok(note.tags.includes('#owasp'), 'Must extract tag #owasp');
    assert.ok(note.tags.includes('#appsec'), 'Must extract tag #appsec');

    // Verify physical file on disk inside the vault
    const expectedFilePath = path.join(TEST_VAULT_DIR, 'Estudos', 'Seguranca Web', note.filename);
    assert.ok(fs.existsSync(expectedFilePath), 'Note file must physically exist in vault');
  });

  it('4. Reciprocal Backlinks Computation & Knowledge Graph', () => {
    // Note A links to Note B
    const noteA = TelluNoteEngine.saveNote({
      title: 'Nota Origem A',
      folder: 'Geral',
      content: '# Nota Origem A\nLink para [[Nota Destino B]].'
    });

    // Note B
    const noteB = TelluNoteEngine.saveNote({
      title: 'Nota Destino B',
      folder: 'Geral',
      content: '# Nota Destino B\nConteudo da nota destino.'
    });

    const allNotes = TelluNoteEngine.listNotes();
    const loadedB = allNotes.find(n => n.id === noteB.id || n.title === 'Nota Destino B');
    assert.ok(loadedB, 'Note B must be found');
    assert.ok(loadedB.backlinks.includes('Nota Origem A') || loadedB.backlinks.includes(noteA.id),
      'Note B must have reciprocal backlink from Note A');

    // Graph Data
    const graph = TelluNoteEngine.getGraphData();
    assert.ok(graph.nodes.length >= 2, 'Graph must contain notes nodes');
    assert.ok(graph.links.length >= 1, 'Graph must contain connection links');
  });

  it('5. Full-Text Search, Snippets & Filtering', () => {
    TelluNoteEngine.saveNote({
      title: 'Pesquisa Especializada em Criptografia',
      folder: 'Criptografia',
      content: '# Pesquisa Especializada em Criptografia\nEstudo de cifras assimetricas e curvas elipticas RSA e ECC.'
    });

    const searchResults = TelluNoteEngine.searchNotes('elipticas');
    assert.ok(searchResults.length > 0, 'Search must find matching note');
    assert.strictEqual(searchResults[0].note.title, 'Pesquisa Especializada em Criptografia');
    assert.ok(searchResults[0].matchedSnippets.some(s => s.toLowerCase().includes('elipticas')),
      'Matched snippet must highlight searched term');
  });

  it('6. Folder Operations: Create, Move & Hierarchical Listing', () => {
    const created = TelluNoteEngine.createFolder('Projetos/Tellus/Frontend');
    assert.strictEqual(created, true, 'Folder creation must succeed');

    const folders = TelluNoteEngine.listFolders();
    assert.ok(folders.some(f => f.includes('Frontend')), 'Created folder must appear in folders list');

    // Move folder
    const moved = TelluNoteEngine.moveFolder('Projetos/Tellus/Frontend', 'Arquivados');
    assert.strictEqual(moved, true, 'Folder move must succeed');

    const updatedFolders = TelluNoteEngine.listFolders();
    assert.ok(updatedFolders.some(f => f.includes('Arquivados/Frontend')),
      'Moved folder must appear under new target parent');
  });

  it('7. Move Note Between Notebooks/Folders', () => {
    const note = TelluNoteEngine.saveNote({
      title: 'Nota Para Mover',
      folder: 'Inbox',
      content: '# Nota Para Mover\nEsta nota sera movida para Estudos.'
    });

    const movedNote = TelluNoteEngine.moveNote(note.id, 'Estudos/Backend');
    assert.ok(movedNote, 'Moving note must return updated note');
    assert.strictEqual(movedNote.folder, 'Estudos/Backend');

    // Check disk location
    const newDiskPath = path.join(TEST_VAULT_DIR, 'Estudos', 'Backend', note.filename);
    assert.ok(fs.existsSync(newDiskPath), 'File must be physically moved to new folder path');
  });

  it('8. Soft-Delete, Trash Bin Retention, Restore & Purge', () => {
    const note = TelluNoteEngine.saveNote({
      title: 'Nota Lixeira Teste',
      folder: 'Temp',
      content: '# Nota Lixeira Teste\nConteudo a ser excluido.'
    });

    // Delete note (Soft delete)
    const deleted = TelluNoteEngine.deleteNote(note.id);
    assert.strictEqual(deleted, true, 'Soft deletion must return true');

    // Check in trash list
    const trash = TelluNoteEngine.listDeletedNotes();
    const trashItem = trash.find(t => t.id === note.id);
    assert.ok(trashItem, 'Deleted note must exist in trash list');
    assert.strictEqual(trashItem.title, 'Nota Lixeira Teste');

    // Restore note
    const restored = TelluNoteEngine.restoreDeletedNote(trashItem.backupFilename);
    assert.ok(restored, 'Restoring deleted note must succeed');
    assert.strictEqual(restored.title, 'Nota Lixeira Teste');

    // Verify active notes contains restored note
    const reloadedActive = TelluNoteEngine.listNotes();
    assert.ok(reloadedActive.some(n => n.id === note.id), 'Active notes must contain restored note');

    // Delete again and test permanent deletion
    TelluNoteEngine.deleteNote(note.id);
    const trashAfterDelete = TelluNoteEngine.listDeletedNotes();
    const backupToDelete = trashAfterDelete.find(t => t.id === note.id);
    assert.ok(backupToDelete);

    const permanentlyDeleted = TelluNoteEngine.permanentlyDeleteNote(backupToDelete.backupFilename);
    assert.strictEqual(permanentlyDeleted, true, 'Permanent deletion must succeed');

    const trashFinal = TelluNoteEngine.listDeletedNotes();
    assert.strictEqual(trashFinal.some(t => t.backupFilename === backupToDelete.backupFilename), false);
  });

  it('9. Media & Attachment Storage with Wikilinks', () => {
    const dummyBuffer = Buffer.from('fake-image-bytes-tellu-test');
    const attachment = TelluNoteEngine.saveAttachment('diagrama_arquitetura.png', dummyBuffer);

    assert.ok(attachment.filename.startsWith('diagrama_arquitetura_'));
    assert.ok(attachment.wikilink.startsWith('![[diagrama_arquitetura_'));
    assert.ok(attachment.urlPath.includes('/api/notes/attachments/'));

    const physicalAttachment = path.join(TelluNoteEngine.ATTACHMENTS_DIR, attachment.filename);
    assert.ok(fs.existsSync(physicalAttachment), 'Attachment file must exist on disk');
  });

  it('10. GitSafe Privacy Sanitization on Note Save', () => {
    const rawContentWithSecret = `# Teste GitSafe Sanitization
Aqui está uma chave secreta que jamais deve ir para disco:
OPENAI_API_KEY=sk-proj-abc1234567890abcdef1234567890abcdef12345
ANTHROPIC_API_KEY=sk-ant-api03-abcdef1234567890abcdef1234567890`;

    const note = TelluNoteEngine.saveNote({
      title: 'Nota Com Segredos',
      folder: 'Seguranca',
      content: rawContentWithSecret
    });

    const fileContent = fs.readFileSync(path.join(TEST_VAULT_DIR, 'Seguranca', note.filename), 'utf-8');
    assert.strictEqual(fileContent.includes('sk-proj-abc1234567890'), false, 'Raw OpenAI key must be sanitized');
    assert.strictEqual(fileContent.includes('sk-ant-api03-abcdef'), false, 'Raw Anthropic key must be sanitized');
  });
});
