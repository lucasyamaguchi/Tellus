import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SkillManager } from '../../src/services/skills/skillManager.js';
import { ObsidianPluginManager } from '../../src/services/obsidian/obsidianPluginManager.js';

describe('🧩 Módulo: Obsidian Plugins & Markdown Skills Recognition', () => {
  const tempTestDir = path.join(os.tmpdir(), 'tellus_obsidian_skills_test_' + Date.now());
  const tempVaultDir = path.join(tempTestDir, 'Vault');
  const tempProjectDir = path.join(tempTestDir, 'Project');

  before(() => {
    fs.mkdirSync(tempVaultDir, { recursive: true });
    fs.mkdirSync(tempProjectDir, { recursive: true });
  });

  after(() => {
    try {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Importação de Markdown Skill com Frontmatter e Escopo Global', () => {
    const rawMarkdown = `---
name: "Clean Architecture Principles"
description: "Diretrizes de arquitetura limpa e desacoplamento para sistemas resilientes"
category: "Architecture"
scope: global
---
# Clean Architecture

Instruções para o agente seguir padrões de inversão de dependência e desacoplamento.
`;

    const imported = SkillManager.importMarkdownSkill(
      'clean-arch.md',
      rawMarkdown,
      false,
      tempProjectDir,
      'global'
    );

    assert.ok(imported.id);
    assert.strictEqual(imported.name, 'Clean Architecture Principles');
    assert.strictEqual(imported.category, 'Architecture');
    assert.strictEqual(imported.scope, 'global');
    assert.strictEqual(imported.isProjectSpecific, false);
    assert.strictEqual(imported.isActive, true);
  });

  it('2. Importação de Markdown Skill com Escopo de Projeto', () => {
    const rawMarkdown = `---
name: "CSNades Grenade Strategy"
description: "Rotinas e cálculos táticos para lançamento de granadas em Mirage e Inferno"
category: "Gaming"
scope: project
---
# CSNades Tactics

Execute rotinas especializadas de cálculo balístico.
`;

    const imported = SkillManager.importMarkdownSkill(
      'SKILL.md',
      rawMarkdown,
      true,
      tempProjectDir,
      'project'
    );

    assert.strictEqual(imported.name, 'CSNades Grenade Strategy');
    assert.strictEqual(imported.scope, 'project');
    assert.strictEqual(imported.isProjectSpecific, true);

    const projSkillFile = path.join(tempProjectDir, '.agentic', 'skills', `${imported.id}.json`);
    assert.ok(fs.existsSync(projSkillFile), 'Skill de projeto deve ser salva em .agentic/skills/');
  });

  it('3. Importação de Markdown Skill com Escopo Situacional', () => {
    const rawMarkdown = `# Security Incident Response
Quando houver suspeita de invasão ou vazamento de chaves, isole o nó e analise os logs.
`;

    const imported = SkillManager.importMarkdownSkill(
      'security-incident.md',
      rawMarkdown,
      false,
      tempProjectDir,
      'situational'
    );

    assert.strictEqual(imported.name, 'Security Incident Response');
    assert.strictEqual(imported.scope, 'situational');
    assert.strictEqual(imported.isActive, false, 'Skill situacional inicia desativada por padrão');
  });

  it('4. Obsidian Plugin Manager: Recomendações Curadas', () => {
    const recs = ObsidianPluginManager.listCuratedRecommendations(tempVaultDir);
    assert.ok(Array.isArray(recs));
    assert.ok(recs.length >= 6);

    const dataview = recs.find(r => r.id === 'dataview');
    assert.ok(dataview, 'Dataview deve estar nas recomendações');
    assert.strictEqual(dataview?.repo, 'blacksmithgu/obsidian-dataview');

    const git = recs.find(r => r.id === 'obsidian-git');
    assert.ok(git, 'Obsidian Git deve estar nas recomendações');
  });

  it('5. Obsidian Plugin Manager: Ativação e Desativação (togglePlugin)', () => {
    // Mock an installed plugin directory
    const pluginDir = path.join(tempVaultDir, '.obsidian', 'plugins', 'test-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test plugin description',
      author: 'Lucas'
    }));
    fs.writeFileSync(path.join(pluginDir, 'main.js'), 'console.log("loaded");');

    // List installed
    const installed = ObsidianPluginManager.listInstalledPlugins(tempVaultDir);
    const found = installed.find(p => p.id === 'test-plugin');
    assert.ok(found, 'test-plugin deve ser listado como instalado');
    assert.strictEqual(found?.hasMainJs, true);
    assert.strictEqual(found?.enabled, false);

    // Toggle on
    ObsidianPluginManager.togglePlugin('test-plugin', true, tempVaultDir);
    const updatedOn = ObsidianPluginManager.listInstalledPlugins(tempVaultDir);
    assert.strictEqual(updatedOn.find(p => p.id === 'test-plugin')?.enabled, true);

    // Toggle off
    ObsidianPluginManager.togglePlugin('test-plugin', false, tempVaultDir);
    const updatedOff = ObsidianPluginManager.listInstalledPlugins(tempVaultDir);
    assert.strictEqual(updatedOff.find(p => p.id === 'test-plugin')?.enabled, false);
  });
});
