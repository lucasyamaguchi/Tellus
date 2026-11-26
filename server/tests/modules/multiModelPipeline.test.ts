import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentLoop } from '../../src/services/agentLoop.js';
import { ConfigManager, AgentPipelineConfig } from '../../src/services/configManager.js';
import { SessionManager, ChatSession } from '../../src/services/sessionManager.js';
import { FileTools } from '../../src/services/tools/fileTools.js';

describe('🧩 Módulo: Pipeline Multi-Modelo & Orquestração de Agentes Especialistas', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus-pipeline-test-'));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  test('1. Atribuição e persistência de múltiplos modelos no pipeline', () => {
    const pipelineConfig: AgentPipelineConfig = {
      primaryModel: 'anthropic/claude-3.7-sonnet',
      plannerModel: 'deepseek/deepseek-r1',
      codingModel: 'anthropic/claude-3.5-sonnet',
      reasoningModel: 'deepseek/deepseek-r1',
      fastToolsModel: 'google/gemini-2.0-flash-001'
    };

    // Atualiza via ConfigManager
    const updated = ConfigManager.updateConfig({ pipeline: pipelineConfig });
    assert.deepEqual(updated.pipeline, pipelineConfig);

    // Valida persistência em sessão independente
    const sessionObj: ChatSession = {
      id: 'session_pipeline_test_1',
      title: 'Tarefa de Teste Pipeline',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'anthropic/claude-3.7-sonnet',
      messages: [
        { role: 'user', content: 'Inicie a orquestração do pipeline multi-modelo' }
      ],
      pipeline: pipelineConfig
    };

    const saved = SessionManager.saveSession(tempDir, sessionObj);
    assert.ok(saved.id);
    assert.deepEqual(saved.pipeline, pipelineConfig);

    const reloaded = SessionManager.getSession(tempDir, 'session_pipeline_test_1');
    assert.equal(reloaded?.pipeline?.plannerModel, 'deepseek/deepseek-r1');
    assert.equal(reloaded?.pipeline?.codingModel, 'anthropic/claude-3.5-sonnet');
    assert.equal(reloaded?.pipeline?.fastToolsModel, 'google/gemini-2.0-flash-001');
  });

  test('2. Roteamento do Modelo de Estruturação e Planejamento (Passo 1)', () => {
    const pipeline: AgentPipelineConfig = {
      primaryModel: 'primary/coordinator-model',
      plannerModel: 'planner/architect-r1',
      codingModel: 'coder/claude-coder',
      fastToolsModel: 'fast/flash-reader'
    };

    // No passo 1, o modelo de estruturação deve ser o plannerModel
    const step1Resolution = AgentLoop.selectStepModel(1, undefined, 'fallback-model', pipeline);
    assert.equal(step1Resolution.model, 'planner/architect-r1');
    assert.equal(step1Resolution.role, 'planner');

    // Se houver apenas reasoningModel como planejador
    const pipelineReasoning: AgentPipelineConfig = {
      primaryModel: 'primary/coordinator-model',
      reasoningModel: 'reasoner/deepseek-r1'
    };
    const step1Reasoning = AgentLoop.selectStepModel(1, undefined, 'fallback-model', pipelineReasoning);
    assert.equal(step1Reasoning.model, 'reasoner/deepseek-r1');
    assert.equal(step1Reasoning.role, 'reasoning');
  });

  test('3. Roteamento do Modelo de Programação/Código após ferramentas de escrita', () => {
    const pipeline: AgentPipelineConfig = {
      primaryModel: 'primary/coordinator-model',
      plannerModel: 'planner/architect-r1',
      codingModel: 'coder/claude-coder',
      fastToolsModel: 'fast/flash-reader'
    };

    // Após file_write ou file_edit, o codingModel assume a continuidade
    const stepAfterWrite = AgentLoop.selectStepModel(2, 'file_write', 'fallback-model', pipeline);
    assert.equal(stepAfterWrite.model, 'coder/claude-coder');
    assert.equal(stepAfterWrite.role, 'coding');

    const stepAfterEdit = AgentLoop.selectStepModel(3, 'file_edit', 'fallback-model', pipeline);
    assert.equal(stepAfterEdit.model, 'coder/claude-coder');
    assert.equal(stepAfterEdit.role, 'coding');

    const stepAfterTerminal = AgentLoop.selectStepModel(4, 'terminal_exec', 'fallback-model', pipeline);
    assert.equal(stepAfterTerminal.model, 'coder/claude-coder');
    assert.equal(stepAfterTerminal.role, 'coding');
  });

  test('4. Roteamento do Modelo Fast Tools para leitura de arquivos e notas', () => {
    const pipeline: AgentPipelineConfig = {
      primaryModel: 'primary/coordinator-model',
      plannerModel: 'planner/architect-r1',
      codingModel: 'coder/claude-coder',
      fastToolsModel: 'fast/flash-reader'
    };

    const stepAfterRead = AgentLoop.selectStepModel(2, 'file_read', 'fallback-model', pipeline);
    assert.equal(stepAfterRead.model, 'fast/flash-reader');
    assert.equal(stepAfterRead.role, 'fast_tools');

    const stepAfterNoteSearch = AgentLoop.selectStepModel(3, 'note_search', 'fallback-model', pipeline);
    assert.equal(stepAfterNoteSearch.model, 'fast/flash-reader');
    assert.equal(stepAfterNoteSearch.role, 'fast_tools');
  });

  test('5. Fallback gracioso para Primary Model e sem pipeline', () => {
    const pipeline: AgentPipelineConfig = {
      primaryModel: 'primary/coordinator-model'
    };

    // Sem ferramentas especializadas configuradas, usa o primary
    const resPlanner = AgentLoop.selectStepModel(1, undefined, 'fallback-model', pipeline);
    assert.equal(resPlanner.model, 'primary/coordinator-model');
    assert.equal(resPlanner.role, 'primary');

    // Sem pipeline definido, usa o modelo base fornecido
    const resNoPipeline = AgentLoop.selectStepModel(1, undefined, 'base-default-model', undefined);
    assert.equal(resNoPipeline.model, 'base-default-model');
    assert.equal(resNoPipeline.role, 'primary');
  });

  test('6. Execução de uma task simples com verificação de escrita de arquivos e integridade', () => {
    // Task simples: Criação de arquivo de arquitetura de projeto
    const testFilePath = path.join(tempDir, 'src', 'greet.ts');
    const content = 'export function greet(name: string): string {\n  return `Olá, ${name}!`;\n}\n';

    const writeResult = FileTools.writeFile(tempDir, 'src/greet.ts', content);
    assert.equal(writeResult.success, true);
    assert.ok(fs.existsSync(testFilePath));

    const readResult = FileTools.readFile(tempDir, 'src/greet.ts');
    assert.equal(readResult.content, content);
    assert.ok(readResult.size > 0);
  });
});
