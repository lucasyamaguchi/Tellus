import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeVoiceVocabulary, stripVoiceTags } from '../src/utils/voiceVocabulary.js';

describe('Voice Vocabulary Normalization & Speech Interpretation', () => {
  it('1. Normalizes Fish API and Fish Audio misinterpretations', () => {
    assert.strictEqual(
      normalizeVoiceVocabulary('quero testar a ficha api'),
      'quero testar a Fish API'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('qual o custo da ficha pi'),
      'qual o custo da Fish API'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('qual o modelo da ficha áudio'),
      'qual o modelo da Fish Audio'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('conecte na api de ficha'),
      'conecte na Fish API'
    );
  });

  it('2. Normalizes TTS, STT and Speech Providers', () => {
    assert.strictEqual(
      normalizeVoiceVocabulary('qual provedor de te te esse você recomenda'),
      'qual provedor de TTS você recomenda'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('podemos usar uma api de tts'),
      'podemos usar uma API de TTS'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('vamos rodar o modelo deep cique r um'),
      'vamos rodar o modelo DeepSeek R1'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('configure a chave da open roteador'),
      'configure a chave da OpenRouter'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('podemos usar as vozes da eleven lebs'),
      'podemos usar as vozes da ElevenLabs'
    );
  });

  it('3. Normalizes General Developer & AI Terminology', () => {
    assert.strictEqual(
      normalizeVoiceVocabulary('faça o deploy do dóquer no git rub'),
      'faça o deploy do Docker no GitHub'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('crie um paipline com react e vite'),
      'crie um pipeline com React e Vite'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('salve as anotações no obsidiam vóut'),
      'salve as anotações no Obsidian Vault'
    );
    assert.strictEqual(
      normalizeVoiceVocabulary('qual o limite de tokens por prompte no llm'),
      'qual o limite de tokens por prompt no LLM'
    );
  });
});

describe('Voice Tags Stripper for Clean Text Display', () => {
  it('1. Strips [FALA] and emotion tags from assistant responses', () => {
    const raw = '[FALA][thoughtful] Claro — vamos testar o retorno de voz. Se por "Fish API" você quis dizer API de TTS...';
    assert.strictEqual(
      stripVoiceTags(raw),
      'Claro — vamos testar o retorno de voz. Se por "Fish API" você quis dizer API de TTS...'
    );
  });

  it('2. Strips closed [FALA]...[/FALA] tags and preserves surrounding text', () => {
    const raw = '[FALA][calm] Preparei todas as anotações para você.[/FALA]\n\n## Detalhes\nAqui estão os tópicos...';
    assert.strictEqual(
      stripVoiceTags(raw),
      'Preparei todas as anotações para você.\n\n## Detalhes\nAqui estão os tópicos...'
    );
  });

  it('3. Strips various emotion tags ([happy], [whispering], [excited], [serious])', () => {
    assert.strictEqual(
      stripVoiceTags('[happy] Olá! Que ótimo conversar com você.'),
      'Olá! Que ótimo conversar com você.'
    );
    assert.strictEqual(
      stripVoiceTags('[whispering] Falando baixinho para não incomodar.'),
      'Falando baixinho para não incomodar.'
    );
    assert.strictEqual(
      stripVoiceTags('[serious] Vamos analisar a segurança da aplicação.'),
      'Vamos analisar a segurança da aplicação.'
    );
  });

  it('4. Preserves regular markdown and text without voice tags untouched', () => {
    const regular = 'Como referência, **na tabela de preços** da OpenAI, o TTS custa US$ 15 por milhão.';
    assert.strictEqual(stripVoiceTags(regular), regular);
  });
});
