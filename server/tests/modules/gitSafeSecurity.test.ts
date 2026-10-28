import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PrivacySanitizer } from '../../src/services/security/privacySanitizer.js';

describe('🛡️ Módulo 3: GitSafe Privacy, Sanitização & Segurança', () => {
  let tempRepoDir: string;

  before(() => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_gitsafe_test_'));
  });

  after(() => {
    try {
      if (fs.existsSync(tempRepoDir)) {
        fs.rmSync(tempRepoDir, { recursive: true, force: true });
      }
    } catch {}
  });

  test('1. Detecção e ofuscação de chaves Anthropic Claude API Key', () => {
    const raw = 'Minha chave da Anthropic é sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890_ABCD-1234567890 no arquivo';
    const result = PrivacySanitizer.sanitizeText(raw);
    assert.ok(result.redactedCount > 0);
    assert.ok(result.sanitized.includes('[REDACTED_API_KEY_ANTHROPIC]'));
    assert.ok(!result.sanitized.includes('sk-ant-api03-abcdef'));
  });

  test('2. Detecção e ofuscação de chaves OpenAI API Key', () => {
    const raw = 'Token de acesso: sk-proj-1234567890abcdefghijklmnopqrstuvwxyz1234567890 para o modelo GPT-4o';
    const result = PrivacySanitizer.sanitizeText(raw);
    assert.ok(result.redactedCount > 0);
    assert.ok(result.sanitized.includes('[REDACTED_API_KEY_OPENAI]'));
    assert.ok(!result.sanitized.includes('sk-proj-1234567890'));
  });

  test('3. Detecção e ofuscação de tokens do GitHub e chaves genéricas', () => {
    const rawGithub = 'Deploy token: ghp_1234567890abcdefghijklmnopqrstuvwxyz12';
    const result = PrivacySanitizer.sanitizeText(rawGithub);
    assert.ok(result.redactedCount > 0);
    assert.ok(result.sanitized.includes('[REDACTED_GITHUB_TOKEN]'));

    const rawPassword = 'db_password="SuperSecretPassword123!"';
    const resultPw = PrivacySanitizer.sanitizeText(rawPassword);
    assert.ok(resultPw.redactedCount > 0);
    assert.ok(resultPw.sanitized.includes('[REDACTED_PASSWORD]'));
  });

  test('4. Preservação de texto limpo e código normal sem segredos', () => {
    const code = `
function calculateTotal(items: number[]): number {
  return items.reduce((acc, curr) => acc + curr, 0);
}
console.log("Olá Mundo, Tellus está 100% seguro!");
`;
    const result = PrivacySanitizer.sanitizeText(code);
    assert.equal(result.redactedCount, 0);
    assert.equal(result.sanitized, code);
  });

  test('5. Auditoria de repositório GitSafe (auditGitSafe)', () => {
    // 1. Criar um .gitignore seguro
    fs.writeFileSync(path.join(tempRepoDir, '.gitignore'), 'node_modules\n.env\ndist\n.agentic/attachments\n', 'utf-8');

    const report = PrivacySanitizer.auditGitSafe(tempRepoDir);
    assert.ok(typeof report.score === 'number');
    assert.ok(Array.isArray(report.items));
    assert.ok(report.items.length >= 3);

    const gitignoreItem = report.items.find(i => i.name.includes('.gitignore'));
    assert.ok(gitignoreItem);
    assert.equal(gitignoreItem?.passed, true);
  });

  test('6. Verificação de Skill e Rotina GitSafe nativa no Tellus', async () => {
    const { SkillManager } = await import('../../src/services/skills/skillManager.js');
    const { ConfigManager } = await import('../../src/services/configManager.js');

    const globalSkills = SkillManager.listSkills();
    const gitsafeSkill = globalSkills.find((s: any) => s.id === 'gitsafe-routine');
    assert.ok(gitsafeSkill, 'Skill gitsafe-routine deve estar nas skills globais do Tellus');
    assert.strictEqual(gitsafeSkill.category, 'Security & Governance');

    const config = ConfigManager.getConfig();
    const gitsafeRoutine = config.customRoutines?.find((r: any) => r.id === 'gitsafe_auditor');
    assert.ok(gitsafeRoutine, 'Rotina gitsafe_auditor deve estar registrada nas rotinas padrão do Tellus');
  });
});
