/**
 * Normalizador de Vocabulário Técnico e Inglês para STT (Speech-to-Text) do Tellus (Client)
 * Garante que termos em inglês falados durante sessões de Live Voice ou ditado
 * não sejam corrompidos por homófonos em português (ex: "ficha api" -> "Fish API").
 */

export interface VocabularyRule {
  pattern: RegExp;
  replacement: string;
}

export const TECHNICAL_VOCABULARY_RULES: VocabularyRule[] = [
  // 1. Fish Audio & Fish API & TTS
  { pattern: /\b(?:ficha|fixa|fichi|peixe|pesh)\s+(?:a?\s*pi|p\.?i\.?)\b/gi, replacement: 'Fish API' },
  { pattern: /\b(?:ficha|fixa|peixe)\s+(?:áudio|audio)\s+(?:a?\s*pi|p\.?i\.?)\b/gi, replacement: 'Fish Audio API' },
  { pattern: /\b(?:ficha|fixa|peixe)\s+(?:áudio|audio)\b/gi, replacement: 'Fish Audio' },
  { pattern: /\bapi\s+de\s+(?:ficha|fixa|peixe)\b/gi, replacement: 'Fish API' },
  { pattern: /\b(?:te\s*te\s*esse|titi\s*s|titi\s*esse|t\.t\.s\.?)\b/gi, replacement: 'TTS' },
  { pattern: /\bapi\s+de\s+tts\b/gi, replacement: 'API de TTS' },
  { pattern: /\b(?:stt|esse\s*te\s*te|s\.t\.t\.?)\b/gi, replacement: 'STT' },

  // 2. IA, Modelos e Provedores
  { pattern: /\b(?:deep\s*cique|dipe\s*cique|dip\s*cique|deep\s*sick|deep\s*seque|dipe\s*seque)\s*r\s*1\b/gi, replacement: 'DeepSeek R1' },
  { pattern: /\b(?:deep\s*cique|dipe\s*cique|dip\s*cique|deep\s*sick|deep\s*seque|dipe\s*seque)\s*r\s*um\b/gi, replacement: 'DeepSeek R1' },
  { pattern: /\b(?:deep\s*cique|dipe\s*cique|dip\s*cique|deep\s*sick|deep\s*seque|dipe\s*seque)\b/gi, replacement: 'DeepSeek' },
  { pattern: /\b(?:open\s*roteador|open\s*route|open\s*router)\s*(?:a?\s*pi|p\.?i\.?)?\b/gi, replacement: 'OpenRouter' },
  { pattern: /\b(?:eleven\s*lebs|eleve\s*labs|eleven\s*labis|eleven\s*labs)\b/gi, replacement: 'ElevenLabs' },
  { pattern: /\b(?:uisper|visper)\s*(?:a?\s*pi)?\b/gi, replacement: 'Whisper' },
  { pattern: /\bwhisper\s*one\b/gi, replacement: 'Whisper-1' },
  { pattern: /\bg[eê]mini\s*(?:flash|doze|dois)?\b/gi, replacement: 'Gemini' },
  { pattern: /\b(?:llm|ele\s*ele\s*eme|e\s*l\s*l\s*m)\b/gi, replacement: 'LLM' },
  { pattern: /\bllms\b/gi, replacement: 'LLMs' },

  // 3. Ferramentas, Formatos e Desenvolvimento
  { pattern: /\b(?:épi\s*ai|ápi|a\.p\.i\.)\b/gi, replacement: 'API' },
  { pattern: /\bprompte\b/gi, replacement: 'prompt' },
  { pattern: /\bprompts\b/gi, replacement: 'prompts' },
  { pattern: /\btóken\b/gi, replacement: 'token' },
  { pattern: /\btókens\b/gi, replacement: 'tokens' },
  { pattern: /\b(?:paipline|pipe\s*line)\b/gi, replacement: 'pipeline' },
  { pattern: /\bdóquer\b/gi, replacement: 'Docker' },
  { pattern: /\b(?:git\s*rub|git\s*hube|guithub)\b/gi, replacement: 'GitHub' },
  { pattern: /\bguite\b/gi, replacement: 'Git' },
  { pattern: /\b(?:v\s*s\s*code|vescode|veese\s*code)\b/gi, replacement: 'VS Code' },
  { pattern: /\b(?:react|riéct)\b/gi, replacement: 'React' },
  { pattern: /\b(?:vite|vaiti)\b/gi, replacement: 'Vite' },
  { pattern: /\b(?:nóde|node\s*js)\b/gi, replacement: 'Node.js' },
  { pattern: /\btaipscript\b/gi, replacement: 'TypeScript' },
  { pattern: /\btelwind\b/gi, replacement: 'Tailwind' },
  { pattern: /\bmarcdau\b/gi, replacement: 'Markdown' },
  { pattern: /\bobsidiam\b/gi, replacement: 'Obsidian' },
  { pattern: /\bvóut\b/gi, replacement: 'Vault' },
  { pattern: /\b(?:rést\s*api|rest\s*a\s*pi)\b/gi, replacement: 'REST API' },
  { pattern: /\buéb\s*ruque\b/gi, replacement: 'webhook' },
  { pattern: /\bend\s*pointe\b/gi, replacement: 'endpoint' }
];

/**
 * Normaliza e enriquece a transcrição de voz com vocabulário técnico correto.
 */
export function normalizeVoiceVocabulary(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let normalized = text;

  for (const rule of TECHNICAL_VOCABULARY_RULES) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Remove tags de voz e de entonação para exibição estritamente limpa em texto na interface.
 * Transforma:
 * "[FALA][thoughtful] Claro — vamos testar o retorno de voz..."
 * em:
 * "Claro — vamos testar o retorno de voz..."
 */
export function stripVoiceTags(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove tags de bloco [FALA] e [/FALA]
    .replace(/\[\/?FALA\]/gi, '')
    // Remove tags de emoção/entonação no início do texto ou após quebras de linha
    .replace(/\[(?:thoughtful|calm|happy|whispering|whisper|excited|sad|serious|curious|neutral|angry|cheerful|depressed|fearful)\]/gi, '')
    // Remove múltiplos espaços e quebras no início
    .replace(/^\s+/, '')
    .trim();
}
