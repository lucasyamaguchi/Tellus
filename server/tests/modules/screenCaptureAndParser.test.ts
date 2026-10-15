import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ScreenCapture } from '../../src/services/tools/screenCapture.js';
import { FileParser } from '../../src/services/tools/fileParser.js';

describe('🖥️ Módulo 5: Captura de Tela & Parser Multimodal', () => {
  let tempProjectDir: string;

  before(() => {
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tellus_screen_test_'));
  });

  after(() => {
    try {
      if (fs.existsSync(tempProjectDir)) {
        fs.rmSync(tempProjectDir, { recursive: true, force: true });
      }
    } catch {}
  });

  test('1. Listagem de janelas e monitor principal (WindowSource)', () => {
    const windows = ScreenCapture.listOpenWindows();
    assert.ok(Array.isArray(windows), 'Deve retornar lista de janelas');
    assert.ok(windows.length >= 1, 'Deve conter pelo menos o monitor principal');
    assert.equal(windows[0].id, 'primary', 'Primeiro item deve ser a tela principal');
  });

  test('2. Diretório seguro de anexos (.agentic/attachments)', () => {
    const attDir = FileParser.getAttachmentsDir(tempProjectDir);
    assert.ok(fs.existsSync(attDir), 'Diretório de anexos deve ser criado');
    assert.ok(attDir.includes(path.join('.agentic', 'attachments')));
  });

  test('3. Processamento e parsing de upload de imagem base64', async () => {
    // 1x1 transparente PNG em base64
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const parsed = await FileParser.processUpload(tempProjectDir, 'icone_teste.png', 'image/png', pngBase64);

    assert.ok(parsed.id.startsWith('att_'));
    assert.equal(parsed.isImage, true);
    assert.equal(parsed.isPdf, false);
    assert.equal(parsed.isAudio, false);
    assert.ok(parsed.size > 0);
    assert.ok(fs.existsSync(path.join(tempProjectDir, parsed.relativePath)));
  });

  test('4. Processamento de documento de texto/código', async () => {
    const codeContent = 'export const API_VERSION = "2.0";\nconsole.log("Tellus IDE");';
    const base64Code = Buffer.from(codeContent, 'utf-8').toString('base64');
    const parsed = await FileParser.processUpload(tempProjectDir, 'config.ts', 'text/typescript', base64Code);

    assert.equal(parsed.isImage, false);
    assert.equal(parsed.isPdf, false);
    assert.ok(parsed.parsedContent?.includes('config.ts'));
    assert.ok(parsed.parsedContent?.includes('API_VERSION'));
  });
});
