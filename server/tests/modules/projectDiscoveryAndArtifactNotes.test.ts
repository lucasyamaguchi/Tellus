import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_VAULT_DIR = path.join(os.tmpdir(), `tellus_test_vault_disc_${Date.now()}`);
const TEST_PROJECTS_DIR = path.join(os.tmpdir(), `tellus_test_projs_disc_${Date.now()}`);

process.env.TELLUS_VAULT_DIR = TEST_VAULT_DIR;
process.env.TELLUS_PROJECTS_DIR = TEST_PROJECTS_DIR;

import { TellusNoteEngine } from '../../src/services/notes/tellusNoteEngine.js';
import { ProjectManager } from '../../src/services/projectManager.js';
import { ConfigManager } from '../../src/services/configManager.js';

describe('🚀 Módulo: Descoberta de Projetos em E:\\Die-Sonne\\Projects & Rastreamento de Notas/Artefatos', () => {
  const dummyProj1 = path.join(TEST_PROJECTS_DIR, 'Kentron');
  const dummyProj2 = path.join(TEST_PROJECTS_DIR, 'CSNades');

  before(() => {
    fs.mkdirSync(TEST_VAULT_DIR, { recursive: true });
    fs.mkdirSync(TEST_PROJECTS_DIR, { recursive: true });

    // Setup dummy project Kentron with artifacts and notes
    fs.mkdirSync(path.join(dummyProj1, '.agentic', 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(dummyProj1, 'notes'), { recursive: true });
    fs.writeFileSync(
      path.join(dummyProj1, '.agentic', 'artifacts', 'visao_inicial_kentron.md'),
      '# Visão e plano inicial do Kentron\n\nHub pessoal para centralização de projetos e contexto com Tailscale.\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(dummyProj1, 'notes', 'regras_arquitetura.md'),
      '# Regras de Arquitetura Kentron\n\nEspecificações técnicas do Kentron.\n',
      'utf-8'
    );

    // Setup dummy project CSNades
    fs.mkdirSync(path.join(dummyProj2, 'src'), { recursive: true });
  });

  after(() => {
    try { fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(TEST_PROJECTS_DIR, { recursive: true, force: true }); } catch {}
    delete process.env.TELLUS_VAULT_DIR;
    delete process.env.TELLUS_PROJECTS_DIR;
  });

  it('1. ProjectManager: descobre subdiretórios no diretório padrão de projetos', () => {
    const root = ProjectManager.getProjectsRoot();
    assert.equal(path.resolve(root), path.resolve(TEST_PROJECTS_DIR));

    const discovered = ProjectManager.listDiscoveredProjects();
    const names = discovered.map(p => p.name);
    assert.ok(names.includes('Kentron'), 'Kentron deve ser descoberto');
    assert.ok(names.includes('CSNades'), 'CSNades deve ser descoberto');

    const kentron = discovered.find(p => path.resolve(p.path) === path.resolve(dummyProj1))!;
    assert.equal(kentron.hasAgentic, true);
    assert.equal(kentron.artifactsCount, 1);
  });

  it('2. TellusNoteEngine: lista artefatos (.agentic/artifacts) como notas do projeto ativo', () => {
    const notes = TellusNoteEngine.listNotes(dummyProj1);
    const artifactNote = notes.find(n => n.id === 'visao_inicial_kentron');

    assert.ok(artifactNote, 'Nota de artefato visao_inicial_kentron deve existir');
    assert.equal(artifactNote?.title, 'Visão e plano inicial do Kentron');
    assert.equal(artifactNote?.isProjectSpecific, true);
    assert.equal(artifactNote?.folder, 'Artefatos do Projeto');
    assert.ok(artifactNote?.relativePath.includes('visao_inicial_kentron.md'));
  });

  it('3. TellusNoteEngine.getNote: resolve por ID, título e relativePath de artefatos', () => {
    // Busca por ID
    const byId = TellusNoteEngine.getNote('visao_inicial_kentron', dummyProj1);
    assert.ok(byId, 'Deve resolver por ID direto');
    assert.equal(byId?.title, 'Visão e plano inicial do Kentron');

    // Busca por caminho relativo do link markdown no chat
    const byRelPath = TellusNoteEngine.getNote('.agentic/artifacts/visao_inicial_kentron.md', dummyProj1);
    assert.ok(byRelPath, 'Deve resolver por caminho relativo do link do chat');
    assert.equal(byRelPath?.id, 'visao_inicial_kentron');

    // Busca por Título
    const byTitle = TellusNoteEngine.getNote('Visão e plano inicial do Kentron', dummyProj1);
    assert.ok(byTitle, 'Deve resolver por Título exato');
  });

  it('4. ProjectManager.getProjectsGraphData: inclui projetos descobertos e artefatos no grafo', () => {
    const graphData = ProjectManager.getProjectsGraphData();
    assert.ok(Array.isArray(graphData.nodes), 'Nós devem ser um array');
    assert.ok(Array.isArray(graphData.links), 'Links devem ser um array');

    const projectNodes = graphData.nodes.filter(n => n.type === 'project');
    const projectLabels = projectNodes.map(n => n.label);
    assert.ok(projectLabels.some(l => l.includes('Kentron')), 'Nó de Kentron deve estar no grafo');
    assert.ok(projectLabels.some(l => l.includes('CSNades')), 'Nó de CSNades deve estar no grafo');

    const artifactNodes = graphData.nodes.filter(n => n.type === 'artifact');
    assert.ok(artifactNodes.some(n => n.label.includes('Visão e plano inicial do Kentron')), 'Artefato de Kentron deve estar conectado no grafo');
  });

  it('5. TellusNoteEngine: isolamento entre projetos e cofre global preservado', () => {
    // Adiciona nota no cofre global
    TellusNoteEngine.saveNote({
      title: 'Nota Geral do Vault',
      folder: 'Geral',
      content: '# Nota Geral do Vault\n\nConteúdo global.'
    });

    // Quando consulta CSNades (que não tem notas próprias)
    const notesCSNades = TellusNoteEngine.listNotes(dummyProj2);
    const hasGlobal = notesCSNades.some(n => n.title === 'Nota Geral do Vault');
    assert.ok(hasGlobal, 'Notas globais aparecem acessíveis');

    const hasKentron = notesCSNades.some(n => n.title === 'Visão e plano inicial do Kentron');
    assert.equal(hasKentron, false, 'Artefatos do Kentron não devem vazar para o projeto CSNades');
  });
});
