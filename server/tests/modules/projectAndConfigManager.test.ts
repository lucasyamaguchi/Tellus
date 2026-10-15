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
  let configBackup: string | null = null;
  const configPath = path.join(os.homedir(), '.tellus', 'config.json');

  before(() => {
    try {
      if (fs.existsSync(configPath)) {
        configBackup = fs.readFileSync(configPath, 'utf-8');
      }
    } catch {}

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

    // Restaura a configuração original do usuário para não poluir o Tellus com projetos temporários
    try {
      if (configBackup !== null) {
        fs.writeFileSync(configPath, configBackup, 'utf-8');
      }
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

  test('5. Persistência de Pipeline de Modelos Especializados (ConfigManager.pipeline)', () => {
    const pipelineConfig = {
      primaryModel: 'anthropic/claude-3.7-sonnet',
      plannerModel: 'deepseek/deepseek-r1',
      codingModel: 'anthropic/claude-3.7-sonnet',
      reasoningModel: 'openai/o3-mini',
      fastToolsModel: 'google/gemini-2.0-flash-001'
    };

    const updated = ConfigManager.updateConfig({
      pipeline: pipelineConfig
    });

    assert.deepEqual(updated.pipeline, pipelineConfig);

    // Relê diretamente do disco via getConfig()
    const reloaded = ConfigManager.getConfig();
    assert.deepEqual(reloaded.pipeline, pipelineConfig);
  });
});
