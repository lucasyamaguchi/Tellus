import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TelluNoteEngine } from '../../src/services/notes/telluNoteEngine.js';
import { sanitizePortugueseText } from '../../src/services/agentLoop.js';

describe('📝 Classificação por Conteúdos: Integridade do Markdown, Português & Wikilinks', () => {
  let tempProjectDir: string;

  before(() => {
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_content_test_'));
  });

  after(() => {
    try {
      if (fs.existsSync(tempProjectDir)) {
        fs.rmSync(tempProjectDir, { recursive: true, force: true });
      }
    } catch {}
  });

  test('1. Preservação de Acentuação e Caracteres Especiais em Português', () => {
    const rawPortuguese = 'Atenção às configurações de autenticação e proteção de dados contínuos.';
    const sanitized = sanitizePortugueseText(rawPortuguese);
    assert.equal(sanitized, rawPortuguese);

    const note = TelluNoteEngine.saveNote({
      title: 'Segurança e Proteção de Aplicações',
      subject: 'Segurança',
      content: '# Segurança e Proteção de Aplicações\n\nAplicações com autenticação multifator são essenciais.',
      isProjectSpecific: true
    }, tempProjectDir);

    const allNotes = TelluNoteEngine.listNotes();
    const readNote = allNotes.find(n => n.id === note.id);
    assert.ok(readNote);
    assert.equal(readNote?.title, 'Segurança e Proteção de Aplicações');
    assert.ok(readNote?.content.includes('autenticação multifator'));
  });

  test('2. Parsing e Resolução de Wikilinks com Aliases ([[Alvo|Alias]])', () => {
    const noteTarget = TelluNoteEngine.saveNote({
      title: 'Banco de Dados',
      subject: 'Infra',
      content: '# Banco de Dados\nConfiguração do PostgreSQL e índices.',
      isProjectSpecific: true
    }, tempProjectDir);

    const noteSource = TelluNoteEngine.saveNote({
      title: 'API Backend',
      subject: 'Backend',
      content: '# API Backend\nConsulte a documentação do [[Banco de Dados]] e também [[Banco de Dados|Postgres Local]].',
      isProjectSpecific: true
    }, tempProjectDir);

    assert.ok(noteSource.links.includes('Banco de Dados'));

    // Verifica backlinks recíprocos
    const allNotes = TelluNoteEngine.listNotes();
    const updatedTarget = allNotes.find(n => n.id === noteTarget.id);
    assert.ok(updatedTarget?.backlinks.includes('API Backend') || updatedTarget?.backlinks.includes(noteSource.id));
  });

  test('3. Estruturas Complexas de Markdown: Tabelas, Fenced Code Blocks & KaTeX Math', () => {
    const complexContent = `
# Relatório de Métricas

| Módulo | Latência | Status |
| :--- | :--- | :--- |
| TelluNote Vault | 12ms | Operacional |
| Memory Palace | 8ms | Operacional |

\`\`\`typescript
interface Metric {
  id: string;
  val: number;
}
\`\`\`

Fórmula de complexidade temporal: $O(N \\log N)$ e KaTeX display:
$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$
`;

    const note = TelluNoteEngine.saveNote({
      title: 'Métricas de Sistema',
      subject: 'Engenharia',
      content: complexContent,
      isProjectSpecific: true
    }, tempProjectDir);

    const allNotes = TelluNoteEngine.listNotes();
    const reloaded = allNotes.find(n => n.id === note.id);
    assert.ok(reloaded?.content.includes('| Módulo | Latência | Status |'));
    assert.ok(reloaded?.content.includes('interface Metric'));
    assert.ok(reloaded?.content.includes('$O(N \\log N)$'));
  });

  test('4. Sanitização GitSafe de Segredos em Notas preservando Markdown legítimo', () => {
    const contentWithSecret = `# Anotações de Deploy
Para autenticar na nuvem use:
sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890_ABCD-1234567890
Conteúdo legítimo com **negrito** e [links](https://github.com).`;

    const note = TelluNoteEngine.saveNote({
      title: 'Notas com Segredos',
      subject: 'Segurança',
      content: contentWithSecret,
      isProjectSpecific: true
    }, tempProjectDir);

    assert.ok(note);
    assert.ok(note.content.includes('[REDACTED_API_KEY_ANTHROPIC]'));
    assert.ok(!note.content.includes('sk-ant-api03-abcdef'));
    assert.ok(note.content.includes('**negrito**'));
    assert.ok(note.content.includes('[links](https://github.com)'));
  });
});
