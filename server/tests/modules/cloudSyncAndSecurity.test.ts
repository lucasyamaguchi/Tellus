import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { SecurityShield } from '../../src/services/sync/securityShield.js';
import { PrivacySanitizer } from '../../src/services/security/privacySanitizer.js';

describe('☁️ Módulo: Tellus Cloud Sync, Criptografia AES-256-GCM & Segurança 2FA (v1.0)', () => {
  let tempTestDir: string;
  const userMasterSecret = 'MinhaSuperChaveMestraTellus2026!#@';
  const wrongSecret = 'ChaveErradaInvalida12345';
  const testAccountEmail = 'usuario.tellus@gmail.com';

  before(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_cloud_test_'));
  });

  after(() => {
    try {
      if (fs.existsSync(tempTestDir)) {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('1. Criptografia AES-256-GCM de Notas com Chave 2FA', () => {
    const originalContent = `# Anotação Confidencial de Arquitetura\n\nDetalhes de microsserviços e tokens de acesso.\n`;
    
    // Encrypt
    const encrypted = SecurityShield.encryptNoteContent(originalContent, userMasterSecret);
    assert.ok(encrypted.encrypted, 'O payload deve estar marcado como encriptado');
    assert.ok(encrypted.ciphertext.length > 0, 'O ciphertext não pode ser vazio');
    assert.ok(encrypted.iv.length > 0, 'O IV (Initialization Vector) deve ser gerado');
    assert.ok(encrypted.tag.length > 0, 'A Auth Tag GCM deve ser gerada');
    assert.strictEqual(encrypted.ciphertext.includes('Confidencial'), false, 'O texto original não pode vazar no ciphertext');

    // Decrypt with correct key
    const decrypted = SecurityShield.decryptNoteContent(encrypted, userMasterSecret);
    assert.strictEqual(decrypted, originalContent, 'A nota decriptada com a chave correta deve coincidir perfeitamente');
  });

  it('2. Rejeição de Descriptografia com Chave 2FA Incorreta ou Adulterada', () => {
    const sensitiveDoc = 'Plano Estratégico Ultrassecreto Tellus 2026';
    const encrypted = SecurityShield.encryptNoteContent(sensitiveDoc, userMasterSecret);

    // Attempt decrypt with wrong key
    assert.throws(() => {
      SecurityShield.decryptNoteContent(encrypted, wrongSecret);
    }, /authenticate|unsupported state|decryption|autenticação/i, 'Chave 2FA incorreta deve falhar na autenticação GCM');

    // Tamper with ciphertext
    const tamperedPayload = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -4) + 'AAAA'
    };

    assert.throws(() => {
      SecurityShield.decryptNoteContent(tamperedPayload, userMasterSecret);
    }, /authenticate|unsupported state|decryption|tag|tamper/i, 'Ciphertext adulterado deve ser rejeitado pela Auth Tag GCM');
  });

  it('3. Isolamento e Identificação Criptográfica por Hash de Conta (Google / Microsoft)', () => {
    const accountHashA = SecurityShield.hashAccountIdentifier(testAccountEmail);
    const accountHashB = SecurityShield.hashAccountIdentifier('outro.usuario@gmail.com');
    const accountHashAUppercase = SecurityShield.hashAccountIdentifier('USUARIO.TELLUS@GMAIL.COM');

    assert.ok(accountHashA.length >= 32, 'O hash de conta deve ser robusto (SHA-256)');
    assert.notStrictEqual(accountHashA, accountHashB, 'Contas diferentes devem produzir hashes distintos');
    assert.strictEqual(accountHashA, accountHashAUppercase, 'O hash deve ser normalizado e insensível a maiúsculas');
    assert.strictEqual(accountHashA.includes(testAccountEmail), false, 'O hash não deve expor o e-mail em texto puro');
  });

  it('4. Monitoramento de Cota de Armazenamento e Alerta de Limite', () => {
    // Test storage threshold evaluation
    const safeUsage = SecurityShield.evaluateStorageThreshold(500 * 1024 * 1024, 15 * 1024 * 1024 * 1024); // 500MB de 15GB
    assert.strictEqual(safeUsage.isNearLimit, false, '500MB em 15GB não deve estar próximo do limite');
    assert.strictEqual(safeUsage.status, 'safe');

    const warningUsage = SecurityShield.evaluateStorageThreshold(13.5 * 1024 * 1024 * 1024, 15 * 1024 * 1024 * 1024); // 90%
    assert.strictEqual(warningUsage.isNearLimit, true, '90% de uso deve disparar alerta de limite');
    assert.strictEqual(warningUsage.percentage >= 90, true);
    assert.strictEqual(warningUsage.status, 'warning');

    const criticalUsage = SecurityShield.evaluateStorageThreshold(14.8 * 1024 * 1024 * 1024, 15 * 1024 * 1024 * 1024); // 98%
    assert.strictEqual(criticalUsage.isNearLimit, true);
    assert.strictEqual(criticalUsage.status, 'critical');
  });

  it('5. Higienização GitSafe Ativa em Payloads de Notas para a Nuvem', () => {
    const rawNoteWithSecret = `# Nota Sincronizada\nMinha chave secreta: sk-proj-1234567890abcdef1234567890abcdef1234567890\n`;
    
    // Test sanitization before syncing
    const sanitizedReport = PrivacySanitizer.sanitizeText(rawNoteWithSecret);
    assert.strictEqual(sanitizedReport.redactedCount, 1, 'Deve detectar a chave');
    assert.ok(sanitizedReport.sanitized.includes('[REDACTED_API_KEY_OPENAI]'));
    assert.strictEqual(sanitizedReport.sanitized.includes('sk-proj-1234567890'), false);
  });
});
