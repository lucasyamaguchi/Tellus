import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectSettingsManager, DEFAULT_PROJECT_SETTINGS } from '../../src/services/projectSettingsManager.js';
import { AgentLoop } from '../../src/services/agentLoop.js';

test('🛡️ Módulo: Project Settings & Execution Security Presets', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus-settings-test-'));

  t.after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  await t.test('1. Retorna configurações padrão quando .agentic/project_settings.json não existe', () => {
    const settings = ProjectSettingsManager.getSettings(tempDir);
    assert.equal(settings.securityPreset, DEFAULT_PROJECT_SETTINGS.securityPreset);
    assert.equal(settings.planReviewPolicy, DEFAULT_PROJECT_SETTINGS.planReviewPolicy);
    assert.equal(settings.fileAccess.readAllowed, true);
    assert.equal(settings.fileAccess.writeAllowed, true);
    assert.ok(settings.fileAccess.deniedPaths.includes('.env'));
    assert.equal(settings.terminal.allowed, true);
  });

  await t.test('2. Salva e recupera configurações customizadas do projeto', () => {
    const custom = ProjectSettingsManager.saveSettings(tempDir, {
      securityPreset: 'turbo',
      planReviewPolicy: 'always_proceed',
      fileAccess: {
        readAllowed: true,
        writeAllowed: false,
        deniedPaths: ['.env', 'secrets.json']
      },
      terminal: {
        allowed: false,
        deniedCommands: ['rm -rf', 'drop']
      }
    });

    assert.equal(custom.securityPreset, 'turbo');
    assert.equal(custom.planReviewPolicy, 'always_proceed');
    assert.equal(custom.fileAccess.writeAllowed, false);
    assert.equal(custom.terminal.allowed, false);

    const reloaded = ProjectSettingsManager.getSettings(tempDir);
    assert.equal(reloaded.securityPreset, 'turbo');
    assert.equal(reloaded.planReviewPolicy, 'always_proceed');
    assert.equal(reloaded.fileAccess.writeAllowed, false);
    assert.equal(reloaded.terminal.allowed, false);
    assert.deepEqual(reloaded.fileAccess.deniedPaths, ['.env', 'secrets.json']);
  });

  await t.test('3. Resolução hierárquica de modo de execução (Chat > Projeto > Global)', () => {
    // 3a. Chat explícito sobrepõe o projeto
    const effChat = ProjectSettingsManager.resolveEffectiveSecurity('request_review', tempDir);
    assert.equal(effChat.preset, 'request_review');
    assert.equal(effChat.source, 'chat');

    // 3b. Chat herdando ('inherit') usa configuração do projeto ('turbo')
    const effProject = ProjectSettingsManager.resolveEffectiveSecurity('inherit', tempDir);
    assert.equal(effProject.preset, 'turbo');
    assert.equal(effProject.source, 'project');

    // 3c. Se o projeto também for 'inherit', cai no global
    ProjectSettingsManager.saveSettings(tempDir, { securityPreset: 'inherit' });
    const effGlobal = ProjectSettingsManager.resolveEffectiveSecurity('inherit', tempDir);
    assert.equal(effGlobal.source, 'global');
    assert.ok(['default', 'turbo', 'request_review'].includes(effGlobal.preset));
  });

  await t.test('4. Validação de regras de acesso a arquivos (Denied Paths & Read/Write Toggles)', () => {
    ProjectSettingsManager.saveSettings(tempDir, {
      fileAccess: {
        readAllowed: true,
        writeAllowed: true,
        deniedPaths: ['.env', '*.pem', 'node_modules']
      }
    });

    // Leitura permitida para arquivo comum
    const normalRead = ProjectSettingsManager.checkFileAccess(tempDir, 'src/index.ts', 'read');
    assert.equal(normalRead.allowed, true);

    // Leitura bloqueada para .env
    const envRead = ProjectSettingsManager.checkFileAccess(tempDir, '.env', 'read');
    assert.equal(envRead.allowed, false);

    // Leitura bloqueada para *.pem
    const pemRead = ProjectSettingsManager.checkFileAccess(tempDir, 'certs/server.pem', 'read');
    assert.equal(pemRead.allowed, false);

    // Escrita bloqueada quando writeAllowed = false
    ProjectSettingsManager.saveSettings(tempDir, {
      fileAccess: {
        readAllowed: true,
        writeAllowed: false,
        deniedPaths: ['.env']
      }
    });
    const writeCheck = ProjectSettingsManager.checkFileAccess(tempDir, 'src/app.ts', 'write');
    assert.equal(writeCheck.allowed, false);
    assert.ok(writeCheck.reason?.includes('Modificação'));
  });

  await t.test('5. Validação de execução de terminal (Terminal Allowed & Denied Commands)', () => {
    ProjectSettingsManager.saveSettings(tempDir, {
      terminal: {
        allowed: true,
        deniedCommands: ['rm -rf', 'format', 'mkfs']
      }
    });

    // Comando seguro permitido
    const safeCmd = ProjectSettingsManager.checkTerminalCommand(tempDir, 'npm test');
    assert.equal(safeCmd.allowed, true);

    // Comando na lista restrita bloqueado
    const dangerCmd = ProjectSettingsManager.checkTerminalCommand(tempDir, 'rm -rf /');
    assert.equal(dangerCmd.allowed, false);
    assert.ok(dangerCmd.reason?.includes('bloqueado'));

    // Terminal completamente desativado
    ProjectSettingsManager.saveSettings(tempDir, {
      terminal: {
        allowed: false,
        deniedCommands: []
      }
    });
    const disabledTerminal = ProjectSettingsManager.checkTerminalCommand(tempDir, 'git status');
    assert.equal(disabledTerminal.allowed, false);
    assert.ok(disabledTerminal.reason?.includes('desativada'));
  });

  await t.test('6. AgentLoop.executeTool respeita bloqueios de segurança do projeto', async () => {
    ProjectSettingsManager.saveSettings(tempDir, {
      fileAccess: {
        readAllowed: true,
        writeAllowed: false,
        deniedPaths: ['.env']
      },
      terminal: {
        allowed: false,
        deniedCommands: []
      }
    });

    // Tentativa de leitura de .env bloqueada
    const readEnvRes = await AgentLoop.executeTool(tempDir, 'read_file', JSON.stringify({ path: '.env' }), 'test-model');
    assert.ok(readEnvRes.error);
    assert.ok(readEnvRes.error.includes('bloqueado') || readEnvRes.error.includes('configurações'));

    // Tentativa de escrita bloqueada
    const writeRes = await AgentLoop.executeTool(tempDir, 'write_file', JSON.stringify({ path: 'test.txt', content: 'hello' }), 'test-model');
    assert.ok(writeRes.error);

    // Tentativa de comando no terminal bloqueada
    const cmdRes = await AgentLoop.executeTool(tempDir, 'run_command', JSON.stringify({ command: 'echo hello' }), 'test-model');
    assert.ok(cmdRes.error);
  });
});
