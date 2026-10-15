import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectManager } from '../../src/services/projectManager.js';
import { ConfigManager } from '../../src/services/configManager.js';

describe('📁 Módulo 8: ProjectManager & ConfigManager Multi-Projeto', () => {
  let projectA: string;
  let projectB: string;

  before(() => {
    projectA = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_pm_a_'));
    projectB = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_pm_b_'));
    // Criar arquivos de exemplo
    fs.writeFileSync(path.join(projectA, 'index.ts'), 'console.log("Project A");');
    fs.writeFileSync(path.join(projectB, 'main.rs'), 'fn main() { println!("Project B"); }');
  });

  after(() => {
    try {
      if (fs.existsSync(projectA)) fs.rmSync(projectA, { recursive: true, force: true });
      if (fs.existsSync(projectB)) fs.rmSync(projectB, { recursive: true, force: true });
    } catch {}
  });

  test('1. Abertura e registro de projeto com inicialização de memória', () => {
    const res = ProjectManager.openProject(projectA);
    assert.equal(res.success, true);
    assert.equal(path.resolve(res.path), path.resolve(projectA));

    const overview = ProjectManager.getProjectOverview(projectA);
    assert.equal(overview.name, path.basename(projectA));
    assert.ok(fs.existsSync(path.join(projectA, '.agentic', 'memory')));
    assert.ok(fs.existsSync(path.join(projectA, '.agentic', 'palace')));
  });

  test('2. Rastreamento de múltiplos projetos abertos (openProjects)', () => {
    ProjectManager.openProject(projectA);
    ProjectManager.openProject(projectB);

    const openList = ProjectManager.getOpenProjects();
    const resolvedList = openList.map(p => path.resolve(p));
    assert.ok(resolvedList.includes(path.resolve(projectA)));
    assert.ok(resolvedList.includes(path.resolve(projectB)));
  });

  test('3. Fechamento de projeto dos abertos (closeOpenProject)', () => {
    // Garante que o projeto ativo não seja o B antes de fechar o B
    ProjectManager.openProject(projectA);
    const res = ProjectManager.closeOpenProject(projectB);
    assert.equal(res.success, true);

    const openList = ProjectManager.getOpenProjects();
    const resolvedList = openList.map(p => path.resolve(p));
    assert.ok(!resolvedList.includes(path.resolve(projectB)));
  });

  test('4. Atualização e persistência de configurações globais do Tellus (ConfigManager)', () => {
    const initialConfig = ConfigManager.getConfig();
    assert.ok(initialConfig);

    const updated = ConfigManager.updateConfig({
      theme: 'dark',
      locale: 'pt-BR',
      enforceStrictLanguage: true
    });

    assert.equal(updated.theme, 'dark');
    assert.equal(updated.locale, 'pt-BR');
    assert.equal(updated.enforceStrictLanguage, true);
  });
});
