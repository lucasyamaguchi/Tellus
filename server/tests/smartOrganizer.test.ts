import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FrankNoteEngine, TellusNoteEngine } from '../src/services/notes/frankNoteEngine.js';
import { SmartOrganizer } from '../src/services/notes/smartOrganizer.js';

describe('TellusMD Smart Organizer - Content Analysis & Categorization', () => {
  it('1. Name and Path Sanitization', () => {
    // Sanitize note name
    const rawName = 'Estudo: Seguranca & Pentest / Web? * [2026]';
    const sanitized = TellusNoteEngine.sanitizeName(rawName);
    assert.strictEqual(sanitized.includes(':'), false);
    assert.strictEqual(sanitized.includes('/'), false);
    assert.strictEqual(sanitized.includes('?'), false);
    assert.strictEqual(sanitized.includes('*'), false);

    // Sanitize folder path with slash hierarchy
    const rawPath = 'Estudos - Seguranca - Web / Backend';
    const cleanPath = TellusNoteEngine.sanitizePath(rawPath);
    assert.strictEqual(cleanPath, 'Estudos/Seguranca/Web/Backend');
  });

  it('2. Portuguese Language Normalization Guardrail', () => {
    const rawSpanish = 'Arquitectura de Microservicios: Conceptos y Patrones de Diseño con Ejercicios y Autenticación';
    const normalized = TellusNoteEngine.normalizePortuguese(rawSpanish);

    assert.ok(normalized.includes('Arquitetura'));
    assert.ok(!normalized.includes('Arquitectura'));
    assert.ok(normalized.includes('Microsserviços'));
    assert.ok(!normalized.includes('Microservicios'));
    assert.ok(normalized.includes('Conceitos'));
    assert.ok(!normalized.includes('Conceptos'));
    assert.ok(normalized.includes('Padrões de Projeto'));
    assert.ok(!normalized.includes('Patrones de Diseño'));
    assert.ok(normalized.includes('Exercícios'));
    assert.ok(!normalized.includes('Ejercicios'));
  });

  it('3. Existing Folders Discovery', () => {
    const folders = SmartOrganizer.listExistingFolders();
    assert.ok(Array.isArray(folders));
    assert.ok(folders.length > 0);
  });
});
