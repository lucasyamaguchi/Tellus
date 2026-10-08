/**
 * Utilities for extracting, classifying, and filtering highlighted text segments from notes.
 * Supports HTML <mark> tags with custom color palettes and Obsidian Markdown ==highlight== syntax.
 */

export type HighlightColorId = 'all' | 'yellow' | 'green' | 'blue' | 'purple' | 'orange' | 'pink';

export interface HighlightColorConfig {
  id: Exclude<HighlightColorId, 'all'>;
  name: string;
  label: string;
  bg: string;
  text: string;
  circleColor: string;
  badgeBg: string;
  border: string;
}

export const HIGHLIGHT_PALETTE: HighlightColorConfig[] = [
  {
    id: 'yellow',
    name: 'Amarelo',
    label: '🟡 Amarelo',
    bg: 'rgba(234, 179, 8, 0.25)',
    text: '#fef08a',
    circleColor: 'bg-yellow-400',
    badgeBg: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    border: 'border-yellow-500/40'
  },
  {
    id: 'green',
    name: 'Verde',
    label: '🟢 Verde',
    bg: 'rgba(16, 185, 129, 0.25)',
    text: '#a7f3d0',
    circleColor: 'bg-emerald-400',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    border: 'border-emerald-500/40'
  },
  {
    id: 'blue',
    name: 'Azul',
    label: '🔵 Azul',
    bg: 'rgba(56, 189, 248, 0.25)',
    text: '#bae6fd',
    circleColor: 'bg-sky-400',
    badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    border: 'border-sky-500/40'
  },
  {
    id: 'purple',
    name: 'Roxo',
    label: '🟣 Roxo',
    bg: 'rgba(168, 85, 247, 0.25)',
    text: '#e9d5ff',
    circleColor: 'bg-purple-400',
    badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    border: 'border-purple-500/40'
  },
  {
    id: 'orange',
    name: 'Laranja',
    label: '🟠 Laranja',
    bg: 'rgba(249, 115, 22, 0.25)',
    text: '#fed7aa',
    circleColor: 'bg-orange-400',
    badgeBg: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    border: 'border-orange-500/40'
  },
  {
    id: 'pink',
    name: 'Rosa',
    label: '🌸 Rosa',
    bg: 'rgba(236, 72, 153, 0.25)',
    text: '#fbcfe8',
    circleColor: 'bg-pink-400',
    badgeBg: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    border: 'border-pink-500/40'
  }
];

export interface ExtractedHighlight {
  id: string;
  noteId: string;
  noteTitle: string;
  folder: string;
  text: string;
  colorId: Exclude<HighlightColorId, 'all'>;
  colorName: string;
  bg: string;
  textColor: string;
  circleColor: string;
  badgeBg: string;
  border: string;
  index: number;
}

/**
 * Resolves color style string or tag attributes into a matched HighlightColorConfig
 */
export function matchHighlightColor(styleOrTag: string): HighlightColorConfig {
  const s = (styleOrTag || '').toLowerCase();

  if (s.includes('16, 185, 129') || s.includes('emerald') || s.includes('#a7f3d0') || s.includes('#10b981') || s.includes('green')) {
    return HIGHLIGHT_PALETTE[1]; // green
  }
  if (s.includes('56, 189, 248') || s.includes('sky') || s.includes('#bae6fd') || s.includes('#38bdf8') || s.includes('blue')) {
    return HIGHLIGHT_PALETTE[2]; // blue
  }
  if (s.includes('168, 85, 247') || s.includes('purple') || s.includes('#e9d5ff') || s.includes('#a855f7')) {
    return HIGHLIGHT_PALETTE[3]; // purple
  }
  if (s.includes('249, 115, 22') || s.includes('orange') || s.includes('#fed7aa') || s.includes('#f97316')) {
    return HIGHLIGHT_PALETTE[4]; // orange
  }
  if (s.includes('236, 72, 153') || s.includes('pink') || s.includes('#fbcfe8') || s.includes('#ec4899') || s.includes('rose')) {
    return HIGHLIGHT_PALETTE[5]; // pink
  }

  // Default yellow
  return HIGHLIGHT_PALETTE[0];
}

/**
 * Parses markdown or formatted HTML content to extract all highlight segments.
 */
export function extractHighlightsFromContent(
  content: string,
  noteId: string,
  noteTitle: string,
  folder: string = 'Geral'
): ExtractedHighlight[] {
  if (!content || !content.trim()) return [];

  const results: ExtractedHighlight[] = [];
  let itemCounter = 0;

  // 1. Match HTML <mark ...>...</mark>
  const markRegex = /<mark([^>]*)>([\s\S]*?)<\/mark>/gi;
  let match: RegExpExecArray | null;

  while ((match = markRegex.exec(content)) !== null) {
    const rawAttrs = match[1] || '';
    const innerHtml = match[2] || '';
    const cleanText = innerHtml.replace(/<[^>]+>/g, '').trim();

    if (cleanText) {
      const colorConfig = matchHighlightColor(rawAttrs);
      results.push({
        id: `${noteId}-hl-${itemCounter++}`,
        noteId,
        noteTitle,
        folder,
        text: cleanText,
        colorId: colorConfig.id,
        colorName: colorConfig.name,
        bg: colorConfig.bg,
        textColor: colorConfig.text,
        circleColor: colorConfig.circleColor,
        badgeBg: colorConfig.badgeBg,
        border: colorConfig.border,
        index: match.index
      });
    }
  }

  // 2. Match Obsidian syntax ==highlight==
  const obsidianRegex = /==([^=\r\n]+)==/g;
  while ((match = obsidianRegex.exec(content)) !== null) {
    const cleanText = (match[1] || '').trim();
    // Verify it wasn't already caught by HTML mark
    const alreadyExists = results.some(r => r.text === cleanText);
    if (cleanText && !alreadyExists) {
      const defaultColor = HIGHLIGHT_PALETTE[0]; // yellow
      results.push({
        id: `${noteId}-hl-${itemCounter++}`,
        noteId,
        noteTitle,
        folder,
        text: cleanText,
        colorId: defaultColor.id,
        colorName: defaultColor.name,
        bg: defaultColor.bg,
        textColor: defaultColor.text,
        circleColor: defaultColor.circleColor,
        badgeBg: defaultColor.badgeBg,
        border: defaultColor.border,
        index: match.index
      });
    }
  }

  return results;
}
