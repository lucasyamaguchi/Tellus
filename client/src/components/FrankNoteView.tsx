import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  Folder, 
  FolderPlus,
  ShieldCheck, 
  Network, 
  Edit3, 
  Sparkles,
  Link as LinkIcon,
  MessageSquareQuote,
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Tag,
  GraduationCap,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  FolderOpen,
  Wand2,
  FolderInput,
  MoveRight,
  GripVertical,
  Eye,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Filter,
  Layers,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Columns,
  ArrowLeftRight,
  Clock,
  Archive,
  RefreshCw,
  Book,
  Briefcase,
  Code2,
  PenTool,
  Camera,
  LayoutGrid,
  Home,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Image as ImageIcon,
  Palette,
  Highlighter,
  Quote,
  Code,
  Table as TableIcon,
  Minus,
  ArrowUp,
  ArrowDown,
  ListTree,
  Smile,
  ArrowUpDown,
  Mic,
  Radio,
  Loader2,
  Undo2,
  Redo2,
  Paintbrush,
  RemoveFormatting
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FrankNote, GraphData, DeletedNoteItem, GitSafeAuditReport } from '../types';
import { api } from '../api';
import { InteractiveGraphCanvas } from './InteractiveGraphCanvas';
import { SmartDropzoneModal } from './SmartDropzoneModal';
import { CreditsModal } from './CreditsModal';
import { downloadNoteInFormat, downloadFormattedNotebook, ExportFormat, markdownToEditorHtml, editorHtmlToMarkdown } from '../utils/noteFormatter';
import { 
  extractHighlightsFromContent, 
  HIGHLIGHT_PALETTE, 
  HighlightColorId, 
  ExtractedHighlight 
} from '../utils/noteHighlights';

const TEXT_COLORS = [
  { name: 'Padrão', hex: '#f8fafc', bg: 'bg-slate-200' },
  { name: 'Âmbar', hex: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Dourado', hex: '#eab308', bg: 'bg-yellow-500' },
  { name: 'Esmeralda', hex: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Azul Céu', hex: '#38bdf8', bg: 'bg-sky-400' },
  { name: 'Púrpura', hex: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Magenta', hex: '#ec4899', bg: 'bg-pink-500' },
  { name: 'Coral', hex: '#f43f5e', bg: 'bg-rose-500' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Amarelo', bg: 'rgba(234, 179, 8, 0.25)', text: '#fef08a', circle: 'bg-yellow-400' },
  { name: 'Verde', bg: 'rgba(16, 185, 129, 0.25)', text: '#a7f3d0', circle: 'bg-emerald-400' },
  { name: 'Azul', bg: 'rgba(56, 189, 248, 0.25)', text: '#bae6fd', circle: 'bg-sky-400' },
  { name: 'Roxo', bg: 'rgba(168, 85, 247, 0.25)', text: '#e9d5ff', circle: 'bg-purple-400' },
  { name: 'Laranja', bg: 'rgba(249, 115, 22, 0.25)', text: '#fed7aa', circle: 'bg-orange-400' },
  { name: 'Rosa', bg: 'rgba(236, 72, 153, 0.25)', text: '#fbcfe8', circle: 'bg-pink-400' },
];

const EMOJI_PRESETS = ['📝', '🧠', '💡', '📚', '🎯', '⚡', '🚀', '💻', '📌', '🔬', '🎨', '💼', '📊', '🔥', '🏆', '⭐'];

interface NoteSectionBlock {
  id: string;
  heading: string;
  level: number;
  content: string;
}

interface FrankNoteViewProps {
  onMentionInChat?: (note: FrankNote) => void;
  onStudyTopic?: (topic: string) => void;
  onReturnToAgent?: () => void;
  targetNoteIdOrTitle?: string | null;
  onStartLiveVoice?: (topic: string, initialContent?: string) => void;
  onSearchInNewChat?: (query: string) => void;
}

export const FrankNoteView: React.FC<FrankNoteViewProps> = ({
  onMentionInChat,
  onStudyTopic,
  onReturnToAgent,
  targetNoteIdOrTitle,
  onStartLiveVoice,
  onSearchInNewChat
}) => {
  const [notes, setNotes] = useState<FrankNote[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<{ [f: string]: boolean }>({});
  const [isSingleNotebookMode, setIsSingleNotebookMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('notes_single_notebook_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isCreditsOpen, setIsCreditsOpen] = useState<boolean>(false);
  const [activeNote, setActiveNote] = useState<FrankNote | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'editor' | 'graph'>('editor');
  
  // Note Editor: Canvas 100% formatado e visual (Markdown é puramente de background)
  const editableContainerRef = useRef<HTMLDivElement | null>(null);
  const currentLoadedNoteIdRef = useRef<string | null>(null);
  const saveDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sidebar Tab: 'folders' (Active Notes) vs 'highlights' (Vault Highlights) vs 'trash' (Deleted Notes)
  const [sidebarTab, setSidebarTab] = useState<'folders' | 'highlights' | 'trash'>('folders');
  const [highlightColorFilter, setHighlightColorFilter] = useState<HighlightColorId>('all');
  const [highlightScopeFilter, setHighlightScopeFilter] = useState<'all' | 'current'>('all');
  const [highlightSearchQuery, setHighlightSearchQuery] = useState<string>('');
  const [copiedHighlightId, setCopiedHighlightId] = useState<string | null>(null);
  const [deletedNotes, setDeletedNotes] = useState<DeletedNoteItem[]>([]);
  const [retentionPolicy, setRetentionPolicy] = useState<'30_days' | '90_days' | '120_days' | '1_year' | 'never'>('90_days');
  const [selectedDeletedNote, setSelectedDeletedNote] = useState<DeletedNoteItem | null>(null);
  const [isLoadingTrash, setIsLoadingTrash] = useState<boolean>(false);

  const [editContent, setEditContent] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editFolder, setEditFolder] = useState<string>('Geral');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rich Document Refs & Popover States
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const floatingColorPickerRef = useRef<HTMLDivElement | null>(null);
  const highlightPickerRef = useRef<HTMLDivElement | null>(null);
  const floatingHighlightPickerRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Export dropdown & notification toast
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportToast, setExportToast] = useState<{ message: string; filename?: string } | null>(null);
  const floatingBarRef = useRef<HTMLDivElement | null>(null);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState<boolean>(false);
  const [isFloatingColorPickerOpen, setIsFloatingColorPickerOpen] = useState<boolean>(false);
  const [isFloatingHighlightPickerOpen, setIsFloatingHighlightPickerOpen] = useState<boolean>(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState<boolean>(false);
  const [isWikilinkModalOpen, setIsWikilinkModalOpen] = useState<boolean>(false);
  const [wikilinkSearch, setWikilinkSearch] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [noteEmoji, setNoteEmoji] = useState<string>('📝');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState<boolean>(false);
  const [notebookSortOrder, setNotebookSortOrder] = useState<'name' | 'recent' | 'count'>('name');

  // Format Painter (Pincel de Formatação) State
  const [formatPainterState, setFormatPainterState] = useState<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    color?: string | null;
    highlightBg?: string | null;
    highlightColor?: string | null;
    isCode?: boolean;
  } | null>(null);
  const [painterToast, setPainterToast] = useState<string | null>(null);

  // Fechar caixas suspensas e paletas ao clicar fora ou no texto da nota
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isColorPickerOpen && colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setIsColorPickerOpen(false);
      }
      if (isHighlightPickerOpen && highlightPickerRef.current && !highlightPickerRef.current.contains(target)) {
        setIsHighlightPickerOpen(false);
      }
      if (isFloatingColorPickerOpen && floatingColorPickerRef.current && !floatingColorPickerRef.current.contains(target)) {
        setIsFloatingColorPickerOpen(false);
      }
      if (isFloatingHighlightPickerOpen && floatingHighlightPickerRef.current && !floatingHighlightPickerRef.current.contains(target)) {
        setIsFloatingHighlightPickerOpen(false);
      }
      if (isEmojiPickerOpen && emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setIsEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isColorPickerOpen, isHighlightPickerOpen, isFloatingColorPickerOpen, isFloatingHighlightPickerOpen, isEmojiPickerOpen]);

  const fetchNotesAndFolders = async () => {
    try {
      const [notesList, foldersList] = await Promise.all([
        api.listNotes(),
        api.listFolders()
      ]);
      setNotes(notesList);
      setFolders(foldersList);
    } catch {
      // ignore
    }
  };

  // Sincroniza o HTML do editor formatado de volta para Markdown limpo para salvar no Vault em background
  const syncEditorToMarkdownAndSave = useCallback((overrideMd?: string) => {
    let md = overrideMd;
    if (md === undefined && editableContainerRef.current) {
      const html = editableContainerRef.current.innerHTML;
      md = editorHtmlToMarkdown(html);
    }
    if (md !== undefined) {
      setEditContent(md);
      if (saveDebounceTimeoutRef.current) clearTimeout(saveDebounceTimeoutRef.current);
      saveDebounceTimeoutRef.current = setTimeout(async () => {
        if (!activeNote) return;
        try {
          setIsSaving(true);
          const updated = await api.saveNote({
            id: activeNote.id,
            title: editTitle,
            folder: editFolder,
            subject: editFolder,
            content: md,
            isProjectSpecific: activeNote.isProjectSpecific
          });
          setActiveNote(updated);
          setLastSavedTime(new Date());
          fetchNotesAndFolders();
        } catch (err) {
          console.error('Falha no auto-save da nota:', err);
        } finally {
          setIsSaving(false);
        }
      }, 800);
    }
  }, [activeNote, editTitle, editFolder]);

  // Undo & Redo History para o Editor Formatado
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastRecordedHtmlRef = useRef<string>('');
  const typingSnapshotTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pushUndoSnapshot = useCallback(() => {
    if (!editableContainerRef.current) return;
    const currentHtml = editableContainerRef.current.innerHTML;
    if (!currentHtml) return;

    const baseHtml = lastRecordedHtmlRef.current || currentHtml;
    undoStackRef.current.push(baseHtml);
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    lastRecordedHtmlRef.current = currentHtml;
  }, []);

  const handleUndo = useCallback(() => {
    if (!editableContainerRef.current || undoStackRef.current.length === 0) return;
    const currentHtml = editableContainerRef.current.innerHTML;
    const previousHtml = undoStackRef.current.pop()!;
    redoStackRef.current.push(currentHtml);
    if (redoStackRef.current.length > 50) {
      redoStackRef.current.shift();
    }

    editableContainerRef.current.innerHTML = previousHtml;
    lastRecordedHtmlRef.current = previousHtml;
    const md = editorHtmlToMarkdown(previousHtml);
    setEditContent(md);
    syncEditorToMarkdownAndSave(md);
  }, [syncEditorToMarkdownAndSave]);

  const handleRedo = useCallback(() => {
    if (!editableContainerRef.current || redoStackRef.current.length === 0) return;
    const currentHtml = editableContainerRef.current.innerHTML;
    const nextHtml = redoStackRef.current.pop()!;
    undoStackRef.current.push(currentHtml);
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }

    editableContainerRef.current.innerHTML = nextHtml;
    lastRecordedHtmlRef.current = nextHtml;
    const md = editorHtmlToMarkdown(nextHtml);
    setEditContent(md);
    syncEditorToMarkdownAndSave(md);
  }, [syncEditorToMarkdownAndSave]);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
    }
  }, [handleUndo, handleRedo]);

  // Global Escape key listener para fechar qualquer modal ou menu suspenso
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsReorderModalOpen(false);
        setIsWikilinkModalOpen(false);
        setMoveModalNote(null);
        setIsNotionModalOpen(false);
        setIsGitSafeModalOpen(false);
        setIsDropzoneOpen(false);
        setIsColorPickerOpen(false);
        setIsHighlightPickerOpen(false);
        setIsFloatingColorPickerOpen(false);
        setIsFloatingHighlightPickerOpen(false);
        setShowFloatingAction(false);
        setContextMenuPos(null);
        setFormatPainterState(null);
        setPainterToast(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const insertImageAtCursor = useCallback((url: string, alt: string) => {
    if (editableContainerRef.current) {
      const imgHtml = `<img src="${url}" alt="${alt}" class="rounded-2xl max-h-[460px] w-auto max-w-full my-4 border border-card-border/80 shadow-2xl object-contain" style="max-width: 100%; border-radius: 12px; margin: 12px 0; display: block;" /><p><br></p>`;
      editableContainerRef.current.focus();
      document.execCommand('insertHTML', false, imgHtml);
      syncEditorToMarkdownAndSave();
    } else {
      const mdImg = `\n![${alt}](${url})\n`;
      setEditContent(prev => prev + mdImg);
      syncEditorToMarkdownAndSave(editContent + mdImg);
    }
  }, [editContent, syncEditorToMarkdownAndSave]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await api.uploadNoteAttachment(file.name, base64);
        insertImageAtCursor(res.urlPath, file.name.replace(/\.[^.]+$/, ''));
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Falha ao subir imagem:', err);
      alert('Erro ao enviar imagem: ' + (err.message || 'Falha de upload'));
      setIsUploadingImage(false);
    }
  }, [insertImageAtCursor]);

  const handleEditorPasteFormatted = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        handleImageUpload(file);
      }
    }
  }, [handleImageUpload]);

  const handleEditorDropFormatted = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        handleImageUpload(file);
      }
    }
  }, [handleImageUpload]);

  const handleEditorInput = useCallback(() => {
    if (editableContainerRef.current) {
      const html = editableContainerRef.current.innerHTML;
      const md = editorHtmlToMarkdown(html);
      setEditContent(md);
      syncEditorToMarkdownAndSave(md);

      // Grava snapshot de digitação com debounce para que Ctrl+Z desfaça blocos de digitação
      if (typingSnapshotTimeoutRef.current) clearTimeout(typingSnapshotTimeoutRef.current);
      typingSnapshotTimeoutRef.current = setTimeout(() => {
        if (editableContainerRef.current && editableContainerRef.current.innerHTML !== lastRecordedHtmlRef.current) {
          undoStackRef.current.push(lastRecordedHtmlRef.current || html);
          if (undoStackRef.current.length > 50) undoStackRef.current.shift();
          redoStackRef.current = [];
          lastRecordedHtmlRef.current = editableContainerRef.current.innerHTML;
        }
      }, 700);
    }
  }, [syncEditorToMarkdownAndSave]);

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Checkbox toggle (- [ ] <-> - [x])
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      pushUndoSnapshot();
      const checkbox = target as HTMLInputElement;
      const taskRow = checkbox.closest('.note-task-row') || checkbox.closest('li') || checkbox.parentElement;
      const span = taskRow?.querySelector('span');
      if (span) {
        if (checkbox.checked) {
          span.classList.add('line-through', 'text-slate-400');
          taskRow?.classList.add('opacity-70');
        } else {
          span.classList.remove('line-through', 'text-slate-400');
          taskRow?.classList.remove('opacity-70');
        }
      }
      setTimeout(() => {
        if (editableContainerRef.current) {
          const html = editableContainerRef.current.innerHTML;
          const md = editorHtmlToMarkdown(html);
          setEditContent(md);
          syncEditorToMarkdownAndSave(md);
        }
      }, 20);
      return;
    }

    // Wikilink Click
    const wikilinkEl = target.closest('[data-wikilink]') as HTMLElement;
    if (wikilinkEl) {
      const noteName = wikilinkEl.getAttribute('data-wikilink');
      if (noteName) {
        const found = notes.find(n => n.title.toLowerCase() === noteName.toLowerCase() || n.id.toLowerCase() === noteName.toLowerCase());
        if (found) {
          selectNote(found);
        }
      }
    }
  }, [notes, syncEditorToMarkdownAndSave]);


  // Section / Block Reordering Logic
  const parseMarkdownSections = useCallback((markdown: string): NoteSectionBlock[] => {
    if (!markdown) return [];
    const lines = markdown.split('\n');
    const sections: NoteSectionBlock[] = [];
    let currentHeading = 'Introdução';
    let currentLevel = 0;
    let currentLines: string[] = [];
    let sectionIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,4})\s+(.+)/);
      if (match) {
        if (currentLines.length > 0 || currentHeading !== 'Introdução') {
          sections.push({
            id: `sec-${sectionIndex++}`,
            heading: currentHeading,
            level: currentLevel,
            content: currentLines.join('\n').trim()
          });
          currentLines = [];
        }
        currentLevel = match[1].length;
        currentHeading = match[2].trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0 || currentHeading) {
      sections.push({
        id: `sec-${sectionIndex++}`,
        heading: currentHeading,
        level: currentLevel,
        content: currentLines.join('\n').trim()
      });
    }

    return sections;
  }, []);

  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    const sections = parseMarkdownSections(editContent);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;

    const newMarkdown = sections.map(s => {
      if (s.level === 0) {
        return s.content;
      }
      const hashes = '#'.repeat(s.level);
      return `${hashes} ${s.heading}\n\n${s.content}`.trim();
    }).join('\n\n');

    setEditContent(newMarkdown);
  }, [editContent, parseMarkdownSections]);

  // Graph Controls State (Obsidian Style)
  const [graphShowFolders, setGraphShowFolders] = useState<boolean>(true);
  const [graphShowTags, setGraphShowTags] = useState<boolean>(true);
  const [graphShowWikilinks, setGraphShowWikilinks] = useState<boolean>(true);
  const [graphChargeStrength, setGraphChargeStrength] = useState<number>(280);
  const [graphSearchFilter, setGraphSearchFilter] = useState<string>('');
  const [hoveredGraphNode, setHoveredGraphNode] = useState<{ label: string; type: string; connections: number } | null>(null);

  // Notebooks & Folder Creation State
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('all');
  const [isCreatingNotebook, setIsCreatingNotebook] = useState<boolean>(false);
  const [newNotebookName, setNewNotebookName] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  // Drag and Drop & Move State (Notes & Folders)
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [draggedFolderName, setDraggedFolderName] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [moveModalNote, setMoveModalNote] = useState<FrankNote | null>(null);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>('Geral');
  const [newMoveFolderName, setNewMoveFolderName] = useState<string>('');

  // Notion Import Modal State
  const [isNotionModalOpen, setIsNotionModalOpen] = useState<boolean>(false);
  const [notionPasteTitle, setNotionPasteTitle] = useState<string>('');
  const [notionPasteContent, setNotionPasteContent] = useState<string>('');
  const [notionTargetFolder, setNotionTargetFolder] = useState<string>('Notion Import');
  const [isImportingNotion, setIsImportingNotion] = useState<boolean>(false);

  // Smart Dropzone Modal State
  const [isDropzoneOpen, setIsDropzoneOpen] = useState<boolean>(false);
  const [initialHomeDropFiles, setInitialHomeDropFiles] = useState<File[] | null>(null);
  const [isHomeDraggingOver, setIsHomeDraggingOver] = useState<boolean>(false);

  // GitSafe Core Security Modal State
  const [isGitSafeModalOpen, setIsGitSafeModalOpen] = useState<boolean>(false);
  const [gitSafeReport, setGitSafeReport] = useState<GitSafeAuditReport | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [testSanitizeInput, setTestSanitizeInput] = useState<string>('');
  const [testSanitizeOutput, setTestSanitizeOutput] = useState<{ sanitized: string; redactedCount: number; detectedTypes: string[] } | null>(null);

  // Text Selection & Context Menu for Study Engine
  const [selectedText, setSelectedText] = useState<string>('');
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showFloatingAction, setShowFloatingAction] = useState<boolean>(false);
  const [floatingActionPos, setFloatingActionPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Window Resizing & Layout State (Obsidian / Notion style)
  const [sidebarWidth, setSidebarWidth] = useState<number>(330);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [isNoteMaximized, setIsNoteMaximized] = useState<boolean>(false);
  const [isFullWidth, setIsFullWidth] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('frank_vault_full_width');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleFullWidth = useCallback(() => {
    setIsFullWidth(prev => {
      const next = !prev;
      try {
        localStorage.setItem('frank_vault_full_width', String(next));
      } catch {}
      return next;
    });
  }, []);

  const normalizeFolderPath = useCallback((p?: string | null): string => {
    if (!p) return 'Geral';
    return p.replace(/\\/g, '/').replace(/\s+-\s+/g, '/').trim() || 'Geral';
  }, []);

  const getNoteFolder = useCallback((n?: { folder?: string; subject?: string } | null): string => {
    if (!n) return 'Geral';
    const raw = n.folder || 'Geral';
    return normalizeFolderPath(raw);
  }, [normalizeFolderPath]);

  // Mouse Drag Handlers for Resizing Sidebar
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingSidebar) {
      const newWidth = Math.min(Math.max(e.clientX, 220), 650);
      setSidebarWidth(newWidth);
    }
  }, [isDraggingSidebar]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false);
  }, []);

  useEffect(() => {
    if (isDraggingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSidebar, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setContextMenuPos(null);
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);


  // Aplica formatação direta na seleção da nota preservando rigorosamente a posição de rolagem
  const formatSelectionInNote = useCallback(async (prefix: string, suffix: string = prefix) => {
    if (!activeNote || !selectedText) return;
    const container = previewContainerRef.current;
    const scrollPos = container?.scrollTop ?? 0;

    const content = activeNote.content;
    const idx = content.indexOf(selectedText);
    if (idx === -1) {
      applyFormatting(prefix, suffix);
      return;
    }

    const formatted = `${prefix}${selectedText}${suffix}`;
    const newContent = content.substring(0, idx) + formatted + content.substring(idx + selectedText.length);

    setEditContent(newContent);
    setActiveNote(prev => prev ? ({ ...prev, content: newContent }) : null);

    try {
      await api.saveNote({
        id: activeNote.id,
        title: activeNote.title,
        folder: activeNote.folder,
        subject: activeNote.subject,
        content: newContent,
        isProjectSpecific: activeNote.isProjectSpecific
      });
      fetchNotesAndFolders();
    } catch (err) {
      console.error('Falha ao salvar formatação na nota:', err);
    }

    setTimeout(() => {
      if (container) {
        container.scrollTop = scrollPos;
      }
    }, 15);

    setShowFloatingAction(false);
    setIsColorPickerOpen(false);
    setIsHighlightPickerOpen(false);
    setIsFloatingColorPickerOpen(false);
    setIsFloatingHighlightPickerOpen(false);
  }, [activeNote, selectedText, fetchNotesAndFolders]);


  // Formatting Action Handlers (Aplica diretamente no editor visual rico)
  const applyFormatting = useCallback((prefix: string, suffix: string = prefix) => {
    pushUndoSnapshot();
    if (editableContainerRef.current) {
      if (prefix === '**') {
        document.execCommand('bold', false);
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '*') {
        document.execCommand('italic', false);
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '<u>') {
        document.execCommand('underline', false);
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '~~') {
        document.execCommand('strikeThrough', false);
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '`') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          const code = document.createElement('code');
          code.className = 'bg-card border border-card-border/60 text-amber-300 px-1.5 py-0.5 rounded-md font-mono text-xs';
          code.appendChild(range.extractContents());
          range.insertNode(code);
          syncEditorToMarkdownAndSave();
          return;
        }
      }
    }
    if (selectedText && activeNote) {
      formatSelectionInNote(prefix, suffix);
    }
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave, selectedText, activeNote, formatSelectionInNote]);

  const applyLinePrefix = useCallback((prefix: string) => {
    pushUndoSnapshot();
    if (editableContainerRef.current) {
      if (prefix === '# ') {
        document.execCommand('formatBlock', false, '<h1>');
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '## ') {
        document.execCommand('formatBlock', false, '<h2>');
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '### ') {
        document.execCommand('formatBlock', false, '<h3>');
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '- ') {
        document.execCommand('insertUnorderedList', false);
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '1. ') {
        document.execCommand('insertOrderedList', false);
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '- [ ] ') {
        const taskHtml = `<div class="note-task-row flex items-start space-x-2.5 my-1.5" data-task="true"><input type="checkbox" class="mt-1 w-4 h-4 rounded border-slate-600 accent-emerald-500 cursor-pointer" /><span>Nova tarefa</span></div><p><br></p>`;
        document.execCommand('insertHTML', false, taskHtml);
        syncEditorToMarkdownAndSave();
        return;
      }
      if (prefix === '> 💡 ') {
        const calloutHtml = `<blockquote class="border-l-4 border-accent pl-3.5 my-3 italic text-slate-400 bg-card/40 py-2 rounded-r-xl">💡 Destaque ou anotação importante</blockquote><p><br></p>`;
        document.execCommand('insertHTML', false, calloutHtml);
        syncEditorToMarkdownAndSave();
        return;
      }
    }
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave]);

  const applyTextColor = useCallback((hex: string) => {
    pushUndoSnapshot();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.color = hex;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      syncEditorToMarkdownAndSave();
    } else if (selectedText && activeNote) {
      formatSelectionInNote(`<span style="color: ${hex}">`, '</span>');
    }
    setIsColorPickerOpen(false);
    setIsFloatingColorPickerOpen(false);
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave, selectedText, activeNote, formatSelectionInNote]);

  const applyHighlight = useCallback((bg: string, color: string) => {
    pushUndoSnapshot();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const mark = document.createElement('mark');
      mark.style.backgroundColor = bg;
      mark.style.color = color;
      mark.style.padding = '2px 6px';
      mark.style.borderRadius = '4px';
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      syncEditorToMarkdownAndSave();
    } else if (selectedText && activeNote) {
      formatSelectionInNote(`<mark style="background: ${bg}; color: ${color}; padding: 2px 6px; border-radius: 4px">`, '</mark>');
    }
    setIsHighlightPickerOpen(false);
    setIsFloatingHighlightPickerOpen(false);
    setIsColorPickerOpen(false);
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave, selectedText, activeNote, formatSelectionInNote]);

  // Limpar Formatação de Destaque e Cores (Remove marcador e cor personalizada, restaurando ao padrão do tema, mantendo negrito, itálico, código e estruturas)
  const clearFormatting = useCallback(() => {
    pushUndoSnapshot();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editableContainerRef.current) {
      const range = sel.getRangeAt(0);
      const container = editableContainerRef.current;

      const unwrapNode = (el: Node) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      };

      // 1. Extrai o conteúdo selecionado
      const fragment = range.extractContents();

      // 2. Remove todos os <mark> contidos dentro do fragmento extraído (desenrola para manter negrito, itálico, etc.)
      fragment.querySelectorAll('mark').forEach(unwrapNode);

      // 3. Limpa cor e fundo de tags de estilo (spans, font) no fragmento, mantendo strong/b/em/i/u/s/code
      fragment.querySelectorAll('*').forEach((node) => {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === 'font') {
          el.removeAttribute('color');
        }
        if (el.style) {
          el.style.color = '';
          el.style.backgroundColor = '';
          el.style.background = '';
          // Se for span genérico que ficou sem style e sem classe, desenrola
          if (el.tagName.toLowerCase() === 'span' && (!el.getAttribute('style') || el.style.length === 0) && !el.className) {
            unwrapNode(el);
          }
        }
      });

      // 4. Se o ponto de corte do range começou ou terminou dentro de um <mark> que ficou no container:
      // Inspecionamos se o nó pai onde o cursor ficou é um <mark> vazio ou parcialmente vazio
      const startMark = (range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement)?.closest('mark');

      if (startMark) {
        if (!startMark.textContent || startMark.textContent.trim().length === 0) {
          startMark.parentNode?.insertBefore(fragment, startMark);
          startMark.remove();
        } else {
          // O startMark tinha conteúdo antes da seleção. Inserimos o fragmento logo após o startMark
          startMark.parentNode?.insertBefore(fragment, startMark.nextSibling);
        }
      } else {
        range.insertNode(fragment);
      }

      // 5. Varredura de segurança no container do editor para eliminar qualquer resíduo:
      // Remove marks vazios ou marks que perderam a cor de fundo (para nunca exibir o amarelo padrão do browser)
      container.querySelectorAll('mark').forEach((m) => {
        const htmlMark = m as HTMLElement;
        if (!htmlMark.textContent || htmlMark.textContent.trim().length === 0) {
          htmlMark.remove();
        } else if (!htmlMark.style.background && !htmlMark.style.backgroundColor) {
          unwrapNode(htmlMark);
        }
      });

      syncEditorToMarkdownAndSave();
    } else if (selectedText && activeNote) {
      // Limpeza cirúrgica em Markdown / texto simples:
      // Remove apenas tags de destaque (<mark>, ==) e cores personalizadas (<span style="color...">, <font>),
      // mantendo intactos **negrito**, *itálico*, ~~tachado~~, `código` e títulos ##.
      const clean = selectedText
        .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
        .replace(/==([^=\n]+)==/g, '$1')
        .replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, '$1')
        .replace(/<span\s+style="[^"]*(?:color|background)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');

      const content = activeNote.content;
      const idx = content.indexOf(selectedText);
      if (idx !== -1) {
        const newContent = content.substring(0, idx) + clean + content.substring(idx + selectedText.length);
        setEditContent(newContent);
        setActiveNote(prev => prev ? ({ ...prev, content: newContent }) : null);
        api.saveNote({
          id: activeNote.id,
          title: activeNote.title,
          folder: activeNote.folder,
          subject: activeNote.subject,
          content: newContent,
          isProjectSpecific: activeNote.isProjectSpecific
        });
        fetchNotesAndFolders();
      }
    }
    setShowFloatingAction(false);
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave, selectedText, activeNote, fetchNotesAndFolders]);

  // Capturar formatação atual para o Pincel de Formatação
  const handleToggleFormatPainter = useCallback(() => {
    if (formatPainterState) {
      setFormatPainterState(null);
      setPainterToast(null);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    let parentEl: HTMLElement | null = null;
    if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
      parentEl = range.startContainer as HTMLElement;
    } else {
      parentEl = range.startContainer.parentElement;
    }

    const markEl = parentEl?.closest('mark') as HTMLElement | null;
    const spanColorEl = parentEl?.closest('span[style*="color"]') as HTMLElement | null;
    const codeEl = parentEl?.closest('code') as HTMLElement | null;

    const isBold = document.queryCommandState('bold') || !!parentEl?.closest('b, strong');
    const isItalic = document.queryCommandState('italic') || !!parentEl?.closest('i, em');
    const isUnderline = document.queryCommandState('underline') || !!parentEl?.closest('u');
    const isStrike = document.queryCommandState('strikeThrough') || !!parentEl?.closest('s, strike');

    let color: string | null = null;
    if (spanColorEl && spanColorEl.style.color) {
      color = spanColorEl.style.color;
    }

    let highlightBg: string | null = null;
    let highlightColor: string | null = null;
    if (markEl) {
      highlightBg = markEl.style.backgroundColor || 'rgba(234, 179, 8, 0.25)';
      highlightColor = markEl.style.color || '#fef08a';
    }

    setFormatPainterState({
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      strikethrough: isStrike,
      color,
      highlightBg,
      highlightColor,
      isCode: !!codeEl
    });
    setPainterToast('Pincel ativo: selecione o texto de destino para aplicar o estilo');
    setShowFloatingAction(false);
  }, [formatPainterState]);

  // Aplicar formato copiado pelo pincel no texto selecionado
  const applyCapturedFormat = useCallback((format: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    color?: string | null;
    highlightBg?: string | null;
    highlightColor?: string | null;
    isCode?: boolean;
  }) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editableContainerRef.current) return;

    pushUndoSnapshot();

    // 1. Limpa formatação existente no destino
    document.execCommand('removeFormat', false);

    // 2. Aplica estilos básicos
    if (format.bold) document.execCommand('bold', false);
    if (format.italic) document.execCommand('italic', false);
    if (format.underline) document.execCommand('underline', false);
    if (format.strikethrough) document.execCommand('strikeThrough', false);

    // 3. Aplica cor
    if (format.color && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.color = format.color;
      span.appendChild(range.extractContents());
      range.insertNode(span);

      const newR = document.createRange();
      newR.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newR);
    }

    // 4. Aplica marca-texto / destaque
    if (format.highlightBg && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const mark = document.createElement('mark');
      mark.style.backgroundColor = format.highlightBg;
      mark.style.color = format.highlightColor || '#fef08a';
      mark.style.padding = '2px 6px';
      mark.style.borderRadius = '4px';
      mark.appendChild(range.extractContents());
      range.insertNode(mark);

      const newR = document.createRange();
      newR.selectNodeContents(mark);
      sel.removeAllRanges();
      sel.addRange(newR);
    }

    // 5. Aplica código inline
    if (format.isCode && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const code = document.createElement('code');
      code.className = 'bg-card border border-card-border/60 text-amber-300 px-1.5 py-0.5 rounded-md font-mono text-xs';
      code.appendChild(range.extractContents());
      range.insertNode(code);
    }

    // 6. Varredura de segurança contra resíduos de mark sem background
    editableContainerRef.current?.querySelectorAll('mark').forEach((m) => {
      const htmlMark = m as HTMLElement;
      if (!htmlMark.textContent || htmlMark.textContent.trim().length === 0) {
        htmlMark.remove();
      } else if (!htmlMark.style.background && !htmlMark.style.backgroundColor) {
        const parent = htmlMark.parentNode;
        if (parent) {
          while (htmlMark.firstChild) {
            parent.insertBefore(htmlMark.firstChild, htmlMark);
          }
          parent.removeChild(htmlMark);
        }
      }
    });

    syncEditorToMarkdownAndSave();
    setFormatPainterState(null);
    setPainterToast('Estilo pintado com sucesso!');
    setTimeout(() => setPainterToast(null), 2000);
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave]);

  const insertTable = useCallback(() => {
    pushUndoSnapshot();
    const tableHtml = `<div class="my-4 overflow-x-auto rounded-xl border border-card-border/80 bg-panel/30 shadow-md"><table class="w-full border-collapse text-left text-xs leading-relaxed" style="width: 100%; border-collapse: collapse;"><thead class="bg-card/90 text-slate-200 border-b border-card-border"><tr style="border-bottom: 1px solid rgba(255,255,255,0.15);"><th class="px-3.5 py-2.5 font-bold text-accent-light border-r border-card-border/40" style="padding: 8px 12px; font-weight: 700; color: #38bdf8; border-right: 1px solid rgba(255,255,255,0.1);">Item</th><th class="px-3.5 py-2.5 font-bold text-accent-light" style="padding: 8px 12px; font-weight: 700; color: #38bdf8;">Descrição</th></tr></thead><tbody><tr class="hover:bg-card/40 border-b border-card-border/30" style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td class="px-3.5 py-2.5 border-r border-card-border/30 text-slate-300" style="padding: 8px 12px; border-right: 1px solid rgba(255,255,255,0.06);">1</td><td class="px-3.5 py-2.5 text-slate-300" style="padding: 8px 12px;">Detalhes do item</td></tr></tbody></table></div><p><br></p>`;
    if (editableContainerRef.current) {
      editableContainerRef.current.focus();
      document.execCommand('insertHTML', false, tableHtml);
      syncEditorToMarkdownAndSave();
    }
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave]);

  const insertDivider = useCallback(() => {
    pushUndoSnapshot();
    const hrHtml = `<hr class="border-0 border-t border-card-border/80 my-6" /><p><br></p>`;
    if (editableContainerRef.current) {
      editableContainerRef.current.focus();
      document.execCommand('insertHTML', false, hrHtml);
      syncEditorToMarkdownAndSave();
    }
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave]);

  const insertWikilinkDirect = useCallback((noteTitle: string) => {
    pushUndoSnapshot();
    const badgeHtml = `<span class="wikilink-badge inline-flex items-center px-2 py-0.5 rounded-lg bg-accent/15 border border-accent/30 text-accent-light font-medium text-xs cursor-pointer select-none" data-wikilink="${noteTitle}">[[ ${noteTitle} ]]</span>&nbsp;`;
    if (editableContainerRef.current) {
      editableContainerRef.current.focus();
      document.execCommand('insertHTML', false, badgeHtml);
      syncEditorToMarkdownAndSave();
    }
    setIsWikilinkModalOpen(false);
    setWikilinkSearch('');
  }, [pushUndoSnapshot, syncEditorToMarkdownAndSave]);




  const handleMoveNote = async (noteId: string, targetFolder: string) => {
    try {
      const cleanTarget = normalizeFolderPath(targetFolder);
      const updated = await api.moveNote(noteId, cleanTarget);
      await fetchNotesAndFolders();
      if (activeNote?.id === noteId) {
        setActiveNote(updated);
        setEditFolder(getNoteFolder(updated));
      }
      setMoveModalNote(null);
    } catch (err: any) {
      alert(`Erro ao mover nota: ${err.message}`);
    }
  };

  const handleMoveFolder = async (sourceFolder: string, targetParentFolder: string) => {
    try {
      await api.moveFolder(sourceFolder, targetParentFolder);
      await fetchNotesAndFolders();
    } catch (err: any) {
      alert(`Erro ao mover pasta: ${err.message}`);
    }
  };

  const fetchGraph = async () => {
    try {
      const data = await api.getNotesGraph();
      setGraphData(data);
    } catch {
      // ignore
    }
  };

  const fetchDeletedNotes = async () => {
    setIsLoadingTrash(true);
    try {
      const data = await api.listDeletedNotes();
      setDeletedNotes(data.items || []);
      if (data.retention) {
        setRetentionPolicy(data.retention as any);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingTrash(false);
    }
  };

  const handleRunGitSafeAudit = async () => {
    setIsLoadingAudit(true);
    setIsGitSafeModalOpen(true);
    try {
      const report = await api.auditGitSafe();
      setGitSafeReport(report);
    } catch (err: any) {
      alert(`Falha na auditoria GitSafe: ${err.message}`);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleTestSanitization = async () => {
    if (!testSanitizeInput.trim()) return;
    try {
      const res = await api.sanitizeText(testSanitizeInput);
      setTestSanitizeOutput(res);
    } catch (err: any) {
      alert(`Erro ao testar sanitização: ${err.message}`);
    }
  };

  const handleRestoreNote = async (backupFilename: string) => {
    try {
      const result = await api.restoreDeletedNote(backupFilename);
      await fetchNotesAndFolders();
      await fetchDeletedNotes();
      if (result.note) {
        selectNote(result.note);
        setSidebarTab('folders');
      }
    } catch (err: any) {
      alert(`Erro ao restaurar nota: ${err.message}`);
    }
  };

  const handlePermanentlyDeleteNote = async (backupFilename: string) => {
    if (!confirm('Deseja excluir permanentemente este arquivo? Esta ação não pode ser desfeita.')) return;
    try {
      await api.permanentlyDeleteNote(backupFilename);
      await fetchDeletedNotes();
      if (selectedDeletedNote?.backupFilename === backupFilename) {
        setSelectedDeletedNote(null);
      }
    } catch (err: any) {
      alert(`Erro ao excluir permanentemente: ${err.message}`);
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Tem certeza que deseja esvaziar a lixeira e apagar todas as notas excluídas permanentemente?')) return;
    try {
      await api.emptyTrash();
      await fetchDeletedNotes();
      setSelectedDeletedNote(null);
    } catch (err: any) {
      alert(`Erro ao esvaziar lixeira: ${err.message}`);
    }
  };

  const handleChangeRetention = async (newRetention: '30_days' | '90_days' | '120_days' | '1_year' | 'never') => {
    setRetentionPolicy(newRetention);
    try {
      await api.updateConfig({ deletedNotesRetention: newRetention });
      await api.cleanupTrash(newRetention);
      await fetchDeletedNotes();
    } catch (err: any) {
      alert(`Erro ao atualizar retenção: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchNotesAndFolders();
    fetchDeletedNotes();
  }, []);

  useEffect(() => {
    if (sidebarTab === 'trash') {
      fetchDeletedNotes();
    }
  }, [sidebarTab]);

  useEffect(() => {
    if (!targetNoteIdOrTitle || notes.length === 0) return;
    const cleanTarget = targetNoteIdOrTitle.replace(/\.md$/i, '').trim().toLowerCase();
    const found = notes.find(n => 
      n.id.toLowerCase() === cleanTarget ||
      n.title.toLowerCase() === cleanTarget ||
      n.filename.toLowerCase() === `${cleanTarget}.md` ||
      (n.relativePath && n.relativePath.toLowerCase().endsWith(cleanTarget)) ||
      (n.relativePath && n.relativePath.toLowerCase().endsWith(`${cleanTarget}.md`))
    );
    if (found) {
      selectNote(found);
      setViewMode('editor');
      setSidebarTab('folders');
    }
  }, [targetNoteIdOrTitle, notes]);

  useEffect(() => {
    if (activeNote) {
      if (currentLoadedNoteIdRef.current !== activeNote.id) {
        currentLoadedNoteIdRef.current = activeNote.id;
        setEditTitle(activeNote.title);
        setEditFolder(getNoteFolder(activeNote));
        setEditContent(activeNote.content);
        if (editableContainerRef.current) {
          const initialHtml = markdownToEditorHtml(activeNote.content);
          editableContainerRef.current.innerHTML = initialHtml;
          lastRecordedHtmlRef.current = initialHtml;
          undoStackRef.current = [];
          redoStackRef.current = [];
        }
      }
    } else {
      currentLoadedNoteIdRef.current = null;
      undoStackRef.current = [];
      redoStackRef.current = [];
    }
  }, [activeNote, getNoteFolder]);


  useEffect(() => {
    if (viewMode === 'graph') {
      fetchGraph();
    }
  }, [viewMode]);

  // OBSIDIAN-STYLE FORCE-DIRECTED CANVAS SIMULATION ENGINE
  useEffect(() => {
    if (viewMode !== 'graph' || !canvasRef.current || !graphData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isRunning = true;

    // Filter nodes based on user toggles and search query
    const filteredRawNodes = graphData.nodes.filter(n => {
      if (n.type === 'subject' && !graphShowFolders) return false;
      if (n.type === 'tag' && !graphShowTags) return false;
      if (graphSearchFilter.trim() && !n.label.toLowerCase().includes(graphSearchFilter.toLowerCase())) {
        return false;
      }
      return true;
    });

    const nodeIds = new Set(filteredRawNodes.map(n => n.id));

    const filteredRawLinks = graphData.links.filter(l => {
      if (!graphShowWikilinks && l.type === 'wikilink') return false;
      if (!graphShowFolders && l.type === 'subject') return false;
      if (!graphShowTags && l.type === 'tag') return false;
      return nodeIds.has(l.source) && nodeIds.has(l.target);
    });

    // Resize canvas to match display size and high-DPI
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resizeCanvas();

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Initialize physics nodes
    interface SimNode {
      id: string;
      label: string;
      type: string;
      val: number;
      color: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      connections: number;
      isPinned?: boolean;
    }

    interface SimLink {
      source: SimNode;
      target: SimNode;
      type: string;
    }

    // Map raw nodes to simulation nodes
    const simNodes: SimNode[] = filteredRawNodes.map((n, i) => {
      const angle = (i / Math.max(filteredRawNodes.length, 1)) * 2 * Math.PI;
      const dist = 120 + Math.random() * 220;
      const radius = n.type === 'note' ? Math.max(7, Math.min(20, 6 + (n.val / 3))) : (n.type === 'subject' ? 10 : 8);
      const defaultColor = n.type === 'note' ? '#818cf8' : (n.type === 'subject' ? '#f59e0b' : '#10b981');

      return {
        id: n.id,
        label: n.label,
        type: n.type,
        val: n.val,
        color: n.color || defaultColor,
        x: centerX + Math.cos(angle) * dist + (Math.random() - 0.5) * 50,
        y: centerY + Math.sin(angle) * dist + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        radius,
        connections: 0
      };
    });

    const nodeMap = new Map<string, SimNode>();
    simNodes.forEach(n => nodeMap.set(n.id, n));

    const simLinks: SimLink[] = [];
    filteredRawLinks.forEach(l => {
      const s = nodeMap.get(l.source);
      const t = nodeMap.get(l.target);
      if (s && t) {
        s.connections++;
        t.connections++;
        simLinks.push({ source: s, target: t, type: l.type });
      }
    });

    // Viewport transform state
    let panX = 0;
    let panY = 0;
    let zoom = 1;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let draggedNode: SimNode | null = null;
    let hoveredNode: SimNode | null = null;
    let clickStartX = 0;
    let clickStartY = 0;

    const toWorldCoords = (clientX: number, clientY: number) => {
      const bounds = canvas.getBoundingClientRect();
      const screenX = clientX - bounds.left;
      const screenY = clientY - bounds.top;
      const curCenterX = bounds.width / 2;
      const curCenterY = bounds.height / 2;
      return {
        x: (screenX - curCenterX - panX) / zoom + curCenterX,
        y: (screenY - curCenterY - panY) / zoom + curCenterY
      };
    };

    const findNodeAt = (worldX: number, worldY: number): SimNode | null => {
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) {
          return n;
        }
      }
      return null;
    };

    // Physics step
    const updatePhysics = () => {
      const currentRect = canvas.getBoundingClientRect();
      const curCenterX = currentRect.width / 2;
      const curCenterY = currentRect.height / 2;

      // 1. Center Gravity
      simNodes.forEach(n => {
        if (n.isPinned) return;
        const dx = curCenterX - n.x;
        const dy = curCenterY - n.y;
        n.vx += dx * 0.0015;
        n.vy += dy * 0.0015;
      });

      // 2. Node-to-Node Repulsion
      const charge = graphChargeStrength;
      for (let i = 0; i < simNodes.length; i++) {
        const a = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const b = simNodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy + 80;
          const dist = Math.sqrt(distSq);
          const force = (charge * 14) / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!a.isPinned) { a.vx += fx; a.vy += fy; }
          if (!b.isPinned) { b.vx -= fx; b.vy -= fy; }
        }
      }

      // 3. Link Spring Attraction
      simLinks.forEach(link => {
        const s = link.source;
        const t = link.target;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = link.type === 'wikilink' ? 90 : 130;
        const force = (dist - targetDist) * 0.035;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!s.isPinned) { s.vx += fx; s.vy += fy; }
        if (!t.isPinned) { t.vx -= fx; t.vy -= fy; }
      });

      // 4. Integrate & Dampen
      simNodes.forEach(n => {
        if (n.isPinned) return;
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx;
        n.y += n.vy;
      });
    };

    // Render loop with high-DPI preservation
    const render = () => {
      if (!isRunning) return;
      updatePhysics();

      const currentRect = canvas.getBoundingClientRect();
      const cssWidth = currentRect.width;
      const cssHeight = currentRect.height;
      const dpr = window.devicePixelRatio || 1;

      // Match canvas internal resolution to physical device pixels
      const targetPixelWidth = Math.round(cssWidth * dpr);
      const targetPixelHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== targetPixelWidth || canvas.height !== targetPixelHeight) {
        canvas.width = targetPixelWidth;
        canvas.height = targetPixelHeight;
      }

      const curCenterX = cssWidth / 2;
      const curCenterY = cssHeight / 2;

      ctx.save();
      // Apply High-DPI scaling
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Apply Pan & Zoom around center in CSS space
      ctx.translate(curCenterX + panX, curCenterY + panY);
      ctx.scale(zoom, zoom);
      ctx.translate(-curCenterX, -curCenterY);

      // Connected nodes set for hover highlighting
      const connectedNodeIds = new Set<string>();
      if (hoveredNode) {
        connectedNodeIds.add(hoveredNode.id);
        simLinks.forEach(l => {
          if (l.source.id === hoveredNode?.id) connectedNodeIds.add(l.target.id);
          if (l.target.id === hoveredNode?.id) connectedNodeIds.add(l.source.id);
        });
      }

      // 1. Draw Links
      simLinks.forEach(l => {
        const isHighlighted = hoveredNode && (l.source.id === hoveredNode.id || l.target.id === hoveredNode.id);
        const isDimmed = hoveredNode && !isHighlighted;

        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);

        if (isHighlighted) {
          ctx.strokeStyle = '#a5b4fc';
          ctx.lineWidth = 2.2;
          ctx.globalAlpha = 0.95;
        } else if (isDimmed) {
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.15;
        } else {
          ctx.strokeStyle = l.type === 'wikilink' ? '#4f46e5' : (l.type === 'subject' ? '#92400e' : '#065f46');
          ctx.lineWidth = l.type === 'wikilink' ? 1.4 : 1.0;
          ctx.globalAlpha = 0.45;
        }
        ctx.stroke();
      });

      // 2. Draw Nodes
      simNodes.forEach(n => {
        const isHovered = hoveredNode?.id === n.id;
        const isConnected = connectedNodeIds.has(n.id);
        const isDimmed = hoveredNode && !isConnected;

        ctx.globalAlpha = isDimmed ? 0.2 : 1.0;

        // Halo / Glow
        if (isHovered || isConnected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 7, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered ? 'rgba(99, 102, 241, 0.35)' : 'rgba(165, 180, 252, 0.2)';
          ctx.fill();
        }

        // Main Node Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = isHovered ? 14 : (isDimmed ? 0 : 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Border ring
        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Node Label
        const shouldShowLabel = isHovered || isConnected || zoom > 0.85 || n.type === 'subject' || n.val > 14;
        if (shouldShowLabel && !isDimmed) {
          ctx.font = `${isHovered ? 'bold 11px' : '10px'} system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const textY = n.y + n.radius + 10;
          const textMetrics = ctx.measureText(n.label);
          const bgPad = 3;

          // Background pill for readability
          ctx.fillStyle = 'rgba(11, 13, 19, 0.85)';
          ctx.fillRect(
            n.x - textMetrics.width / 2 - bgPad,
            textY - 6 - bgPad,
            textMetrics.width + bgPad * 2,
            12 + bgPad * 2
          );

          ctx.fillStyle = isHovered ? '#ffffff' : (n.type === 'subject' ? '#fde68a' : (n.type === 'tag' ? '#6ee7b7' : '#cbd5e1'));
          ctx.fillText(n.label, n.x, textY);
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    // Event Handlers
    const handleMouseDown = (e: MouseEvent) => {
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      const world = toWorldCoords(e.clientX, e.clientY);
      const hit = findNodeAt(world.x, world.y);

      if (hit) {
        draggedNode = hit;
        hit.isPinned = true;
      } else {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const world = toWorldCoords(e.clientX, e.clientY);

      if (draggedNode) {
        draggedNode.x = world.x;
        draggedNode.y = world.y;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
      } else if (isPanning) {
        panX += e.clientX - panStartX;
        panY += e.clientY - panStartY;
        panStartX = e.clientX;
        panStartY = e.clientY;
      } else {
        const hit = findNodeAt(world.x, world.y);
        hoveredNode = hit;
        if (hit) {
          setHoveredGraphNode({
            label: hit.label,
            type: hit.type,
            connections: hit.connections
          });
          canvas.style.cursor = 'pointer';
        } else {
          setHoveredGraphNode(null);
          canvas.style.cursor = isPanning ? 'grabbing' : 'grab';
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const distMoved = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);

      if (draggedNode) {
        draggedNode.isPinned = false;
        // If it was a quick click on a note without dragging
        if (distMoved < 5) {
          const clickedNode = draggedNode;
          if (clickedNode.type === 'note') {
            const rawId = clickedNode.id.replace(/^note_/, '');
            const targetNote = notes.find(n => n.id === rawId || n.filename === `${rawId}.md`);
            if (targetNote) {
              selectNote(targetNote);
              setViewMode('editor');
            }
          } else if (clickedNode.type === 'subject') {
            setSelectedFolderFilter(clickedNode.label);
            setViewMode('editor');
          } else if (clickedNode.type === 'tag') {
            setSearchQuery(clickedNode.label);
            setViewMode('editor');
          }
        }
        draggedNode = null;
      }

      isPanning = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.2, Math.min(4.0, zoom * zoomFactor));
      zoom = newZoom;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', resizeCanvas);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [viewMode, graphData, graphShowFolders, graphShowTags, graphShowWikilinks, graphChargeStrength, graphSearchFilter, notes]);

  // Full Navigation History Stack (supports Mouse Back/Forward & Alt+Arrow buttons)
  interface NoteNavHistoryItem {
    notebookId: string;
    noteId: string | null;
    viewMode: 'editor' | 'graph';
  }

  const [navHistory, setNavHistory] = useState<NoteNavHistoryItem[]>([
    { notebookId: 'all', noteId: null, viewMode: 'editor' }
  ]);
  const [navHistoryIndex, setNavHistoryIndex] = useState<number>(0);
  const isNavigatingHistoryRef = useRef<boolean>(false);

  const pushNavHistory = useCallback((item: NoteNavHistoryItem) => {
    if (isNavigatingHistoryRef.current) return;
    setNavHistory(prev => {
      const current = prev[navHistoryIndex];
      if (
        current &&
        current.notebookId === item.notebookId &&
        current.noteId === item.noteId &&
        current.viewMode === item.viewMode
      ) {
        return prev;
      }
      const next = prev.slice(0, navHistoryIndex + 1);
      next.push(item);
      return next;
    });
    setNavHistoryIndex(prev => prev + 1);
  }, [navHistoryIndex]);

  const selectNote = (note: FrankNote) => {
    setActiveNote(note);
    setEditTitle(note.title);
    const folderPath = getNoteFolder(note);
    setEditFolder(folderPath);
    setEditContent(note.content);
    currentLoadedNoteIdRef.current = note.id;

    if (editableContainerRef.current) {
      editableContainerRef.current.innerHTML = markdownToEditorHtml(note.content);
    }

    // Focus the sidebar on this note's notebook and expand sidebar
    const nbId = folderPath.split('/')[0] || 'Geral';
    setSelectedNotebookId(nbId);
    setIsSidebarCollapsed(false);
    // Expand the notebook and subfolder in sidebar so the active note is visible
    setCollapsedFolders(prev => ({ ...prev, [folderPath]: false, [`nb:${nbId}`]: false }));

    pushNavHistory({ notebookId: nbId, noteId: note.id, viewMode: 'editor' });
  };


  const goToHome = () => {
    setSelectedNotebookId('all');
    setActiveNote(null);
    setViewMode('editor');
    setIsSidebarCollapsed(true);

    pushNavHistory({ notebookId: 'all', noteId: null, viewMode: 'editor' });
  };

  const openNotebook = (nbId: string) => {
    setSelectedNotebookId(nbId);
    setActiveNote(null);
    setIsSidebarCollapsed(false);

    pushNavHistory({ notebookId: nbId, noteId: null, viewMode: 'editor' });
  };

  const handleNavBack = useCallback(() => {
    setNavHistoryIndex(prevIndex => {
      if (prevIndex > 0) {
        const targetIndex = prevIndex - 1;
        const target = navHistory[targetIndex];
        if (target) {
          isNavigatingHistoryRef.current = true;
          setSelectedNotebookId(target.notebookId);
          setViewMode(target.viewMode);
          if (target.noteId) {
            const found = notes.find(n => n.id === target.noteId);
            if (found) {
              setActiveNote(found);
              setEditTitle(found.title);
              setEditFolder(getNoteFolder(found));
              setEditContent(found.content);
              currentLoadedNoteIdRef.current = found.id;
              if (editableContainerRef.current) {
                editableContainerRef.current.innerHTML = markdownToEditorHtml(found.content);
              }
              setIsSidebarCollapsed(false);
            } else {
              setActiveNote(null);
            }
          } else {
            setActiveNote(null);
            if (target.notebookId === 'all') {
              setIsSidebarCollapsed(true);
            } else {
              setIsSidebarCollapsed(false);
            }
          }
          setTimeout(() => {
            isNavigatingHistoryRef.current = false;
          }, 60);
        }
        return targetIndex;
      } else {
        // Fallback: if already at root of history stack, return to Home if viewing a note or notebook
        if (activeNote !== null || selectedNotebookId !== 'all' || viewMode === 'graph') {
          goToHome();
        }
        return prevIndex;
      }
    });
  }, [navHistory, notes, activeNote, selectedNotebookId, viewMode]);

  const handleNavForward = useCallback(() => {
    setNavHistoryIndex(prevIndex => {
      if (prevIndex < navHistory.length - 1) {
        const targetIndex = prevIndex + 1;
        const target = navHistory[targetIndex];
        if (target) {
          isNavigatingHistoryRef.current = true;
          setSelectedNotebookId(target.notebookId);
          setViewMode(target.viewMode);
          if (target.noteId) {
            const found = notes.find(n => n.id === target.noteId);
            if (found) {
              setActiveNote(found);
              setEditTitle(found.title);
              setEditFolder(getNoteFolder(found));
              setEditContent(found.content);
              currentLoadedNoteIdRef.current = found.id;
              if (editableContainerRef.current) {
                editableContainerRef.current.innerHTML = markdownToEditorHtml(found.content);
              }
              setIsSidebarCollapsed(false);
            } else {
              setActiveNote(null);
            }
          } else {
            setActiveNote(null);
            if (target.notebookId === 'all') {
              setIsSidebarCollapsed(true);
            } else {
              setIsSidebarCollapsed(false);
            }
          }
          setTimeout(() => {
            isNavigatingHistoryRef.current = false;
          }, 60);
        }
        return targetIndex;
      }
      return prevIndex;
    });
  }, [navHistory, notes]);


  const goBack = () => {
    handleNavBack();
  };

  // Mouse Buttons (Button 3 = Back, Button 4 = Forward) and Keyboard Navigation
  useEffect(() => {
    const handleMouseNav = (e: MouseEvent) => {
      if (e.button === 3) {
        // Thumb Back Button
        e.preventDefault();
        e.stopPropagation();
        handleNavBack();
      } else if (e.button === 4) {
        // Thumb Forward Button
        e.preventDefault();
        e.stopPropagation();
        handleNavForward();
      }
    };

    const handlePreventNativeMouseNav = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      );
      if (isInput) return;

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavForward();
      }
    };

    window.addEventListener('mouseup', handleMouseNav);
    window.addEventListener('mousedown', handlePreventNativeMouseNav);
    window.addEventListener('auxclick', handlePreventNativeMouseNav);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mouseup', handleMouseNav);
      window.removeEventListener('mousedown', handlePreventNativeMouseNav);
      window.removeEventListener('auxclick', handlePreventNativeMouseNav);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNavBack, handleNavForward]);

  const handleCreateNoteInFolder = (folderName: string = 'Geral') => {
    const newNoteTemplate = {
      title: 'Nova Anotação ' + new Date().toLocaleDateString('pt-BR'),
      folder: folderName,
      subject: folderName,
      content: `# Nova Anotação\n\nComece a escrever sua anotação aqui... Use a barra de ferramentas para negrito, cores, marca-texto, tabelas ou checklists.\n`,
      isProjectSpecific: false
    };

    api.saveNote(newNoteTemplate).then((created) => {
      fetchNotesAndFolders();
      selectNote(created);
    });
  };


  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.createFolder(newFolderName.trim());
      setIsCreatingFolder(false);
      setNewFolderName('');
      await fetchNotesAndFolders();
    } catch (err: any) {
      alert(`Erro ao criar pasta: ${err.message}`);
    }
  };

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookName.trim()) return;
    try {
      const created = newNotebookName.trim();
      await api.createFolder(created);
      setIsCreatingNotebook(false);
      setNewNotebookName('');
      await fetchNotesAndFolders();
      setSelectedNotebookId(created);
    } catch (err: any) {
      alert(`Erro ao criar caderno: ${err.message}`);
    }
  };

  const toggleFolderCollapse = (folderName: string) => {
    setCollapsedFolders(prev => {
      const willBeExpanded = !!prev[folderName]; // if currently collapsed, will expand
      if (isSingleNotebookMode && folderName.startsWith('nb:') && willBeExpanded) {
        // Modo foco em um caderno por vez: colapsa todos os outros cadernos
        const next: Record<string, boolean> = {};
        // fecha todos
        notebooksList.forEach(nb => {
          next[`nb:${nb.id}`] = true;
        });
        next[folderName] = false;
        return next;
      }
      return {
        ...prev,
        [folderName]: !prev[folderName]
      };
    });
  };

  const handleReviewFolderWithAgent = (folderName: string) => {
    const cleanFolder = normalizeFolderPath(folderName);
    const folderNotes = notes.filter(n => getNoteFolder(n) === cleanFolder);
    if (folderNotes.length === 0) {
      alert(`A pasta "${folderName}" está vazia.`);
      return;
    }

    const payload = `Quero fazer uma revisão e aprimoramento visual completo de todas as anotações da pasta "${folderName}".

Aqui estão as notas atuais da pasta:

${folderNotes.map(n => `### [[${n.title}]] (Arquivo: ${n.filename})\n${n.content}`).join('\n\n---\n\n')}

Por favor, revise o conteúdo, organize com títulos hierárquicos, tabelas comparativas, diagramas Mermaid, callouts de destaque e checklists estruturados para deixar as anotações visualmente muito agradáveis, claras e profissionais. Salve as melhorias diretamente no Notes Module Vault usando a ferramenta note_save.`;

    if (onMentionInChat) {
      onMentionInChat({
        id: `review-${folderName}`,
        title: `Revisão de Notas: ${folderName}`,
        filename: 'folder_review.md',
        folder: folderName,
        subject: folderName,
        tags: ['#revisao', '#formatacao'],
        content: payload,
        links: folderNotes.map(n => n.title),
        backlinks: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  };

  const handleSaveActiveNote = async () => {
    if (!activeNote) return;
    setIsSaving(true);
    let mdToSave = editContent;
    if (editableContainerRef.current) {
      mdToSave = editorHtmlToMarkdown(editableContainerRef.current.innerHTML);
      setEditContent(mdToSave);
    }
    try {
      const updated = await api.saveNote({
        id: activeNote.id,
        title: editTitle,
        folder: editFolder,
        subject: editFolder,
        content: mdToSave,
        isProjectSpecific: activeNote.isProjectSpecific
      });
      setActiveNote(updated);
      setLastSavedTime(new Date());
      fetchNotesAndFolders();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };


  const handleDeleteNote = async (id: string, isProjectSpecific?: boolean) => {
    const targetNote = notes.find(n => n.id === id);
    const title = targetNote?.title || id;
    if (!confirm(`Deseja mover a nota "${title}" para a lixeira?\n\n🛡️ Um backup de segurança será preservado automaticamente em .backups.`)) return;
    try {
      await api.deleteNote(id, isProjectSpecific);
      await fetchNotesAndFolders();
      await fetchDeletedNotes();
      if (activeNote?.id === id) {
        const remaining = notes.filter(n => n.id !== id);
        if (remaining.length > 0 && selectedNotebookId !== 'all') {
          selectNote(remaining[0]);
        } else {
          setActiveNote(null);
        }
      }
    } catch (err: any) {
      alert(`Erro ao deletar: ${err.message}`);
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (folderName === 'Geral') {
      alert('A pasta padrão "Geral" não pode ser excluída.');
      return;
    }
    const cleanFolder = normalizeFolderPath(folderName);
    const folderNotes = notes.filter(n => {
      const f = getNoteFolder(n);
      return f === cleanFolder || f.startsWith(`${cleanFolder}/`);
    });
    
    const countMsg = folderNotes.length === 1 ? '1 nota' : `${folderNotes.length} notas`;
    const confirmMessage = `Tem certeza que deseja mover toda a pasta "${folderName}" (${countMsg}) para a lixeira?\n\n` +
      `🛡️ Todas as notas serão arquivadas no backup de segurança (.backups) do Obsidian antes da exclusão.`;

    if (!confirm(confirmMessage)) return;

    try {
      await api.deleteFolder(folderName);
      await fetchNotesAndFolders();
      await fetchDeletedNotes();
      if (viewMode === 'graph') {
        fetchGraph();
      }
      if (selectedNotebookId === folderName) {
        setSelectedNotebookId('all');
      }
      if (activeNote) {
        const activeNoteFolder = getNoteFolder(activeNote);
        if (activeNoteFolder === cleanFolder || activeNoteFolder.startsWith(`${cleanFolder}/`)) {
          setActiveNote(null);
        }
      }
    } catch (err: any) {
      alert(`Erro ao excluir pasta: ${err.message}`);
    }
  };

  const handleDownloadSingleNote = async (note: FrankNote, format: ExportFormat = 'md_clean') => {
    setIsExporting(true);
    setIsExportMenuOpen(false);
    try {
      const res = await downloadNoteInFormat(note, format);
      const label = format === 'pdf' ? 'PDF' : format === 'word' ? 'Word (.doc)' : format === 'md_tags' ? 'Markdown (.md com tags)' : 'Markdown (.md)';
      setExportToast({
        message: `Nota exportada em ${label} para a pasta Downloads!`,
        filename: res.filename
      });
      setTimeout(() => setExportToast(null), 4500);
    } catch (err: any) {
      alert(`Erro ao exportar nota: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadEntireNotebook = async (notebookName: string, format: ExportFormat = 'md_clean') => {
    const isAll = notebookName === 'all' || !notebookName;
    const targetNotes = isAll 
      ? notes 
      : notes.filter(n => {
          const f = n.folder || 'Geral';
          return f === notebookName || f.startsWith(`${notebookName}/`);
        });

    if (targetNotes.length === 0) {
      alert(`Nenhuma anotação encontrada no caderno "${notebookName}".`);
      return;
    }

    setIsExporting(true);
    try {
      const title = isAll ? 'Todos_os_Cadernos' : notebookName;
      const res = await downloadFormattedNotebook(title, targetNotes, format);
      const label = format === 'pdf' ? 'PDF' : format === 'word' ? 'Word (.doc)' : format === 'md_tags' ? 'Markdown (.md com tags)' : 'Markdown (.md)';
      setExportToast({
        message: `Caderno completo exportado em ${label} para a pasta Downloads!`,
        filename: res.filename
      });
      setTimeout(() => setExportToast(null), 4500);
    } catch (err: any) {
      alert(`Erro ao exportar caderno: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportNotionPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notionPasteTitle.trim() || !notionPasteContent.trim()) return;

    setIsImportingNotion(true);
    try {
      await api.importNotionNotes([{
        filename: `${notionPasteTitle.trim()}.md`,
        content: notionPasteContent,
        folder: notionTargetFolder.trim() || 'Notion Import'
      }]);
      setIsNotionModalOpen(false);
      setNotionPasteTitle('');
      setNotionPasteContent('');
      await fetchNotesAndFolders();
      alert('Nota importada com sucesso do Notion!');
    } catch (err: any) {
      alert(`Erro ao importar nota: ${err.message}`);
    } finally {
      setIsImportingNotion(false);
    }
  };

  const handleImportNotionFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImportingNotion(true);
    try {
      const items: Array<{ filename: string; content: string; folder?: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          const text = await file.text();
          items.push({
            filename: file.name,
            content: text,
            folder: notionTargetFolder.trim() || 'Notion Import'
          });
        }
      }

      if (items.length > 0) {
        const res = await api.importNotionNotes(items);
        alert(`${res.importedCount} notas importadas com sucesso do Notion!`);
        setIsNotionModalOpen(false);
        await fetchNotesAndFolders();
      }
    } catch (err: any) {
      alert(`Erro ao importar arquivos: ${err.message}`);
    } finally {
      setIsImportingNotion(false);
    }
  };

  const copyNoteContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTextSelection = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';

      // Se o Pincel de Formatação estiver ativo e o usuário selecionou texto de destino, aplica imediatamente!
      if (formatPainterState && text && text.length > 0) {
        applyCapturedFormat(formatPainterState);
        return;
      }

      if (text && text.length >= 2) {
        setSelectedText(text);
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const topPos = rect.top < 80 ? rect.bottom + 12 : rect.top - 52;
          setFloatingActionPos({
            x: Math.min(Math.max(rect.left + rect.width / 2 - 130, 20), window.innerWidth - 340),
            y: Math.max(topPos, 12)
          });
          setShowFloatingAction(true);
        }
      } else {
        setShowFloatingAction(false);
      }
    }, 20);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length >= 2) {
      e.preventDefault();
      setSelectedText(selection);
      setContextMenuPos({
        x: Math.min(e.clientX, window.innerWidth - 260),
        y: Math.min(e.clientY, window.innerHeight - 200)
      });
      setShowFloatingAction(false);
    }
  };

  // Group notes by folder
  const allFolderNames = Array.from(new Set([
    ...folders.map(normalizeFolderPath),
    ...notes.map(n => getNoteFolder(n))
  ])).filter(f => f && !f.startsWith('.')).sort();

  // All highlights extracted from notes across the vault
  const allVaultHighlights = useMemo<ExtractedHighlight[]>(() => {
    const list: ExtractedHighlight[] = [];
    notes.forEach(n => {
      const contentToUse = (activeNote && n.id === activeNote.id) ? (editContent || n.content) : n.content;
      const hls = extractHighlightsFromContent(contentToUse, n.id, n.title, getNoteFolder(n));
      list.push(...hls);
    });
    return list;
  }, [notes, activeNote, editContent, getNoteFolder]);

  // Highlights for currently active note
  const currentNoteHighlights = useMemo<ExtractedHighlight[]>(() => {
    if (!activeNote) return [];
    const contentToUse = editContent || activeNote.content;
    return extractHighlightsFromContent(contentToUse, activeNote.id, activeNote.title, getNoteFolder(activeNote));
  }, [activeNote, editContent, getNoteFolder]);

  // Count by color according to scope
  const highlightColorCounts = useMemo<Record<string, number>>(() => {
    const source: ExtractedHighlight[] = highlightScopeFilter === 'current' ? currentNoteHighlights : allVaultHighlights;
    const counts: Record<string, number> = { all: source.length, yellow: 0, green: 0, blue: 0, purple: 0, orange: 0, pink: 0 };
    source.forEach((h: ExtractedHighlight) => {
      if (counts[h.colorId] !== undefined) {
        counts[h.colorId]++;
      }
    });
    return counts;
  }, [highlightScopeFilter, currentNoteHighlights, allVaultHighlights]);

  // Filtered highlights list based on scope, color, and search
  const filteredHighlights = useMemo<ExtractedHighlight[]>(() => {
    const source: ExtractedHighlight[] = highlightScopeFilter === 'current' ? currentNoteHighlights : allVaultHighlights;
    return source.filter((h: ExtractedHighlight) => {
      if (highlightColorFilter !== 'all' && h.colorId !== highlightColorFilter) return false;
      const effectiveSearch = (highlightSearchQuery || searchQuery).trim().toLowerCase();
      if (effectiveSearch) {
        const matchesText = h.text.toLowerCase().includes(effectiveSearch);
        const matchesTitle = h.noteTitle.toLowerCase().includes(effectiveSearch);
        const matchesFolder = h.folder.toLowerCase().includes(effectiveSearch);
        if (!matchesText && !matchesTitle && !matchesFolder) return false;
      }
      return true;
    });
  }, [highlightScopeFilter, currentNoteHighlights, allVaultHighlights, highlightColorFilter, highlightSearchQuery, searchQuery]);

  // Jump smoothly to note & highlight mark in visual editor
  const handleJumpToHighlight = useCallback((hl: ExtractedHighlight) => {
    if (!activeNote || activeNote.id !== hl.noteId) {
      const targetNote = notes.find(n => n.id === hl.noteId);
      if (targetNote) {
        selectNote(targetNote);
      }
    }
    setTimeout(() => {
      if (!editableContainerRef.current) return;
      const marks = Array.from(editableContainerRef.current.querySelectorAll('mark'));
      const targetMark = marks.find(m => m.textContent?.trim().toLowerCase() === hl.text.trim().toLowerCase()) 
        || marks.find(m => m.textContent?.toLowerCase().includes(hl.text.toLowerCase().slice(0, 20)));
      if (targetMark) {
        targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetMark.classList.add('ring-4', 'ring-accent', 'animate-pulse');
        setTimeout(() => {
          targetMark.classList.remove('ring-4', 'ring-accent', 'animate-pulse');
        }, 2200);
      }
    }, 150);
  }, [activeNote, notes]);

  // Copy citation as markdown quote with wikilink
  const handleCopyCitation = useCallback((hl: ExtractedHighlight) => {
    const citation = `> "${hl.text}"\n— [[${hl.noteTitle}]]`;
    navigator.clipboard.writeText(citation);
    setCopiedHighlightId(hl.id);
    setTimeout(() => setCopiedHighlightId(null), 2000);
  }, []);

  const filteredNotes = notes.filter(n => {
    const matchesQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const noteFolder = getNoteFolder(n);
    const matchesFolder = selectedFolderFilter === 'all' || noteFolder === selectedFolderFilter;
    return matchesQuery && matchesFolder;
  });

  // Notebook styling and visual details
  const getNotebookDetails = (notebookName: string) => {
    const lower = notebookName.toLowerCase();
    if (lower.includes('carreira') || lower.includes('vaga') || lower.includes('nestle') || lower.includes('candidatura')) {
      return {
        label: notebookName,
        icon: Briefcase,
        color: 'text-blue-400',
        bg: 'bg-blue-950/25 border-blue-500/30',
        badgeBg: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        accentBorder: 'border-blue-500',
        category: 'Carreira'
      };
    }
    if (lower.includes('estudo') || lower.includes('concurso') || lower.includes('prova') || lower.includes('spregula')) {
      return {
        label: notebookName,
        icon: GraduationCap,
        color: 'text-amber-400',
        bg: 'bg-amber-950/25 border-amber-500/30',
        badgeBg: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        accentBorder: 'border-amber-500',
        category: 'Estudos'
      };
    }
    if (lower.includes('projeto') || lower.includes('codigo') || lower.includes('dev') || lower.includes('tellus')) {
      return {
        label: notebookName,
        icon: Code2,
        color: 'text-cyan-400',
        bg: 'bg-cyan-950/25 border-cyan-500/30',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
        accentBorder: 'border-cyan-500',
        category: 'Projetos'
      };
    }
    if (lower.includes('handoff') || lower.includes('session') || lower.includes('memoria') || lower.includes('agent')) {
      return {
        label: notebookName,
        icon: Sparkles,
        color: 'text-rose-400',
        bg: 'bg-rose-950/25 border-rose-500/30',
        badgeBg: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
        accentBorder: 'border-rose-500',
        category: 'Handoffs & Sessões'
      };
    }
    if (lower.includes('quick') || lower.includes('anota') || lower.includes('mao') || lower.includes('manuscrito')) {
      return {
        label: notebookName,
        icon: BookOpen,
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/25 border-emerald-500/30',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        accentBorder: 'border-emerald-500',
        category: 'Anotações'
      };
    }
    return {
      label: notebookName,
      icon: Book,
      color: 'text-purple-400',
      bg: 'bg-purple-950/25 border-purple-500/30',
      badgeBg: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      accentBorder: 'border-purple-500',
      category: 'Geral'
    };
  };

  // Build hierarchical Notebooks & Subfolders structure
  const notebooksMap = new Map<string, {
    id: string;
    subfolders: Map<string, { name: string; path: string; notes: FrankNote[] }>;
    directNotes: FrankNote[];
    allNotes: FrankNote[];
  }>();

  allFolderNames.forEach(folderPath => {
    const segments = folderPath.split('/');
    const notebookId = segments[0] || 'Geral';
    if (!notebooksMap.has(notebookId)) {
      notebooksMap.set(notebookId, {
        id: notebookId,
        subfolders: new Map(),
        directNotes: [],
        allNotes: []
      });
    }

    if (segments.length > 1) {
      const subfolderName = segments.slice(1).join('/');
      const notebook = notebooksMap.get(notebookId)!;
      if (!notebook.subfolders.has(folderPath)) {
        notebook.subfolders.set(folderPath, {
          name: subfolderName,
          path: folderPath,
          notes: []
        });
      }
    }
  });

  filteredNotes.forEach(note => {
    const folderPath = getNoteFolder(note);
    const segments = folderPath.split('/');
    const notebookId = segments[0] || 'Geral';

    if (!notebooksMap.has(notebookId)) {
      notebooksMap.set(notebookId, {
        id: notebookId,
        subfolders: new Map(),
        directNotes: [],
        allNotes: []
      });
    }

    const nb = notebooksMap.get(notebookId)!;
    nb.allNotes.push(note);

    if (segments.length > 1) {
      if (!nb.subfolders.has(folderPath)) {
        nb.subfolders.set(folderPath, {
          name: segments.slice(1).join('/'),
          path: folderPath,
          notes: []
        });
      }
      nb.subfolders.get(folderPath)!.notes.push(note);
    } else {
      nb.directNotes.push(note);
    }
  });

  const notebooksList = Array.from(notebooksMap.values()).map(nb => {
    const sortedSubfolders = Array.from(nb.subfolders.values()).map(sub => ({
      ...sub,
      notes: sub.notes.slice().sort((a, b) => {
        if (notebookSortOrder === 'recent') {
          return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
        }
        return a.title.localeCompare(b.title);
      })
    })).sort((a, b) => a.name.localeCompare(b.name));

    const sortedDirectNotes = nb.directNotes.slice().sort((a, b) => {
      if (notebookSortOrder === 'recent') {
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      }
      return a.title.localeCompare(b.title);
    });

    return {
      id: nb.id,
      subfolders: sortedSubfolders,
      directNotes: sortedDirectNotes,
      allNotes: nb.allNotes,
      totalCount: nb.allNotes.length
    };
  }).sort((a, b) => {
    if (a.id === 'Geral') return 1;
    if (b.id === 'Geral') return -1;
    if (notebookSortOrder === 'count') {
      return b.totalCount - a.totalCount;
    }
    if (notebookSortOrder === 'recent') {
      const maxTimeA = Math.max(0, ...a.allNotes.map(n => n.updatedAt || n.createdAt || 0));
      const maxTimeB = Math.max(0, ...b.allNotes.map(n => n.updatedAt || n.createdAt || 0));
      return maxTimeB - maxTimeA;
    }
    return a.id.localeCompare(b.id);
  });

  const currentSelectedNotebook = selectedNotebookId === 'all' 
    ? null 
    : notebooksList.find(nb => nb.id === selectedNotebookId) || null;

  return (
    <div className="h-full flex flex-col bg-background text-slate-200 overflow-hidden select-none font-sans relative">
      {/* Floating Action Toolbar on Text Selection */}
      {showFloatingAction && selectedText && (
        <div
          ref={floatingBarRef}
          style={{ left: `${floatingActionPos.x}px`, top: `${floatingActionPos.y}px` }}
          className="fixed z-50 bg-[#161822]/95 backdrop-blur-md border border-accent/60 shadow-2xl rounded-2xl p-1.5 flex items-center space-x-1 animate-in fade-in zoom-in-95 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Formatting Tools */}
          <div className="flex items-center space-x-0.5 pr-1 border-r border-card-border/80">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => formatSelectionInNote('**', '**')}
              className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
              title="Negrito (**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => formatSelectionInNote('*', '*')}
              className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
              title="Itálico (*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => formatSelectionInNote('<u>', '</u>')}
              className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
              title="Sublinhado (<u>)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => formatSelectionInNote('~~', '~~')}
              className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
              title="Tachado (~~)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            {/* Floating Color Palette */}
            <div className="relative" ref={floatingColorPickerRef}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => {
                  setIsFloatingColorPickerOpen(!isFloatingColorPickerOpen);
                  setIsFloatingHighlightPickerOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-card-border text-amber-300 hover:text-amber-200 transition-colors flex items-center space-x-0.5"
                title="Cor do Texto"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>

              {isFloatingColorPickerOpen && (
                <div 
                  className="absolute left-0 bottom-full mb-2 p-2 rounded-xl bg-card border border-card-border shadow-2xl z-50 flex items-center space-x-1.5 backdrop-blur-md"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  {TEXT_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={() => applyTextColor(c.hex)}
                      className="p-1 rounded-full hover:scale-125 transition-transform"
                      title={c.name}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${c.bg} block ring-1 ring-white/20`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Floating Highlighter Palette */}
            <div className="relative" ref={floatingHighlightPickerRef}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => {
                  setIsFloatingHighlightPickerOpen(!isFloatingHighlightPickerOpen);
                  setIsFloatingColorPickerOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-card-border text-yellow-300 hover:text-yellow-200 transition-colors flex items-center space-x-0.5"
                title="Marca-texto / Destaque"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>

              {isFloatingHighlightPickerOpen && (
                <div 
                  className="absolute left-0 bottom-full mb-2 p-2 rounded-xl bg-card border border-card-border shadow-2xl z-50 flex items-center space-x-1.5 backdrop-blur-md"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  {HIGHLIGHT_COLORS.map(h => (
                    <button
                      key={h.name}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={() => applyHighlight(h.bg, h.text)}
                      className="p-1 rounded hover:scale-110 transition-transform"
                      title={h.name}
                    >
                      <span className={`w-4 h-4 rounded ${h.circle} block ring-1 ring-white/20`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pincel de Formatação */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={handleToggleFormatPainter}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                formatPainterState 
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/30' 
                  : 'hover:bg-card-border text-slate-300 hover:text-white'
              }`}
              title="Pincel de Formatação (copiar estilo e aplicar em outro texto)"
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </button>

            {/* Limpar Formatação */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={clearFormatting}
              className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
              title="Limpar Marcação e Cores (remover marca-texto e cor personalizada, mantendo negrito e itálico)"
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action Buttons */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => {
              setShowFloatingAction(false);
              onStudyTopic?.(selectedText);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
            title="Iniciar estudo sobre este trecho no chat"
          >
            <GraduationCap className="w-3.5 h-3.5 text-accent-light" />
            <span>Estudar</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => {
              setShowFloatingAction(false);
              onSearchInNewChat?.(`Quero pesquisar e aprofundar sobre o trecho da nota:\n\n"${selectedText}"`);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-600 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
            title="Abrir um novo chat e pesquisar este trecho"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-200" />
            <span>Pesquisar em Novo Chat</span>
          </button>

          {onStartLiveVoice && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => {
                setShowFloatingAction(false);
                onStartLiveVoice(selectedText, activeNote?.content);
              }}
              className="p-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors"
              title="Iniciar Live Voice sobre este trecho"
            >
              <Radio className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => {
              navigator.clipboard.writeText(selectedText);
              setShowFloatingAction(false);
            }}
            className="p-1.5 rounded-xl hover:bg-card-border text-slate-300 hover:text-white transition-colors"
            title="Copiar trecho"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Right Click Context Menu */}
      {contextMenuPos && selectedText && (
        <div
          style={{ left: `${contextMenuPos.x}px`, top: `${contextMenuPos.y}px` }}
          className="fixed z-50 bg-card border border-card-border shadow-2xl rounded-2xl p-1.5 min-w-[250px] flex flex-col space-y-1 animate-in fade-in zoom-in-95 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-card-border text-[10px] text-slate-400 font-mono truncate">
            Seleção: <strong className="text-slate-200">"{selectedText.slice(0, 24)}{selectedText.length > 24 ? '...' : ''}"</strong>
          </div>

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              onStudyTopic?.(selectedText);
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl bg-accent/20 hover:bg-accent text-accent-light hover:text-white font-semibold flex items-center space-x-2 transition-all"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Pesquisar e Estudar sobre</span>
          </button>

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              if (activeNote) {
                onMentionInChat?.({
                  ...activeNote,
                  content: `Explique detalhadamente o trecho "${selectedText}" da anotação [[${activeNote.title}]]:\n\n${activeNote.content}`
                });
              }
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-panel text-slate-300 hover:text-white flex items-center space-x-2 transition-all"
          >
            <HelpCircle className="w-4 h-4 text-brand-cyan" />
            <span>Explicar este Trecho no Chat</span>
          </button>

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              const newNoteTemplate = {
                title: selectedText.slice(0, 40),
                folder: activeNote?.folder || 'Estudos',
                subject: activeNote?.folder || 'Estudos',
                content: `# ${selectedText}\n\nConceito referenciado a partir de [[${activeNote?.title || 'Nota Anterior'}]].\n\n## Definição e Anotações\n`,
                isProjectSpecific: activeNote?.isProjectSpecific || false
              };
              api.saveNote(newNoteTemplate).then((created) => {
                fetchNotesAndFolders();
                selectNote(created);
              });
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-panel text-slate-300 hover:text-white flex items-center space-x-2 transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Criar Nota [[{selectedText.slice(0, 16)}]]</span>
          </button>

          <div className="h-px bg-card-border/60 my-1" />

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              handleToggleFormatPainter();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-panel text-slate-300 hover:text-amber-300 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Paintbrush className="w-4 h-4 text-amber-400" />
            <span>Pincel de Formatação</span>
          </button>

          <button
            onClick={() => {
              setContextMenuPos(null);
              setShowFloatingAction(false);
              clearFormatting();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <RemoveFormatting className="w-4 h-4 text-rose-400" />
            <span>Limpar Marcação e Cores</span>
          </button>
        </div>
      )}

      {/* Notion-style Block / Section Reordering Modal */}
      {isReorderModalOpen && (
        <div 
          onClick={() => setIsReorderModalOpen(false)} 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-card border border-card-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] cursor-default"
          >
            <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <ArrowUpDown className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Organizar Tópicos & Seções da Nota</h3>
                  <p className="text-[11px] text-slate-400">Reordene os blocos e ideias da sua nota à sua preferência</p>
                </div>
              </div>
              <button onClick={() => setIsReorderModalOpen(false)} className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
              {(() => {
                const sections = parseMarkdownSections(editContent);
                if (sections.length <= 1) {
                  return (
                    <div className="p-6 text-center text-slate-400 text-xs space-y-2">
                      <p className="font-semibold text-slate-300">Poucas seções identificadas na nota.</p>
                      <p className="text-[11px]">
                        Adicione títulos com <strong>#</strong>, <strong>##</strong> ou <strong>###</strong> para dividir o documento em tópicos que podem ser facilmente reordenados!
                      </p>
                    </div>
                  );
                }

                return sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="p-3 rounded-2xl bg-panel/70 border border-card-border/80 flex items-center justify-between gap-3 group hover:border-accent/40 transition-all"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-card border border-card-border flex items-center justify-center text-xs font-mono font-bold text-slate-400 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                            sec.level === 1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                            sec.level === 2 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            sec.level === 3 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            'bg-slate-700/30 text-slate-300'
                          }`}>
                            {sec.level === 0 ? 'Intro' : `H${sec.level}`}
                          </span>
                          <span className="font-bold text-xs text-slate-100 truncate">{sec.heading}</span>
                        </div>
                        {sec.content && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {sec.content.replace(/[#*`~\[\]]/g, '').slice(0, 70)}...
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveSection(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-xl hover:bg-card-border text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                        title="Mover tópico para cima"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(idx, 'down')}
                        disabled={idx === sections.length - 1}
                        className="p-1.5 rounded-xl hover:bg-card-border text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                        title="Mover tópico para baixo"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="p-4 border-t border-card-border bg-sidebar flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                {parseMarkdownSections(editContent).length} tópicos na nota
              </span>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all shadow-md shadow-accent/20"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Obsidian Wikilink Quick Inserter Modal */}
      {isWikilinkModalOpen && (
        <div 
          onClick={() => setIsWikilinkModalOpen(false)} 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-card border border-card-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] cursor-default"
          >
            <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <LinkIcon className="w-4 h-4 text-accent-light" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Inserir Conexão [[Wikilink]]</h3>
                  <p className="text-[11px] text-slate-400">Conecta com outra nota e indexa nos grafos do Obsidian</p>
                </div>
              </div>
              <button onClick={() => setIsWikilinkModalOpen(false)} className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-card-border bg-panel">
              <input
                type="text"
                value={wikilinkSearch}
                onChange={(e) => setWikilinkSearch(e.target.value)}
                placeholder="Buscar nota para conectar..."
                className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs text-slate-100 focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-1">
              {notes
                .filter(n => !wikilinkSearch || n.title.toLowerCase().includes(wikilinkSearch.toLowerCase()) || n.id.toLowerCase().includes(wikilinkSearch.toLowerCase()))
                .slice(0, 30)
                .map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      applyFormatting(`[[${n.title}]]`, '');
                      setIsWikilinkModalOpen(false);
                      setWikilinkSearch('');
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-accent/20 hover:text-white text-slate-300 text-xs flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent-light shrink-0" />
                      <span className="font-medium truncate">{n.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">📁 {getNoteFolder(n)}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Move Note Modal */}
      {moveModalNote && (
        <div 
          onClick={() => setMoveModalNote(null)} 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-card border border-card-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col cursor-default"
          >
            <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <FolderInput className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Mover Anotação para Pasta</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[280px]">"{moveModalNote.title}"</p>
                </div>
              </div>
              <button onClick={() => setMoveModalNote(null)} className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Selecione a Pasta de Destino:</span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-card-border">
                {allFolderNames.map(f => (
                  <button
                    key={f}
                    onClick={() => handleMoveNote(moveModalNote.id, f)}
                    className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between transition-all ${
                      getNoteFolder(moveModalNote) === f
                        ? 'bg-accent/20 border-accent text-accent-light font-semibold'
                        : 'bg-panel border-card-border text-slate-300 hover:bg-card-border hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>{f}</span>
                    </div>
                    {getNoteFolder(moveModalNote) === f && (
                      <span className="text-[10px] text-accent-light font-mono">(Atual)</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-card-border space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Ou criar e mover para nova pasta:</span>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    placeholder="Nome da nova pasta..."
                    value={newMoveFolderName}
                    onChange={(e) => setNewMoveFolderName(e.target.value)}
                    className="flex-1 bg-panel border border-card-border rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent font-mono"
                  />
                  <button
                    onClick={() => {
                      if (newMoveFolderName.trim()) {
                        handleMoveNote(moveModalNote.id, newMoveFolderName.trim());
                        setNewMoveFolderName('');
                      }
                    }}
                    disabled={!newMoveFolderName.trim()}
                    className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-sm"
                  >
                    Mover
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notion Import Modal */}
      {isNotionModalOpen && (
        <div 
          onClick={() => setIsNotionModalOpen(false)} 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in select-none cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-card border border-card-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col cursor-default"
          >
            <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <Download className="w-4 h-4 text-accent-light" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Importar Páginas do Notion</h3>
                  <p className="text-[11px] text-slate-400">Importe arquivos Markdown (.md) exportados do Notion ou cole o conteúdo.</p>
                </div>
              </div>
              <button onClick={() => setIsNotionModalOpen(false)} className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Export Help Banner */}
              <div className="p-3 rounded-xl bg-panel border border-card-border text-[11px] text-slate-300 leading-relaxed space-y-1">
                <span className="font-bold text-accent-light block flex items-center space-x-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Como exportar do Notion:</span>
                </span>
                <span>No Notion, clique em <strong>Configurações & Membros</strong> ➔ <strong>Exportar todo o conteúdo</strong> ➔ Formato: <strong>Markdown & CSV</strong>.</span>
              </div>

              {/* Destination Folder Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pasta de Destino no Cofre:</label>
                <input
                  type="text"
                  value={notionTargetFolder}
                  onChange={(e) => setNotionTargetFolder(e.target.value)}
                  placeholder="Ex: Notion Import, Arquitetura, Estudos..."
                  className="w-full bg-panel border border-card-border rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent font-mono"
                />
              </div>

              {/* Upload Multi-files */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-card-border hover:border-accent/50 bg-panel/50 text-center space-y-2 cursor-pointer relative">
                <input
                  type="file"
                  multiple
                  accept=".md,.txt"
                  onChange={handleImportNotionFiles}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-6 h-6 text-accent-light mx-auto" />
                <span className="font-bold text-slate-200 block">Selecionar arquivos Markdown (.md) do Notion</span>
                <span className="text-[11px] text-slate-400 block">Clique ou arraste os arquivos aqui</span>
              </div>

              <div className="text-center text-slate-500 font-mono text-[10px]">OU COLE O CONTEÚDO MANUALMENTE</div>

              {/* Manual Paste Form */}
              <form onSubmit={handleImportNotionPaste} className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Título da página do Notion..."
                  value={notionPasteTitle}
                  onChange={(e) => setNotionPasteTitle(e.target.value)}
                  className="w-full bg-panel border border-card-border rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent"
                />

                <textarea
                  rows={4}
                  placeholder="# Conteúdo Markdown copiado da página do Notion..."
                  value={notionPasteContent}
                  onChange={(e) => setNotionPasteContent(e.target.value)}
                  className="w-full bg-panel border border-card-border rounded-xl p-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-accent"
                />

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsNotionModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border text-slate-300 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isImportingNotion}
                    className="px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-all shadow-md"
                  >
                    {isImportingNotion ? 'Importando...' : 'Importar Nota'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* GitSafe Security Audit & Privacy Modal */}
      {isGitSafeModalOpen && (
        <div 
          onClick={() => setIsGitSafeModalOpen(false)} 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in select-none cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-card border border-card-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
          >
            <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-slate-100">GitSafe Core</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold">
                      Nativo Tellus
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Proteção ativa contra vazamento de chaves de API, credenciais e dados confidenciais.</p>
                </div>
              </div>
              <button onClick={() => setIsGitSafeModalOpen(false)} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs scrollbar-thin scrollbar-thumb-card-border">
              {/* Score & General Status Card */}
              {isLoadingAudit ? (
                <div className="p-8 flex flex-col items-center justify-center space-y-3 bg-panel rounded-2xl border border-card-border">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                  <span className="text-slate-300 text-xs font-mono">Executando auditoria GitSafe no repositório e vault...</span>
                </div>
              ) : gitSafeReport ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-panel border border-card-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Nível de Segurança</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-2xl font-black font-mono ${
                          gitSafeReport.score >= 80 ? 'text-emerald-400' : gitSafeReport.score >= 50 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {gitSafeReport.score}/100
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          gitSafeReport.isSafe 
                            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' 
                            : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                        }`}>
                          {gitSafeReport.isSafe ? '✓ Protegido & Seguro' : '⚠ Requer Atenção'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{gitSafeReport.summary}</p>
                    </div>

                    <button
                      onClick={handleRunGitSafeAudit}
                      className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-200 hover:text-white flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Reauditar</span>
                    </button>
                  </div>

                  {/* Audit Checklist Items */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Verificações de Integridade:</span>
                    <div className="space-y-2">
                      {gitSafeReport.items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start justify-between space-x-3 ${
                            item.passed 
                              ? 'bg-emerald-950/15 border-emerald-500/20 text-slate-200' 
                              : 'bg-rose-950/25 border-rose-500/30 text-rose-200'
                          }`}
                        >
                          <div className="flex items-start space-x-2.5">
                            <div className={`mt-0.5 p-1 rounded-lg shrink-0 ${
                              item.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {item.passed ? <Check className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs">{item.name}</span>
                                <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded ${
                                  item.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300 font-bold'
                                }`}>
                                  {item.severity}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.details}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono shrink-0 font-bold ${
                            item.passed ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {item.passed ? 'PASSED' : 'ALERT'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Interactive Sanitizer Test Box */}
              <div className="pt-4 border-t border-card-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Testar Higienizador GitSafe em Tempo Real:</span>
                  <span className="text-[10px] text-slate-500 font-mono">Filtra OpenAI, Anthropic, Fish Audio, GCP, GitHub, AWS, etc.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Cole um texto de teste com chave (ex: Minha key sk-fish-...)"
                    value={testSanitizeInput}
                    onChange={(e) => setTestSanitizeInput(e.target.value)}
                    className="flex-1 bg-panel border border-card-border rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleTestSanitization}
                    disabled={!testSanitizeInput.trim()}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-sm shrink-0"
                  >
                    Higienizar
                  </button>
                </div>

                {testSanitizeOutput && (
                  <div className="p-3 bg-panel rounded-xl border border-emerald-500/40 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 font-mono flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Resultado Sanitizado ({testSanitizeOutput.redactedCount} segredo(s) ofuscado(s)):</span>
                      </span>
                      {testSanitizeOutput.detectedTypes.length > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          {testSanitizeOutput.detectedTypes.join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 bg-black/60 rounded-lg border border-card-border font-mono text-xs text-slate-200 select-text break-all">
                      {testSanitizeOutput.sanitized}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credits & Architectural Foundations Modal */}
      <CreditsModal isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />

      {/* Top Bar Controls */}
      <div className="h-12 border-b border-card-border bg-sidebar px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2.5">
          {/* Toggle Sidebar Button */}
          {viewMode === 'editor' && (
            <button
              onClick={() => {
                if (isNoteMaximized) setIsNoteMaximized(false);
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }}
              className={`p-1.5 rounded-lg border transition-all ${
                isSidebarCollapsed || isNoteMaximized
                  ? 'bg-accent/20 border-accent text-accent-light'
                  : 'bg-panel hover:bg-card border-card-border text-slate-400 hover:text-slate-200'
              }`}
              title={isSidebarCollapsed || isNoteMaximized ? "Mostrar Barra de Cadernos & Pastas" : "Ocultar Barra de Cadernos & Pastas"}
            >
              {isSidebarCollapsed || isNoteMaximized ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Practical Back, Forward and Home Buttons */}
          <div className="flex items-center space-x-1 bg-card rounded-lg p-0.5 border border-card-border">
            <button
              onClick={handleNavBack}
              disabled={activeNote === null && selectedNotebookId === 'all' && viewMode === 'editor' && navHistoryIndex <= 0}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeNote === null && selectedNotebookId === 'all' && viewMode === 'editor' && navHistoryIndex <= 0
                  ? 'opacity-30 text-slate-500 cursor-not-allowed'
                  : 'hover:bg-panel text-slate-200 hover:text-white cursor-pointer'
              }`}
              title="Voltar à página/nota anterior (ou botão Voltar do mouse)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

            <button
              onClick={handleNavForward}
              disabled={navHistoryIndex >= navHistory.length - 1}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                navHistoryIndex >= navHistory.length - 1
                  ? 'opacity-30 text-slate-500 cursor-not-allowed'
                  : 'hover:bg-panel text-slate-200 hover:text-white cursor-pointer'
              }`}
              title="Avançar para a próxima página/nota (ou botão Avançar do mouse)"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Avançar</span>
            </button>

            <button
              onClick={goToHome}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeNote === null && selectedNotebookId === 'all' && viewMode === 'editor'
                  ? 'bg-accent text-white shadow-xs'
                  : 'hover:bg-panel text-slate-300 hover:text-white'
              }`}
              title="Ir para a Página Inicial (Todos os Cadernos)"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
          </div>

          {/* Clickable Breadcrumbs Trail */}
          <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
            <span className="text-slate-600">/</span>
            <button
              onClick={goToHome}
              className={`hover:text-accent-light hover:underline font-sans transition-colors ${
                activeNote === null && selectedNotebookId === 'all' ? 'text-accent-light font-bold' : 'text-slate-300'
              }`}
            >
              Cadernos
            </button>

            {selectedNotebookId !== 'all' && (
              <>
                <span className="text-slate-600">/</span>
                <button
                  onClick={() => setActiveNote(null)}
                  className={`hover:text-accent-light hover:underline font-sans transition-colors truncate max-w-[140px] ${
                    activeNote === null ? 'text-accent-light font-bold' : 'text-slate-300'
                  }`}
                  title={`Caderno: ${selectedNotebookId}`}
                >
                  {selectedNotebookId}
                </button>
              </>
            )}

            {activeNote && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-slate-100 font-bold font-sans truncate max-w-[180px]" title={activeNote.title}>
                  {activeNote.title}
                </span>
              </>
            )}
          </div>

          <div className="hidden xl:flex items-center space-x-2">
            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center space-x-1">
              <BookOpen className="w-3 h-3 text-cyan-400" />
              <span>Obsidian Vault</span>
            </span>

            <button
              onClick={handleRunGitSafeAudit}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/40 hover:border-emerald-400 px-2.5 py-0.5 rounded-full flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer group"
              title="GitSafe Core Ativo: Clique para abrir o Painel de Auditoria de Privacidade e Segredos"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">GitSafe Protected</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Credits Button */}
          <button
            onClick={() => setIsCreditsOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card border border-card-border text-xs text-slate-300 hover:text-accent-light flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Créditos e Fundamentos do Notes Module (Frank MD e AI-Memory)"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-light" />
            <span className="hidden sm:inline">Créditos</span>
          </button>

          {/* Notion Import Button */}
          <button
            onClick={() => setIsNotionModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card border border-card-border text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
            title="Importar notas exportadas do Notion (.md / .csv)"
          >
            <Download className="w-3.5 h-3.5 text-accent-light" />
            <span>Importar do Notion</span>
          </button>

          {/* Mode Switcher: Editor vs Graph vs Trash */}
          <div className="flex items-center bg-card rounded-lg p-0.5 border border-card-border text-xs">
            <button
              onClick={() => {
                setViewMode('editor');
                setSidebarTab('folders');
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'editor' && sidebarTab === 'folders'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Notas ({notes.length})</span>
            </button>
            <button
              onClick={() => {
                setViewMode('editor');
                setSidebarTab('highlights');
                setIsSidebarCollapsed(false);
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'editor' && sidebarTab === 'highlights'
                  ? 'bg-amber-500/25 text-amber-300 font-semibold shadow-sm border border-amber-500/40'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
              title="Abrir painel de trechos destacados e citações"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-400" />
              <span>Destaques</span>
              {allVaultHighlights.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {allVaultHighlights.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setViewMode('graph');
                fetchGraph();
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'graph'
                  ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
              title="Abrir Visualização em Grafo do Cofre Obsidian"
            >
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>Visualizar Grafo</span>
            </button>
            <button
              onClick={() => {
                setViewMode('editor');
                setSidebarTab('trash');
                setIsSidebarCollapsed(false);
                fetchDeletedNotes();
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'editor' && sidebarTab === 'trash'
                  ? 'bg-rose-950/80 text-rose-300 font-semibold shadow-sm border border-rose-500/40'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
              title="Abrir Lixeira de Notas e Pastas Removidas"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Lixeira</span>
              {deletedNotes.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                  {deletedNotes.length}
                </span>
              )}
            </button>
          </div>

          {/* Smart Dropzone Button */}
          <button
            onClick={() => setIsDropzoneOpen(true)}
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-brand-cyan/20 to-accent/20 hover:from-brand-cyan/30 hover:to-accent/30 border border-brand-cyan/40 text-brand-cyan text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
            title="Soltar arquivos diversos para auto-organização inteligente e emissão de relatório"
          >
            <Upload className="w-3.5 h-3.5 text-brand-cyan" />
            <span>Smart Dropzone</span>
          </button>

          <button
            onClick={() => handleCreateNoteInFolder(selectedFolderFilter !== 'all' ? selectedFolderFilter : 'Geral')}
            className="px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Nota</span>
          </button>
        </div>
      </div>

      {/* VIEW MODES */}
      {viewMode === 'graph' ? (
        /* OBSIDIAN-STYLE INTERACTIVE GRAPH (FULL PAGE) */
        <div className="flex-1 w-full h-full flex flex-col bg-[#050608] relative overflow-hidden select-none">
          <InteractiveGraphCanvas
            initialType="notes"
            embeddedMode={true}
            onOpenNote={(noteTitle) => {
              const cleanTitle = noteTitle.replace(/^#+\s*/, '').trim();
              const found = notes.find(n => n.title.toLowerCase() === cleanTitle.toLowerCase() || n.id.toLowerCase() === cleanTitle.toLowerCase());
              if (found) {
                selectNote(found);
                setViewMode('editor');
              }
            }}
            onClose={() => setViewMode('editor')}
          />
        </div>
      ) : (
        /* NOTION-STYLE FULL DOCUMENT WORKSPACE WITH FOLDER TREE & DRAG-AND-DROP */
        <div className="flex-1 flex overflow-hidden relative">
          {/* MINIMIZED ICON-RAIL SIDEBAR (Modo Limpo Focado no Conteúdo) */}
          {!isNoteMaximized && isSidebarCollapsed && (
            <div className="w-14 border-r border-card-border/70 bg-[#0d1017] flex flex-col items-center py-3 gap-2 shrink-0 z-20 select-none shadow-sm transition-all">
              {/* Expand Trigger Button */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-accent-light hover:bg-card-border/40 transition-all cursor-pointer"
                  aria-label="Expandir barra lateral"
                >
                  <PanelLeftOpen className="w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
                {/* Floating Tooltip */}
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-card border border-card-border shadow-2xl text-xs whitespace-nowrap text-slate-200 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 font-medium">
                  <span>Expandir Barra Lateral</span>
                  <span className="text-[10px] text-slate-400 font-mono">Pastas & Destaques</span>
                </div>
              </div>

              <div className="w-6 h-px bg-card-border/60 my-1" />

              {/* Pastas / Cadernos */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab('folders');
                    setIsSidebarCollapsed(false);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    sidebarTab === 'folders'
                      ? 'bg-accent/15 text-accent-light border border-accent/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-card-border/40'
                  }`}
                  aria-label="Cadernos & Pastas"
                >
                  <Folder className="w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-card border border-card-border shadow-2xl text-xs whitespace-nowrap text-slate-200 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-2">
                  <span className="font-semibold text-accent-light">Cadernos & Pastas</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {notes.length} notas
                  </span>
                </div>
              </div>

              {/* Destaques (Highlights) */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab('highlights');
                    setIsSidebarCollapsed(false);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
                    sidebarTab === 'highlights'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-amber-300 hover:bg-card-border/40'
                  }`}
                  aria-label="Destaques & Citações"
                >
                  <Highlighter className="w-5 h-5 transition-transform group-hover:scale-110" />
                  {allVaultHighlights.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center ring-2 ring-sidebar">
                      {allVaultHighlights.length > 99 ? '99+' : allVaultHighlights.length}
                    </span>
                  )}
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-card border border-card-border shadow-2xl text-xs whitespace-nowrap text-slate-200 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-2">
                  <span className="font-semibold text-amber-300">Destaques & Citações</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    {allVaultHighlights.length} trechos
                  </span>
                </div>
              </div>

              {/* Lixeira */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab('trash');
                    fetchDeletedNotes();
                    setIsSidebarCollapsed(false);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
                    sidebarTab === 'trash'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-rose-300 hover:bg-card-border/40'
                  }`}
                  aria-label="Lixeira de Notas"
                >
                  <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                  {deletedNotes.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-sidebar">
                      {deletedNotes.length > 9 ? '9+' : deletedNotes.length}
                    </span>
                  )}
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-card border border-card-border shadow-2xl text-xs whitespace-nowrap text-slate-200 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-2">
                  <span className="font-semibold text-rose-300">Lixeira</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                    {deletedNotes.length} itens
                  </span>
                </div>
              </div>

              <div className="w-6 h-px bg-card-border/60 my-1" />

              {/* Nova Nota Rápida */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    handleCreateNoteInFolder(selectedFolderFilter !== 'all' ? selectedFolderFilter : 'Geral');
                    setIsSidebarCollapsed(false);
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-card-border/40 hover:bg-accent/20 text-slate-300 hover:text-accent-light transition-all cursor-pointer"
                  aria-label="Criar Nova Nota"
                >
                  <Plus className="w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-card border border-card-border shadow-2xl text-xs whitespace-nowrap text-slate-200 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5">
                  <span className="font-semibold">Nova Nota</span>
                </div>
              </div>

              {/* Visão Geral / Home */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={goToHome}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-card-border/40 transition-all cursor-pointer"
                  aria-label="Ir para Visão Geral"
                >
                  <Home className="w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-card border border-card-border shadow-2xl text-xs whitespace-nowrap text-slate-200 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <span className="font-semibold">Visão Geral (Home)</span>
                </div>
              </div>

              {/* Bottom icons */}
              <div className="mt-auto flex flex-col items-center gap-2">
                {/* GitSafe Auditoria */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGitSafeModalOpen(true);
                      handleRunGitSafeAudit();
                    }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
                    aria-label="GitSafe Proteção de Dados"
                  >
                    <ShieldCheck className="w-5 h-5 transition-transform group-hover:scale-110" />
                  </button>
                  <div className="absolute left-full ml-3 bottom-0 px-3 py-1.5 rounded-xl bg-card border border-card-border shadow-2xl text-xs whitespace-nowrap text-slate-200 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <span className="font-semibold text-emerald-400">GitSafe Shield</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes & Folders Explorer Sidebar */}
          <div 
            style={{ width: isSidebarCollapsed || isNoteMaximized ? '0px' : `${sidebarWidth}px` }}
            className={`border-r border-card-border bg-sidebar flex flex-col shrink-0 overflow-hidden relative select-none transition-[width] duration-75 ${
              isSidebarCollapsed || isNoteMaximized ? 'w-0 border-r-0 invisible' : ''
            }`}
          >
            {/* Sidebar Navigation Tabs (Pastas vs Destaques vs Lixeira) */}
            <div className="flex items-center p-1.5 bg-panel border-b border-card-border gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSidebarTab('folders');
                  setSelectedDeletedNote(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  sidebarTab === 'folders'
                    ? 'bg-card text-accent-light shadow-sm border border-card-border'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Pastas</span>
                <span className="text-[10px] opacity-70">({allFolderNames.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('highlights')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  sidebarTab === 'highlights'
                    ? 'bg-card text-amber-300 shadow-sm border border-card-border'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>Destaques</span>
                {allVaultHighlights.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    {allVaultHighlights.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSidebarTab('trash');
                  fetchDeletedNotes();
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  sidebarTab === 'trash'
                    ? 'bg-card text-rose-400 shadow-sm border border-card-border'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Lixeira</span>
                {deletedNotes.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                    {deletedNotes.length}
                  </span>
                )}
              </button>
              {/* Botão de Minimizar para Ícones */}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-card-border/40 transition-all shrink-0 cursor-pointer"
                title="Minimizar barra lateral para ícones"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Actions Bar */}
            <div className="p-3 border-b border-card-border space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    sidebarTab === 'trash' 
                      ? "Pesquisar notas na lixeira..." 
                      : sidebarTab === 'highlights' 
                      ? "Pesquisar trechos destacados e notas..." 
                      : "Pesquisar por título, conteúdo ou #tags..."
                  }
                  className="w-full bg-card border border-card-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
                />
              </div>

              {sidebarTab === 'folders' ? (
                <>
                  {/* Folders & Notebooks Filter / Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono flex items-center space-x-1.5">
                      <Book className="w-3.5 h-3.5 text-accent-light" />
                      <span>Cadernos & Pastas ({allFolderNames.length})</span>
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          const next = !isSingleNotebookMode;
                          setIsSingleNotebookMode(next);
                          try {
                            localStorage.setItem('notes_single_notebook_mode', String(next));
                          } catch {}
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-lg border font-mono transition-all flex items-center space-x-1 cursor-pointer ${
                          isSingleNotebookMode
                            ? 'bg-accent/20 border-accent text-accent-light font-bold'
                            : 'bg-panel border-card-border text-slate-400 hover:text-slate-200'
                        }`}
                        title={isSingleNotebookMode ? "Modo 1 Caderno por vez ATIVO (expandir um caderno fecha os demais)" : "Ativar Modo 1 Caderno por vez"}
                      >
                        <Layers className="w-3 h-3" />
                        <span className="hidden sm:inline">1 por vez</span>
                      </button>
                      <button
                        onClick={() => setIsCreatingNotebook(true)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-200 flex items-center space-x-1 font-semibold transition-colors"
                        title="Criar novo caderno temático no cofre"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>+ Caderno</span>
                      </button>
                      <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="text-[11px] text-accent-light hover:text-white flex items-center space-x-1 font-semibold transition-colors"
                        title="Criar nova pasta ou subpasta no cofre"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>+ Pasta</span>
                      </button>
                    </div>
                  </div>

                  {/* Order / Sort Selector */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5 pb-1 border-b border-card-border/40">
                    <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono">
                      <span>Ordem:</span>
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setNotebookSortOrder('name')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                          notebookSortOrder === 'name'
                            ? 'bg-accent/20 border border-accent text-accent-light font-bold shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-card-border/40'
                        }`}
                        title="Ordenar por Nome (A-Z)"
                      >
                        A-Z
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotebookSortOrder('recent')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                          notebookSortOrder === 'recent'
                            ? 'bg-accent/20 border border-accent text-accent-light font-bold shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-card-border/40'
                        }`}
                        title="Ordenar por Mais Recente"
                      >
                        Recentes
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotebookSortOrder('count')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                          notebookSortOrder === 'count'
                            ? 'bg-accent/20 border border-accent text-accent-light font-bold shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-card-border/40'
                        }`}
                        title="Ordenar por Quantidade de Notas"
                      >
                        Qtd
                      </button>
                    </div>
                  </div>

                  {/* Inline Create Notebook Form */}
                  {isCreatingNotebook && (
                    <form onSubmit={handleCreateNotebook} className="p-2.5 bg-card rounded-xl border border-cyan-500/50 space-y-2 animate-in fade-in shadow-lg">
                      <div className="flex items-center space-x-1.5 text-xs text-cyan-300 font-semibold">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Novo Caderno Temático</span>
                      </div>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="Nome do caderno (ex: Carreira, Estudos, Projetos)..."
                        value={newNotebookName}
                        onChange={(e) => setNewNotebookName(e.target.value)}
                        className="w-full bg-panel border border-card-border rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setIsCreatingNotebook(false)}
                          className="px-2 py-0.5 rounded bg-panel hover:bg-card-border text-[10px] text-slate-400"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[10px]"
                        >
                          Criar Caderno
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Inline Create Folder Form */}
                  {isCreatingFolder && (
                    <form onSubmit={handleCreateFolder} className="p-2 bg-card rounded-xl border border-accent/40 space-y-2 animate-in fade-in shadow-lg">
                      <div className="flex items-center space-x-1.5 text-xs text-accent-light font-semibold">
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Nova Pasta / Subpasta</span>
                      </div>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="Nome da pasta (ex: Estudos/SPREGULA, Carreira/Nestle)..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="w-full bg-panel border border-card-border rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-accent font-mono"
                      />
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setIsCreatingFolder(false)}
                          className="px-2 py-0.5 rounded bg-panel hover:bg-card-border text-[10px] text-slate-400"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px]"
                        >
                          Criar Pasta
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Notebook Filter Pills OR Focused Notebook Header */}
                  {selectedNotebookId !== 'all' ? (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-accent/15 border border-accent/40 text-xs animate-in fade-in">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="font-bold text-slate-100 truncate text-xs flex items-center space-x-1.5">
                          <Folder className="w-3.5 h-3.5 text-accent-light" />
                          <span className="truncate">{selectedNotebookId}</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-panel border border-card-border text-accent-light font-bold">
                          {currentSelectedNotebook?.totalCount || 0}
                        </span>
                      </div>
                      <button
                        onClick={goToHome}
                        className="text-[10px] text-accent-light hover:underline font-mono flex items-center space-x-1 cursor-pointer shrink-0 font-semibold"
                        title="Voltar para todos os cadernos (Home)"
                      >
                        <span>← Todos</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
                      <button
                        onClick={() => {
                          setSelectedNotebookId('all');
                          setActiveNote(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 border cursor-pointer ${
                          selectedNotebookId === 'all'
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-card text-slate-400 border-card-border hover:text-slate-200'
                        }`}
                      >
                        <LayoutGrid className="w-3 h-3" />
                        <span>Todos</span>
                        <span className="opacity-70 font-mono">({filteredNotes.length})</span>
                      </button>
                      {notebooksList.map(nb => {
                        const details = getNotebookDetails(nb.id);
                        const NbIcon = details.icon;
                        const isSelected = selectedNotebookId === nb.id;
                        return (
                          <button
                            key={nb.id}
                            onClick={() => {
                              setSelectedNotebookId(nb.id === selectedNotebookId ? 'all' : nb.id);
                              setActiveNote(null);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 border cursor-pointer ${
                              isSelected
                                ? `${details.badgeBg} shadow-xs font-bold ring-1 ring-accent/40`
                                : 'bg-card text-slate-400 border-card-border hover:text-slate-200'
                            }`}
                            title={`Ver painel do caderno ${nb.id}`}
                          >
                            <NbIcon className={`w-3 h-3 ${isSelected ? details.color : 'text-slate-400'}`} />
                            <span>{nb.id}</span>
                            <span className="opacity-70 font-mono">({nb.totalCount})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Trash Retention Configuration Bar */
                <div className="p-2.5 bg-panel/60 border border-card-border/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 flex items-center space-x-1.5 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Retenção da Lixeira</span>
                    </span>
                    {deletedNotes.length > 0 && (
                      <button
                        onClick={handleEmptyTrash}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center space-x-1"
                        title="Esvaziar todas as notas da lixeira permanentemente"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Esvaziar</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-400 shrink-0">Excluir após:</span>
                    <select
                      value={retentionPolicy}
                      onChange={(e) => handleChangeRetention(e.target.value as any)}
                      className="flex-1 bg-card border border-card-border rounded-lg px-2 py-1 text-[11px] text-amber-300 focus:outline-none focus:border-accent font-medium cursor-pointer"
                    >
                      <option value="30_days">30 dias</option>
                      <option value="90_days">90 dias (Padrão)</option>
                      <option value="120_days">120 dias</option>
                      <option value="1_year">1 ano</option>
                      <option value="never">Sempre (Nunca excluir)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* TAB CONTENT: Folders View OR Trash View */}
            {sidebarTab === 'folders' ? (
              /* Folders & Notes Hierarchical Tree (Drag & Drop Target for Notes and Folders) */
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin scrollbar-thumb-card-border">
                {(() => {
                  const visibleNotebooks = selectedNotebookId === 'all'
                    ? notebooksList
                    : notebooksList.filter(nb => nb.id === selectedNotebookId);

                  if (visibleNotebooks.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                        <Book className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="font-semibold text-slate-400">Nenhum caderno encontrado</p>
                        <p className="text-[11px] text-slate-500">Clique em "+ Caderno" para criar seu primeiro caderno de notas.</p>
                      </div>
                    );
                  }

                  return visibleNotebooks.map((nb) => {
                    const nbDetails = getNotebookDetails(nb.id);
                    const NbIcon = nbDetails.icon;
                    const isNbCollapsed = collapsedFolders[`nb:${nb.id}`];
                    const isDragTargetNb = dragOverFolder === nb.id;

                    return (
                      <div
                        key={nb.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverFolder !== nb.id) setDragOverFolder(nb.id);
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          setDragOverFolder(null);
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const droppedFolder = e.dataTransfer.getData('application/x-tellus-folder') || draggedFolderName;
                          const droppedNoteId = e.dataTransfer.getData('text/plain') || draggedNoteId;
                          setDragOverFolder(null);
                          setDraggedNoteId(null);
                          setDraggedFolderName(null);

                          if (droppedFolder && droppedFolder !== nb.id) {
                            await handleMoveFolder(droppedFolder, nb.id);
                          } else if (droppedNoteId) {
                            await handleMoveNote(droppedNoteId, nb.id);
                          }
                        }}
                        className={`space-y-1 rounded-2xl border p-2 transition-all duration-200 ${
                          isDragTargetNb
                            ? 'bg-accent/20 border-accent ring-2 ring-accent scale-[1.01] shadow-lg'
                            : `${nbDetails.bg} border-card-border/80`
                        }`}
                      >
                        {/* Notebook Header */}
                        <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-card-border/40 transition-colors group cursor-pointer">
                          <div
                            onClick={() => toggleFolderCollapse(`nb:${nb.id}`)}
                            className="flex items-center space-x-2 cursor-pointer flex-1 truncate select-none"
                          >
                            {isNbCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-accent-light shrink-0" />
                            )}
                            <div className={`p-1 rounded-lg ${nbDetails.badgeBg}`}>
                              <NbIcon className={`w-3.5 h-3.5 ${nbDetails.color}`} />
                            </div>
                            <span className="font-bold text-xs truncate text-slate-100" title={nb.id}>
                              {nb.id}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              ({nb.totalCount})
                            </span>
                            {isDragTargetNb && (
                              <span className="text-[9px] font-bold text-accent-light uppercase px-1.5 py-0.5 rounded bg-accent/30 animate-pulse">
                                Mover para Caderno
                              </span>
                            )}
                          </div>

                          {/* Notebook Action Tools */}
                          <div className="flex items-center space-x-1 opacity-75 group-hover:opacity-100 transition-opacity">
                            {onStartLiveVoice && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartLiveVoice(`Caderno: ${nb.id}`, `Estudo e diálogo por voz sobre o caderno ${nb.id} com ${nb.totalCount} anotações.`);
                                }}
                                className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                title={`Iniciar Live Voice para conversar sobre o caderno "${nb.id}"`}
                              >
                                <Mic className="w-3 h-3 text-red-400" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadEntireNotebook(nb.id);
                              }}
                              className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-accent-light transition-colors"
                              title={`Baixar todas as anotações do caderno "${nb.id}" formatadas (.md)`}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNotebookId(nb.id);
                                setActiveNote(null);
                              }}
                              className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-accent-light"
                              title="Abrir Painel do Caderno"
                            >
                              <LayoutGrid className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewFolderName(`${nb.id}/`);
                                setIsCreatingFolder(true);
                              }}
                              className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-cyan-300"
                              title={`Criar subpasta dentro de "${nb.id}"`}
                            >
                              <FolderPlus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateNoteInFolder(nb.id);
                              }}
                              className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-white"
                              title={`Criar nova nota em "${nb.id}"`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            {nb.id !== 'Geral' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(nb.id);
                                }}
                                className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                                title={`Excluir caderno "${nb.id}"`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Notebook Content: Subfolders & Direct Notes */}
                        {!isNbCollapsed && (
                          <div className="pl-3 pr-0.5 space-y-2 pt-1 border-l-2 border-card-border/50 ml-3">
                            {/* Subfolders */}
                            {nb.subfolders.map((sub) => {
                              const isSubCollapsed = collapsedFolders[sub.path];
                              const isDragTargetSub = dragOverFolder === sub.path;

                              return (
                                <div
                                  key={sub.path}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData('application/x-tellus-folder', sub.path);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedFolderName(sub.path);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedFolderName(null);
                                    setDragOverFolder(null);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverFolder !== sub.path) setDragOverFolder(sub.path);
                                  }}
                                  onDragLeave={(e) => {
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                    setDragOverFolder(null);
                                  }}
                                  onDrop={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const droppedFolder = e.dataTransfer.getData('application/x-tellus-folder') || draggedFolderName;
                                    const droppedNoteId = e.dataTransfer.getData('text/plain') || draggedNoteId;
                                    setDragOverFolder(null);
                                    setDraggedNoteId(null);
                                    setDraggedFolderName(null);

                                    if (droppedFolder && droppedFolder !== sub.path) {
                                      await handleMoveFolder(droppedFolder, sub.path);
                                    } else if (droppedNoteId) {
                                      await handleMoveNote(droppedNoteId, sub.path);
                                    }
                                  }}
                                  className={`rounded-xl border p-1.5 transition-all ${
                                    isDragTargetSub
                                      ? 'bg-accent/20 border-accent ring-2 ring-accent'
                                      : 'bg-panel/50 border-card-border/70'
                                  }`}
                                >
                                  {/* Subfolder Header */}
                                  <div className="flex items-center justify-between p-1 rounded-lg hover:bg-card-border/40 transition-colors group cursor-grab active:cursor-grabbing">
                                    <div
                                      onClick={() => toggleFolderCollapse(sub.path)}
                                      className="flex items-center space-x-1.5 cursor-pointer flex-1 truncate select-none"
                                    >
                                      {isSubCollapsed ? (
                                        <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3 text-accent-light shrink-0" />
                                      )}
                                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      <span className="font-semibold text-xs text-slate-200 truncate" title={sub.path}>
                                        {sub.name}
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                        ({sub.notes.length})
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-1 opacity-75 group-hover:opacity-100">
                                      {onStartLiveVoice && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onStartLiveVoice(`Assunto: ${sub.name}`, `Estudo e diálogo por voz sobre o assunto ${sub.path} com ${sub.notes.length} anotações.`);
                                          }}
                                          className="p-0.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                          title={`Iniciar Live Voice sobre o assunto "${sub.name}"`}
                                        >
                                          <Mic className="w-2.5 h-2.5 text-red-400" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadEntireNotebook(sub.path);
                                        }}
                                        className="p-0.5 rounded hover:bg-card-border text-slate-400 hover:text-accent-light transition-colors"
                                        title={`Baixar anotações da subpasta "${sub.name}" formatadas (.md)`}
                                      >
                                        <Download className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={() => handleReviewFolderWithAgent(sub.path)}
                                        className="px-1.5 py-0.5 rounded bg-accent/20 hover:bg-accent text-accent-light hover:text-white text-[9px] font-semibold flex items-center space-x-1 transition-all border border-accent/30"
                                        title="Revisar notas desta subpasta com o Agente"
                                      >
                                        <Wand2 className="w-2.5 h-2.5" />
                                        <span>IA</span>
                                      </button>
                                      <button
                                        onClick={() => handleCreateNoteInFolder(sub.path)}
                                        className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-white"
                                        title={`Criar nova nota em "${sub.path}"`}
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteFolder(sub.path);
                                        }}
                                        className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                                        title={`Excluir subpasta "${sub.path}"`}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Subfolder Notes */}
                                  {!isSubCollapsed && (
                                    <div className="pl-3 pr-1 space-y-1.5 pt-1">
                                      {sub.notes.length === 0 ? (
                                        <div className="p-1.5 text-[10px] text-slate-500 italic">
                                          Subpasta vazia. Clique em + para adicionar notas.
                                        </div>
                                      ) : (
                                        sub.notes.map((n) => {
                                          const isActive = activeNote?.id === n.id;
                                          const isBeingDragged = draggedNoteId === n.id;
                                          const isBibliography = n.title.includes('Referencias') || n.title.includes('Bibliografias') || n.filename.includes('99_');

                                          return (
                                            <div
                                              key={n.id}
                                              draggable={true}
                                              onDragStart={(e) => {
                                                e.stopPropagation();
                                                e.dataTransfer.setData('text/plain', n.id);
                                                e.dataTransfer.effectAllowed = 'move';
                                                setDraggedNoteId(n.id);
                                              }}
                                              onDragEnd={() => {
                                                setDraggedNoteId(null);
                                                setDragOverFolder(null);
                                              }}
                                              onClick={() => selectNote(n)}
                                              className={`p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex flex-col space-y-1 group/card ${
                                                isBeingDragged
                                                  ? 'opacity-40 border-dashed border-accent scale-95'
                                                  : isActive
                                                  ? 'bg-accent/20 border-accent text-white shadow-sm'
                                                  : isBibliography
                                                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200 hover:bg-amber-950/30'
                                                  : 'bg-card/70 border-card-border/80 text-slate-300 hover:bg-card-border/40'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span className="font-semibold text-xs truncate max-w-[150px] text-slate-100 flex items-center space-x-1.5">
                                                  <GripVertical className="w-3 h-3 text-slate-500 opacity-40 group-hover/card:opacity-100 shrink-0" />
                                                  {isBibliography ? (
                                                    <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                                                  ) : (
                                                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                                  )}
                                                  <span className="truncate">{n.title}</span>
                                                </span>

                                                <div className="flex items-center space-x-1">
                                                  {isBibliography && (
                                                    <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                      Bibliografia
                                                    </span>
                                                  )}
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setMoveModalNote(n);
                                                    }}
                                                    className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-amber-300 opacity-60 group-hover/card:opacity-100 transition-opacity"
                                                    title="Mover para outra pasta..."
                                                  >
                                                    <FolderInput className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              </div>

                                              <p className="text-[10px] text-slate-400 truncate line-clamp-1 leading-relaxed pl-4">
                                                {n.content.replace(/^#+.*?\n/, '').replace(/<!--.*?-->/g, '').trim().slice(0, 70)}
                                              </p>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Direct Notes in Notebook */}
                            {nb.directNotes.map((n) => {
                              const isActive = activeNote?.id === n.id;
                              const isBeingDragged = draggedNoteId === n.id;
                              const isBibliography = n.title.includes('Referencias') || n.title.includes('Bibliografias') || n.filename.includes('99_');

                              return (
                                <div
                                  key={n.id}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData('text/plain', n.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedNoteId(n.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedNoteId(null);
                                    setDragOverFolder(null);
                                  }}
                                  onClick={() => selectNote(n)}
                                  className={`p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex flex-col space-y-1 group/card ${
                                    isBeingDragged
                                      ? 'opacity-40 border-dashed border-accent scale-95'
                                      : isActive
                                      ? 'bg-accent/20 border-accent text-white shadow-sm'
                                      : isBibliography
                                      ? 'bg-amber-950/20 border-amber-500/30 text-amber-200 hover:bg-amber-950/30'
                                      : 'bg-card/70 border-card-border/80 text-slate-300 hover:bg-card-border/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs truncate max-w-[150px] text-slate-100 flex items-center space-x-1.5">
                                      <GripVertical className="w-3 h-3 text-slate-500 opacity-40 group-hover/card:opacity-100 shrink-0" />
                                      {isBibliography ? (
                                        <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                                      ) : (
                                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                      )}
                                      <span className="truncate">{n.title}</span>
                                    </span>

                                    <div className="flex items-center space-x-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMoveModalNote(n);
                                        }}
                                        className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-amber-300 opacity-60 group-hover/card:opacity-100 transition-opacity"
                                        title="Mover para outra pasta..."
                                      >
                                        <FolderInput className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  <p className="text-[10px] text-slate-400 truncate line-clamp-1 leading-relaxed pl-4">
                                    {n.content.replace(/^#+.*?\n/, '').replace(/<!--.*?-->/g, '').trim().slice(0, 70)}
                                  </p>
                                </div>
                              );
                            })}

                            {nb.subfolders.length === 0 && nb.directNotes.length === 0 && (
                              <div className="p-2 text-[10px] text-slate-500 italic">
                                Caderno vazio. Arraste notas para cá ou clique em + Nota.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : sidebarTab === 'highlights' ? (
              /* HIGHLIGHTS & CITATIONS FILTER PANEL */
              <div className="flex-1 flex flex-col overflow-hidden bg-sidebar select-none">
                {/* Scope selector & Color Filters Header */}
                <div className="p-3 border-b border-card-border space-y-3 shrink-0 bg-panel/60">
                  {/* Scope Selector: Todo o Cofre vs Nota Atual */}
                  <div className="flex items-center gap-1.5 p-1 bg-card/80 border border-card-border rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setHighlightScopeFilter('all')}
                      className={`flex-1 py-1 px-2 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                        highlightScopeFilter === 'all'
                          ? 'bg-accent/20 text-accent-light border border-accent/30 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Todo o Cofre</span>
                      <span className="text-[10px] opacity-75 font-mono">({allVaultHighlights.length})</span>
                    </button>
                    <button
                      type="button"
                      disabled={!activeNote}
                      onClick={() => setHighlightScopeFilter('current')}
                      className={`flex-1 py-1 px-2 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                        highlightScopeFilter === 'current'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                          : activeNote
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'opacity-40 cursor-not-allowed text-slate-500'
                      }`}
                      title={activeNote ? `Ver destaques da nota "${activeNote.title}"` : 'Abra uma nota para filtrar apenas seus destaques'}
                    >
                      <FileText className="w-3 h-3" />
                      <span>Nota Atual</span>
                      {activeNote && (
                        <span className="text-[10px] opacity-75 font-mono">({currentNoteHighlights.length})</span>
                      )}
                    </button>
                  </div>

                  {/* Filter by Specific Color */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Filter className="w-3 h-3 text-amber-400" />
                        <span>Filtrar por cor:</span>
                      </span>
                      {highlightColorFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setHighlightColorFilter('all')}
                          className="text-[10px] text-accent-light hover:underline cursor-pointer"
                        >
                          Limpar filtro
                        </button>
                      )}
                    </div>
                    {/* Color pills carousel/grid */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setHighlightColorFilter('all')}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                          highlightColorFilter === 'all'
                            ? 'bg-card text-white border-accent shadow-xs'
                            : 'bg-card/40 text-slate-400 border-card-border hover:bg-card hover:text-slate-200'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-slate-200" />
                        <span>Todas</span>
                        <span className="text-[10px] font-mono opacity-70">({highlightColorCounts.all})</span>
                      </button>
                      {HIGHLIGHT_PALETTE.map(col => {
                        const count = highlightColorCounts[col.id] || 0;
                        const isSelected = highlightColorFilter === col.id;
                        return (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => setHighlightColorFilter(isSelected ? 'all' : col.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                              isSelected
                                ? `${col.badgeBg} ${col.border} ring-1 ring-current shadow-xs`
                                : count > 0
                                ? 'bg-card/40 text-slate-300 border-card-border hover:bg-card hover:text-white'
                                : 'bg-card/20 text-slate-500 border-card-border/50 hover:bg-card/40'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${col.circleColor} shrink-0`} />
                            <span>{col.name}</span>
                            <span className="text-[10px] font-mono opacity-70">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Highlights List Body */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin scrollbar-thumb-card-border select-text">
                  {filteredHighlights.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 space-y-3">
                      <Highlighter className="w-8 h-8 text-amber-500/40 mx-auto" />
                      <p className="font-semibold text-slate-400">
                        {highlightColorFilter !== 'all' || searchQuery.trim() || highlightSearchQuery.trim()
                          ? 'Nenhum destaque encontrado com estes filtros'
                          : highlightScopeFilter === 'current'
                          ? 'Nenhum trecho destacado nesta nota'
                          : 'Nenhum trecho destacado no cofre'}
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                        Para destacar um trecho, selecione qualquer texto no editor visual e escolha a cor desejada no menu de Marca-texto.
                      </p>
                    </div>
                  ) : (
                    filteredHighlights.map((hl: ExtractedHighlight) => {
                      const isCopied = copiedHighlightId === hl.id;
                      return (
                        <div
                          key={hl.id}
                          onClick={() => handleJumpToHighlight(hl)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col space-y-2 group/card hover:shadow-md bg-card/70 hover:bg-card border-card-border hover:border-slate-600/80 border-l-4`}
                          style={{ borderLeftColor: hl.textColor }}
                        >
                          {/* Note Title & Folder Header */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-xs truncate text-slate-200 flex items-center gap-1.5 max-w-[200px]" title={hl.noteTitle}>
                              <FileText className="w-3.5 h-3.5 text-accent-light shrink-0" />
                              <span className="truncate">{hl.noteTitle}</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono shrink-0 truncate max-w-[100px]" title={hl.folder}>
                              📂 {hl.folder}
                            </span>
                          </div>

                          {/* Highlight Text Quote */}
                          <div 
                            className="p-2 rounded-xl text-xs leading-relaxed font-sans border transition-all"
                            style={{ 
                              backgroundColor: hl.bg, 
                              color: hl.textColor,
                              borderColor: 'rgba(255,255,255,0.06)' 
                            }}
                          >
                            <span className="opacity-60 text-sm font-serif">“</span>
                            <span className="font-medium select-text">{hl.text}</span>
                            <span className="opacity-60 text-sm font-serif">”</span>
                          </div>

                          {/* Action Footer */}
                          <div className="flex items-center justify-between pt-1 border-t border-card-border/50 text-[11px]">
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${hl.circleColor}`} />
                              <span>{hl.colorName}</span>
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyCitation(hl);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-card-border/40 hover:bg-card-border text-slate-300 hover:text-white flex items-center gap-1 transition-all text-[10px] font-semibold cursor-pointer"
                                title="Copiar citação com wikilink da nota"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJumpToHighlight(hl);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-light flex items-center gap-1 transition-all text-[10px] font-semibold cursor-pointer"
                                title="Abrir nota e pular para o trecho destacado"
                              >
                                <ArrowRight className="w-3 h-3" />
                                <span>Ver nota</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Trash Bin List */
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-thin scrollbar-thumb-card-border">
                {isLoadingTrash ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-accent-light" />
                    <span>Carregando notas excluídas...</span>
                  </div>
                ) : deletedNotes.filter(dn => 
                    dn.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    dn.originalFolder.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    dn.content.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                    <Archive className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-semibold text-slate-400">Lixeira Vazia</p>
                    <p className="text-[11px] text-slate-500">Nenhuma nota excluída ou arquivada no momento.</p>
                  </div>
                ) : (
                  deletedNotes
                    .filter(dn => 
                      dn.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      dn.originalFolder.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      dn.content.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((dn) => {
                      const isSelected = selectedDeletedNote?.backupFilename === dn.backupFilename;
                      return (
                        <div
                          key={dn.backupFilename}
                          onClick={() => {
                            setSelectedDeletedNote(dn);
                            setActiveNote(null);
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col space-y-1.5 ${
                            isSelected
                              ? 'bg-rose-950/30 border-rose-500/60 shadow-md ring-1 ring-rose-500/40'
                              : 'bg-card/70 border-card-border/80 text-slate-300 hover:bg-card-border/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate text-slate-200 flex items-center space-x-1.5 max-w-[170px]" title={dn.title}>
                              <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span className="truncate">{dn.title}</span>
                            </span>
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestoreNote(dn.backupFilename);
                                }}
                                className="p-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center space-x-1 transition-all"
                                title="Restaurar esta nota de volta para o cofre"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Restaurar</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePermanentlyDeleteNote(dn.backupFilename);
                                }}
                                className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                                title="Excluir permanentemente do disco"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span className="truncate max-w-[130px] text-amber-300/80">📂 {dn.originalFolder}</span>
                            <span>{new Date(dn.deletedAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>

          {/* Resizable Splitter 1: Between Sidebar and Note/Dashboard */}
          {!isNoteMaximized && !isSidebarCollapsed && (
            <div
              onMouseDown={() => setIsDraggingSidebar(true)}
              className={`w-1.5 cursor-col-resize hover:bg-accent transition-colors z-20 flex items-center justify-center shrink-0 ${
                isDraggingSidebar ? 'bg-accent shadow-sm' : 'bg-transparent hover:bg-accent/40'
              }`}
              title="Arraste para redimensionar barra lateral de notas"
            >
              <div className="w-0.5 h-6 rounded-full bg-slate-700/60" />
            </div>
          )}

          {/* Floating Collapsed Sidebar Restore Button (apenas quando em tela cheia maximizada) */}
          {isNoteMaximized && (
            <button
              onClick={() => {
                setIsSidebarCollapsed(false);
                setIsNoteMaximized(false);
              }}
              className="absolute left-2.5 top-2.5 z-30 p-2 rounded-xl bg-card/90 hover:bg-card border border-card-border shadow-xl text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all group backdrop-blur-md"
              title="Mostrar barra de cadernos e pastas"
            >
              <PanelLeftOpen className="w-4 h-4 text-accent-light group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold hidden md:inline">Cadernos</span>
            </button>
          )}

          {/* Active Note View & Editor Panel */}
          {activeNote ? (
            <div className="flex-1 flex flex-col bg-[#0b0d13] overflow-hidden">
              {/* Document Header */}
              <div className="p-3.5 border-b border-card-border bg-sidebar/40 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3 flex-1 mr-4 min-w-0">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSaveActiveNote}
                    placeholder="Título da Anotação..."
                    className="font-bold text-base bg-transparent text-slate-100 focus:outline-none focus:border-b border-accent flex-1"
                  />
                  
                  {/* Folder Breadcrumb & Switcher */}
                  <div className="flex items-center space-x-1.5 bg-panel border border-card-border px-2.5 py-1 rounded-xl shrink-0">
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <select
                      value={editFolder}
                      onChange={(e) => {
                        const newF = e.target.value;
                        setEditFolder(newF);
                        handleMoveNote(activeNote.id, newF);
                      }}
                      className="bg-transparent text-xs text-amber-300 focus:outline-none font-mono cursor-pointer max-w-[180px] truncate"
                      title="Mover anotação para outra pasta"
                    >
                      {allFolderNames.map(f => (
                        <option key={f} value={f} className="bg-card text-slate-200">
                          📁 {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  {onStartLiveVoice && (
                    <button
                      type="button"
                      onClick={() => {
                        onStartLiveVoice(activeNote.title, editContent);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-xs text-red-300 hover:text-white flex items-center space-x-1.5 transition-all shadow-sm font-semibold cursor-pointer"
                      title="Iniciar Live Voice para dialogar ou estudar sobre o conteúdo desta nota"
                    >
                      <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                      <span>Live Voice</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveActiveNote}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-sm"
                    title="Salvar alterações no cofre Obsidian (Ctrl+S)"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMoveModalNote(activeNote)}
                    className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 hover:text-amber-300 flex items-center space-x-1.5 transition-all"
                    title="Mover esta anotação para outra pasta"
                  >
                    <FolderInput className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mover</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copyNoteContent(editContent, activeNote.id)}
                    className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 flex items-center space-x-1.5 transition-all"
                    title="Copiar texto da nota"
                  >
                    {copiedId === activeNote.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  {/* Multi-Format Export Dropdown (PDF, Word, MD com Tags, MD Limpo) */}
                  <div className="relative" ref={exportMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                      disabled={isExporting}
                      className="px-3 py-1.5 rounded-xl bg-accent/20 hover:bg-accent border border-accent/40 hover:border-accent text-xs text-accent-light hover:text-white flex items-center space-x-1.5 transition-all cursor-pointer font-semibold shadow-xs"
                      title="Baixar nota já formatada em PDF, Word (.doc) ou Markdown (.md) para a pasta Downloads"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isExporting ? 'Baixando...' : 'Baixar Nota'}</span>
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </button>

                    {isExportMenuOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-64 p-1.5 rounded-2xl bg-card border border-card-border shadow-2xl z-50 backdrop-blur-md space-y-1 animate-in fade-in zoom-in-95">
                        <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 font-mono border-b border-card-border/60">
                          Salvar em Downloads:
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleNote(activeNote, 'pdf')}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-rose-500/20 text-slate-200 hover:text-rose-200 text-xs flex items-center space-x-2 transition-colors cursor-pointer text-left"
                          title="Exportar documento diagramado com capa, cabeçalho e imprimir em PDF"
                        >
                          <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold block">PDF Formatado</span>
                            <span className="text-[10px] text-slate-400 block">Com estilos, tabelas e pronto p/ imprimir</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleNote(activeNote, 'word')}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-blue-500/20 text-slate-200 hover:text-blue-200 text-xs flex items-center space-x-2 transition-colors cursor-pointer text-left"
                          title="Exportar arquivo compatível com Microsoft Word (.doc / .docx) com tabelas e formatação"
                        >
                          <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold block">Word (.doc / .docx)</span>
                            <span className="text-[10px] text-slate-400 block">Documento editável com tabelas e negritos</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleNote(activeNote, 'md_tags')}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-amber-500/20 text-slate-200 hover:text-amber-200 text-xs flex items-center space-x-2 transition-colors cursor-pointer text-left"
                          title="Exportar Markdown completo preservando todas as hashtags (#tags) e wikilinks do Obsidian"
                        >
                          <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
                            <Tag className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold block">Markdown (.md com Tags)</span>
                            <span className="text-[10px] text-slate-400 block">Preserva todas as #tags e wikilinks</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleNote(activeNote, 'md_clean')}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-200 text-xs flex items-center space-x-2 transition-colors cursor-pointer text-left"
                          title="Exportar Markdown fluido e limpo para leitura (sem hashtags de sistema)"
                        >
                          <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold block">Markdown (.md Leitura Limpa)</span>
                            <span className="text-[10px] text-slate-400 block">Sem poluição de tags de sistema</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteNote(activeNote.id, activeNote.isProjectSpecific)}
                    className="p-2 rounded-xl hover:bg-card-border text-slate-400 hover:text-rose-400 transition-colors"
                    title="Excluir anotação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Full Width Toggle */}
                  <button
                    type="button"
                    onClick={toggleFullWidth}
                    className={`p-2 rounded-xl border transition-colors ${
                      isFullWidth 
                        ? 'bg-accent/20 border-accent text-accent-light' 
                        : 'hover:bg-card-border border-transparent text-slate-400 hover:text-white'
                    }`}
                    title={isFullWidth ? "Largura Total ativada (clique para limitar a 896px)" : "Ocupar toda a largura da tela (Full Width)"}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>

                  {/* Maximize / Restore Note */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !isNoteMaximized;
                      setIsNoteMaximized(nextState);
                      if (nextState) setIsSidebarCollapsed(true);
                    }}
                    className={`p-2 rounded-xl border transition-colors ${
                      isNoteMaximized 
                        ? 'bg-accent/20 border-accent text-accent-light' 
                        : 'hover:bg-card-border border-transparent text-slate-400 hover:text-white'
                    }`}
                    title={isNoteMaximized ? "Restaurar tamanho normal" : "Maximizar nota (foco total na leitura e escrita)"}
                  >
                    {isNoteMaximized ? (
                      <Minimize2 className="w-4 h-4 text-accent-light" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* DOCUMENT BODY - DIGITAL NOTEBOOK CANVAS FORMATADO */}
              <div 
                ref={previewContainerRef}
                  className="flex-1 overflow-y-auto bg-[#0a0c12] p-6 lg:p-8 scrollbar-thin scrollbar-thumb-card-border select-text"
                  onMouseUp={handleTextSelection}
                  onContextMenu={handleContextMenu}
                >
                  <div className={`space-y-6 ${isFullWidth ? 'w-full max-w-none' : 'max-w-4xl mx-auto'}`}>
                    {/* Cover Banner & Page Header Flexível (Sem sobreposição) */}
                    <div className="relative mb-4">
                      <div className="min-h-[90px] py-4 px-5 w-full rounded-3xl bg-gradient-to-r from-violet-950/60 via-accent/25 to-cyan-950/60 border border-card-border/60 shadow-lg relative overflow-visible flex items-center justify-between flex-wrap gap-3">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative z-10 flex items-center justify-between w-full flex-wrap gap-3">
                          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                className="text-3xl p-2.5 rounded-2xl bg-card/90 border border-card-border shadow-xl backdrop-blur-md select-none hover:scale-110 transition-transform cursor-pointer"
                                title="Alterar ícone da página"
                              >
                                {noteEmoji}
                              </button>
                              {isEmojiPickerOpen && (
                                <div className="absolute left-0 top-full mt-2 p-2 rounded-2xl bg-card border border-card-border shadow-2xl z-50 grid grid-cols-4 gap-1.5 w-44 backdrop-blur-md" ref={emojiPickerRef}>
                                  {EMOJI_PRESETS.map(em => (
                                    <button
                                      key={em}
                                      type="button"
                                      onClick={() => {
                                        setNoteEmoji(em);
                                        setIsEmojiPickerOpen(false);
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-accent/30 text-lg transition-colors text-center"
                                    >
                                      {em}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={handleSaveActiveNote}
                                placeholder="Título da Anotação..."
                                className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight bg-transparent focus:outline-none focus:border-b border-accent w-full"
                              />
                              <p className="text-xs text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5 truncate">
                                <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{activeNote.relativePath || `${editFolder}/${activeNote.filename}`}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsReorderModalOpen(true)}
                              className="px-3 py-1.5 rounded-xl bg-card/80 hover:bg-card border border-card-border text-xs text-slate-200 hover:text-amber-300 flex items-center space-x-1.5 transition-all shadow-md backdrop-blur-md"
                              title="Reordenar tópicos e seções da nota"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden sm:inline">Organizar Tópicos</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sticky Rich Formatting Toolbar (Disponível diretamente no Modo Formatado!) */}
                    <div className="sticky top-0 z-30 mb-4 p-2 rounded-2xl bg-[#13151f]/95 border border-card-border/80 shadow-xl flex flex-wrap items-center gap-1 shrink-0 backdrop-blur-md">
                      {/* Undo / Redo History */}
                      <div className="flex items-center space-x-0.5 pr-1.5 border-r border-card-border">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={handleUndo}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Desfazer (Ctrl+Z)"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={handleRedo}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Refazer (Ctrl+Y)"
                        >
                          <Redo2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Text Styles */}
                      <div className="flex items-center space-x-0.5 pr-1.5 border-r border-card-border">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyFormatting('**', '**')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Negrito (**)"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyFormatting('*', '*')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Itálico (*)"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyFormatting('<u>', '</u>')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Sublinhado (<u>)"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyFormatting('~~', '~~')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Tachado (~~)"
                        >
                          <Strikethrough className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyFormatting('`', '`')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors font-mono cursor-pointer"
                          title="Código Inline (`código`)"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>

                        {/* Pincel de Formatação */}
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={handleToggleFormatPainter}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            formatPainterState 
                              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 ring-1 ring-amber-500/40 shadow-sm' 
                              : 'hover:bg-card-border text-slate-300 hover:text-white'
                          }`}
                          title={
                            formatPainterState 
                              ? "Pincel de Formatação ativo (clique para cancelar ou selecione um texto para pintar)" 
                              : "Pincel de Formatação (copiar estilo de um texto e aplicar em outro)"
                          }
                        >
                          <Paintbrush className="w-3.5 h-3.5" />
                        </button>

                        {/* Limpar Formatação */}
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={clearFormatting}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Limpar Marcação e Cores (remover marca-texto e cor personalizada, mantendo negrito e itálico)"
                        >
                          <RemoveFormatting className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Headings */}
                      <div className="flex items-center space-x-0.5 px-1.5 border-r border-card-border">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyLinePrefix('# ')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-cyan-300 transition-colors font-bold text-xs"
                          title="Título 1 (#)"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyLinePrefix('## ')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-cyan-300 transition-colors font-bold text-xs"
                          title="Título 2 (##)"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyLinePrefix('### ')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-cyan-300 transition-colors font-bold text-xs"
                          title="Título 3 (###)"
                        >
                          H3
                        </button>
                      </div>

                      {/* Lists & Checklists */}
                      <div className="flex items-center space-x-0.5 px-1.5 border-r border-card-border">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyLinePrefix('- ')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Lista com Marcadores (-)"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyLinePrefix('1. ')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-white transition-colors"
                          title="Lista Numerada (1.)"
                        >
                          <ListOrdered className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => applyLinePrefix('- [ ] ')}
                          className="p-1.5 rounded-lg hover:bg-card-border text-slate-300 hover:text-emerald-300 transition-colors"
                          title="Checklist (- [ ])"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Colors Palette & Highlighter */}
                      <div className="relative flex items-center space-x-0.5 px-1.5 border-r border-card-border" ref={colorPickerRef}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                          className="p-1.5 rounded-lg hover:bg-card-border text-amber-300 hover:text-amber-200 transition-colors flex items-center space-x-1"
                          title="Trocar Cor do Texto e Marca-texto"
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>

                        {isColorPickerOpen && (
                          <div 
                            className="absolute left-0 top-full mt-1.5 p-3 rounded-2xl bg-card border border-card-border shadow-2xl z-50 w-64 backdrop-blur-md space-y-3"
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          >
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block mb-1.5">Cor do Texto:</span>
                              <div className="grid grid-cols-4 gap-1.5">
                                {TEXT_COLORS.map(c => (
                                  <button
                                    key={c.hex}
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onClick={() => applyTextColor(c.hex)}
                                    className="flex items-center space-x-1 p-1 rounded-lg hover:bg-card-border text-[11px] text-slate-200"
                                    title={c.name}
                                  >
                                    <span className={`w-3 h-3 rounded-full ${c.bg} shrink-0`} />
                                    <span className="truncate">{c.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="pt-2 border-t border-card-border">
                              <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block mb-1.5">Marca-texto / Destaque:</span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {HIGHLIGHT_COLORS.map(h => (
                                  <button
                                    key={h.name}
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onClick={() => applyHighlight(h.bg, h.text)}
                                    className="flex items-center space-x-1 p-1 rounded-lg hover:bg-card-border text-[11px] text-slate-200"
                                    title={`Marca-texto ${h.name}`}
                                  >
                                    <span className={`w-3 h-3 rounded-full ${h.circle} shrink-0`} />
                                    <span className="truncate">{h.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Current Note Highlights Shortcut Badge */}
                      {currentNoteHighlights.length > 0 && (
                        <div className="flex items-center px-1.5 border-r border-card-border">
                          <button
                            type="button"
                            onClick={() => {
                              setSidebarTab('highlights');
                              setHighlightScopeFilter('current');
                              setIsSidebarCollapsed(false);
                            }}
                            className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                            title="Ver todos os destaques desta nota na barra lateral"
                          >
                            <Highlighter className="w-3 h-3 text-amber-400" />
                            <span>{currentNoteHighlights.length} {currentNoteHighlights.length === 1 ? 'destaque' : 'destaques'}</span>
                          </button>
                        </div>
                      )}

                      {/* Image Upload Button */}
                      <div className="flex items-center space-x-0.5 px-1.5 border-r border-card-border">
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleImageUpload(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => imageInputRef.current?.click()}
                          disabled={isUploadingImage}
                          className="p-1.5 rounded-lg hover:bg-card-border text-emerald-400 hover:text-emerald-300 transition-colors flex items-center space-x-1"
                          title="Inserir Imagem (Upload do PC ou cole prints com Ctrl+V)"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span className="text-[11px] hidden xl:inline">{isUploadingImage ? 'Enviando...' : 'Imagem'}</span>
                        </button>
                      </div>

                      {/* Wikilink [[ ]] */}
                      <div className="flex items-center space-x-0.5 px-1.5 border-r border-card-border">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => setIsWikilinkModalOpen(true)}
                          className="p-1.5 rounded-lg hover:bg-card-border text-accent-light hover:text-white transition-colors flex items-center space-x-1"
                          title="Inserir Conexão [[Wikilink]] com outra nota"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-mono hidden xl:inline">[[ ]]</span>
                        </button>
                      </div>

                      {/* Reorder Topics */}
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={() => setIsReorderModalOpen(true)}
                        className="p-1.5 rounded-lg hover:bg-card-border text-amber-300 hover:text-amber-200 transition-colors flex items-center space-x-1 text-xs"
                        title="Organizar Tópicos (Mover seções para cima ▲ ou baixo ▼)"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden xl:inline text-[11px]">Organizar</span>
                      </button>

                      {/* Live Voice da Nota */}
                      {onStartLiveVoice && (
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => onStartLiveVoice(activeNote.title, activeNote.content)}
                          className="ml-auto px-2.5 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                          title="Iniciar Live Voice para dialogar sobre esta nota"
                        >
                          <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                          <span>Live Voice</span>
                        </button>
                      )}
                    </div>

                    {/* Format Painter Active Indicator Banner */}
                    {formatPainterState && (
                      <div className="sticky top-2 z-30 p-2.5 rounded-2xl bg-amber-950/90 border border-amber-500/50 shadow-2xl backdrop-blur-md flex items-center justify-between text-xs text-amber-200 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center space-x-2">
                          <Paintbrush className="w-4 h-4 text-amber-400 animate-bounce" />
                          <span className="font-semibold">Pincel de Formatação Ativo:</span>
                          <span className="text-amber-300/90">
                            Selecione qualquer trecho de texto no editor para aplicar o estilo capturado
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormatPainterState(null);
                            setPainterToast(null);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Cancelar (Esc)
                        </button>
                      </div>
                    )}

                    {/* Format Painter Toast Feedback */}
                    {painterToast && !formatPainterState && (
                      <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-card/95 border border-emerald-500/50 shadow-2xl text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 backdrop-blur-md">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{painterToast}</span>
                      </div>
                    )}

                    {/* CANVAS DIGITAL FORMATADO E EDITÁVEL (WYSIWYG) */}
                    <div
                      ref={editableContainerRef}
                      contentEditable
                      suppressContentEditableWarning
                      onKeyDown={handleEditorKeyDown}
                      onInput={handleEditorInput}
                      onClick={handleEditorClick}
                      onPaste={handleEditorPasteFormatted}
                      onDrop={handleEditorDropFormatted}
                      onMouseUp={handleTextSelection}
                      onContextMenu={handleContextMenu}
                      className={`prose prose-invert max-w-none text-sm leading-relaxed p-6 sm:p-8 bg-[#10131d]/60 rounded-3xl border border-card-border/60 shadow-2xl min-h-[500px] outline-none select-text cursor-text focus:border-accent/40 transition-colors pb-32 ${
                        formatPainterState ? 'ring-2 ring-amber-500/40 cursor-copy' : ''
                      }`}
                    />

                    {/* Backlinks Section */}
                    {activeNote.backlinks && activeNote.backlinks.length > 0 && (
                      <div className="mt-12 pt-6 border-t border-card-border">
                        <div className="flex items-center space-x-2 text-xs font-bold text-accent-light mb-3">
                          <LinkIcon className="w-4 h-4" />
                          <span>Notas que mencionam esta ({activeNote.backlinks.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeNote.backlinks.map(b => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => {
                                const targetNote = notes.find(n => n.title.toLowerCase() === b.toLowerCase());
                                if (targetNote) selectNote(targetNote);
                              }}
                              className="px-3 py-1 rounded-xl bg-accent/15 hover:bg-accent/30 border border-accent/30 text-xs text-slate-200 font-medium transition-colors cursor-pointer"
                            >
                              [[{b}]]
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          ) : selectedDeletedNote ? (
            /* Deleted Note Preview Mode */
            <div className="flex-1 flex flex-col bg-[#0b0d13] overflow-hidden">
              <div className="p-3.5 border-b border-rose-950/60 bg-rose-950/20 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center space-x-2">
                      <h2 className="font-bold text-sm text-rose-200 truncate">{selectedDeletedNote.title}</h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Excluída em {new Date(selectedDeletedNote.deletedAt).toLocaleDateString('pt-BR')} {new Date(selectedDeletedNote.deletedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      📂 Pasta Original: <strong className="text-amber-300">{selectedDeletedNote.originalFolder}</strong> • Backup: {selectedDeletedNote.backupFilename}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleRestoreNote(selectedDeletedNote.backupFilename)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-950/30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Nota</span>
                  </button>

                  <button
                    onClick={() => handlePermanentlyDeleteNote(selectedDeletedNote.backupFilename)}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 font-semibold text-xs flex items-center space-x-1.5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Definitivamente</span>
                  </button>
                </div>
              </div>

              {/* Read-only Document Preview */}
              <div className="flex-1 overflow-y-auto bg-[#0a0c12] p-8 scrollbar-thin scrollbar-thumb-card-border select-text">
                <div className={`space-y-6 ${isFullWidth ? 'w-full max-w-none' : 'max-w-4xl mx-auto'}`}>
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Esta nota está na lixeira e será excluída automaticamente após o período configurado ({retentionPolicy.replace('_', ' ')}). Clique em <strong>Restaurar Nota</strong> para reativá-la no cofre.
                    </span>
                  </div>

                  <div className="prose prose-invert max-w-none text-sm leading-relaxed select-text space-y-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedDeletedNote.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* NOTEBOOK DASHBOARD (When no note is actively selected) */
            <div className="flex-1 overflow-y-auto bg-[#07090e] p-6 lg:p-8 scrollbar-thin scrollbar-thumb-card-border select-text">
              {(() => {
                const isAll = selectedNotebookId === 'all';
                const currentNb = currentSelectedNotebook;
                const details = currentNb
                  ? getNotebookDetails(currentNb.id)
                  : {
                      label: 'Todos os Cadernos',
                      icon: BookOpen,
                      color: 'text-cyan-400',
                      bg: 'bg-panel/40 border-card-border',
                      badgeBg: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
                      accentBorder: 'border-cyan-500',
                      category: 'Vault'
                    };
                const NbIcon = details.icon;

                // Notes to display on this dashboard
                const dashboardNotes = (isAll ? filteredNotes : (currentNb?.allNotes || []))
                  .slice()
                  .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

                const subfoldersList = isAll
                  ? notebooksList.flatMap(nb => nb.subfolders)
                  : (currentNb?.subfolders || []);

                return (
                  <div className={`space-y-7 ${isFullWidth ? 'w-full max-w-none' : 'max-w-6xl mx-auto'}`}>
                    {/* Hero Banner Card */}
                    <div className={`p-6 sm:p-7 rounded-3xl border ${details.bg} shadow-2xl relative overflow-hidden bg-gradient-to-br from-card/90 via-panel/80 to-card/50`}>
                      {/* Glow Accent */}
                      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
                      
                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div className="flex items-start space-x-4">
                          <div className={`p-3.5 rounded-2xl ${details.badgeBg} shadow-md shrink-0`}>
                            <NbIcon className={`w-8 h-8 ${details.color}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2.5">
                              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                                {isAll ? 'Central de Cadernos do Vault' : `Caderno: ${currentNb?.id}`}
                              </h1>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${details.badgeBg}`}>
                                {details.category}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
                              {isAll
                                ? 'Gerenciamento visual e inteligente de notas em Markdown, planos de estudo, fotos manuscritas de caderno e matérias de concurso.'
                                : `Caderno temático com subpastas organizadas, anotações detalhadas e planos de ação para ${currentNb?.id}.`}
                            </p>
                            
                            {/* Badges / Metrics */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-mono">
                              <span className="px-2.5 py-1 rounded-xl bg-panel border border-card-border text-slate-300 flex items-center space-x-1.5">
                                <FileText className="w-3.5 h-3.5 text-accent-light" />
                                <span><strong>{dashboardNotes.length}</strong> {dashboardNotes.length === 1 ? 'anotação' : 'anotações'}</span>
                              </span>
                              <span className="px-2.5 py-1 rounded-xl bg-panel border border-card-border text-slate-300 flex items-center space-x-1.5">
                                <Folder className="w-3.5 h-3.5 text-amber-400" />
                                <span><strong>{subfoldersList.length}</strong> {subfoldersList.length === 1 ? 'subpasta' : 'subpastas'}</span>
                              </span>
                              <button
                                onClick={() => {
                                  setSidebarTab('trash');
                                  setIsSidebarCollapsed(false);
                                  fetchDeletedNotes();
                                }}
                                className="px-2.5 py-1 rounded-xl bg-panel hover:bg-rose-950/30 border border-card-border hover:border-rose-500/40 text-slate-300 hover:text-rose-300 flex items-center space-x-1.5 transition-all cursor-pointer"
                                title="Abrir Lixeira de Notas e Pastas"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span>Lixeira {deletedNotes.length > 0 ? `(${deletedNotes.length})` : ''}</span>
                              </button>
                              <button
                                onClick={() => setIsCreditsOpen(true)}
                                className="px-2.5 py-1 rounded-xl bg-panel hover:bg-card border border-card-border hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 flex items-center space-x-1.5 transition-colors group cursor-pointer"
                                title="Abrir Créditos & Fundamentos Arquiteturais (Frank MD e AI-Memory do Akita)"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                                <span>Notes Module (Frank MD & AI-Memory) • Ver Créditos</span>
                                <Sparkles className="w-2.5 h-2.5 text-accent-light" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions Row */}
                        <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
                          {onStartLiveVoice && (
                            <button
                              onClick={() => {
                                onStartLiveVoice(
                                  isAll ? 'Central de Cadernos' : `Caderno: ${currentNb?.id}`,
                                  `Estudo e diálogo por voz sobre o caderno ${isAll ? 'completo' : currentNb?.id} com ${dashboardNotes.length} anotações.`
                                );
                              }}
                              className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 hover:text-white font-semibold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
                              title={`Iniciar sessão de Live Voice com o modelo sobre ${isAll ? 'todos os cadernos' : `o caderno ${currentNb?.id}`}`}
                            >
                              <Mic className="w-4 h-4 text-red-400" />
                              <span>🎙️ Live Voice do Caderno</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleCreateNoteInFolder(isAll ? 'Geral' : currentNb?.id || 'Geral')}
                            className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center space-x-2 transition-all shadow-md shadow-accent/20 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ Nova Anotação</span>
                          </button>
                          <button
                            onClick={() => handleDownloadEntireNotebook(isAll ? 'all' : (currentNb?.id || selectedNotebookId))}
                            className="px-3.5 py-2 rounded-xl bg-panel hover:bg-card-border border border-card-border hover:border-accent text-slate-200 hover:text-accent-light font-semibold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
                            title="Baixar todas as notas deste caderno em um único arquivo formatado sem tags (.md) na pasta de Downloads"
                          >
                            <Download className="w-4 h-4 text-accent-light" />
                            <span>📥 Baixar Caderno Completo</span>
                          </button>
                          <button
                            onClick={() => {
                              onReturnToAgent?.();
                            }}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center space-x-2 transition-all cursor-pointer"
                            title="Tirar foto do caderno físico e enviar comando 'Anote isso' no chat do agente"
                          >
                            <Camera className="w-4 h-4 text-emerald-400" />
                            <span>📷 Digitalizar Caderno ("Anote isso")</span>
                          </button>
                          <button
                            onClick={() => setViewMode('graph')}
                            className="px-3.5 py-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-slate-300 hover:text-white font-semibold text-xs flex items-center space-x-2 transition-all cursor-pointer"
                          >
                            <Network className="w-4 h-4 text-cyan-400" />
                            <span>Visualizar Grafo</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Back to Home Button when in a specific notebook */}
                    {!isAll && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={goToHome}
                          className="px-3.5 py-1.5 rounded-xl bg-panel hover:bg-card border border-card-border text-xs text-slate-300 hover:text-white font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Home className="w-3.5 h-3.5 text-accent-light" />
                          <span>← Voltar para Todos os Cadernos</span>
                        </button>
                      </div>
                    )}

                    {/* Home Interactive Hub: Dropzone & Graph Preview (When in 'all' view) */}
                    {isAll && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* 1. Smart Dropzone Card (5 cols) */}
                        <div className="lg:col-span-5 flex flex-col">
                          <div 
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsHomeDraggingOver(true);
                            }}
                            onDragLeave={() => setIsHomeDraggingOver(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsHomeDraggingOver(false);
                              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                setInitialHomeDropFiles(Array.from(e.dataTransfer.files));
                                setIsDropzoneOpen(true);
                              }
                            }}
                            onClick={() => {
                              setInitialHomeDropFiles(null);
                              setIsDropzoneOpen(true);
                            }}
                            className={`p-6 rounded-3xl border-2 transition-all duration-200 cursor-pointer flex-1 flex flex-col justify-between shadow-xl relative overflow-hidden group ${
                              isHomeDraggingOver
                                ? 'border-brand-cyan bg-brand-cyan/15 ring-4 ring-brand-cyan/20 scale-[1.01]'
                                : 'border-dashed border-card-border/80 hover:border-brand-cyan/50 bg-gradient-to-b from-card/80 via-panel/60 to-card/40 hover:bg-card/90'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="p-3 rounded-2xl bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan">
                                  <Upload className="w-6 h-6 animate-pulse" />
                                </div>
                                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                                  ⚡ Auto-Organização IA
                                </span>
                              </div>

                              <div>
                                <h3 className="font-bold text-base text-slate-100 group-hover:text-brand-cyan transition-colors flex items-center space-x-1.5">
                                  <span>Smart Dropzone do Vault</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                                  Arraste ou selecione qualquer arquivo (PDFs, imagens de cadernos, apostilas, docs, código, planilhas). A IA classifica automaticamente na pasta certa e gera o relatório.
                                </p>
                              </div>
                            </div>

                            <div className="pt-5 mt-4 border-t border-card-border/60 flex items-center justify-between">
                              <span className="text-xs text-brand-cyan font-semibold flex items-center space-x-1">
                                <span>Soltar arquivos aqui</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 bg-panel px-2 py-0.5 rounded-lg border border-card-border">
                                Arraste ou clique
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Embedded Graph View Card (7 cols) */}
                        <div className="lg:col-span-7 flex flex-col">
                          <div className="p-5 rounded-3xl border border-card-border/80 bg-gradient-to-b from-card/80 to-panel/50 shadow-xl flex-1 flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                                  <Network className="w-4 h-4" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                                    <span>Grafo de Conhecimento do Vault</span>
                                  </h3>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Exploração visual das notas, cadernos e conexões [[...]]
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => setViewMode('graph')}
                                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                                title="Abrir em tela cheia com alternador de 3 universos (Notas, Skills, Projetos)"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>Expandir Grafo</span>
                              </button>
                            </div>

                            {/* Embedded Mini Graph Canvas */}
                            <div className="h-[230px] w-full rounded-2xl overflow-hidden border border-card-border/80 bg-[#050608] relative">
                              <InteractiveGraphCanvas
                                initialType="notes"
                                embeddedMode={true}
                                onOpenNote={(noteTitle) => {
                                  const cleanTitle = noteTitle.replace(/^#+\s*/, '').trim();
                                  const found = notes.find(n => n.title.toLowerCase() === cleanTitle.toLowerCase() || n.id.toLowerCase() === cleanTitle.toLowerCase());
                                  if (found) {
                                    selectNote(found);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cadernos Temáticos Grid (When in 'all' view) */}
                    {isAll && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center space-x-2">
                              <Book className="w-3.5 h-3.5 text-accent-light" />
                              <span>Cadernos Temáticos & Pastas ({notebooksList.length})</span>
                            </h2>
                            <p className="text-[11px] text-slate-500">
                              Clique em qualquer caderno para filtrar a barra lateral exclusivamente para ele.
                            </p>
                          </div>
                          <button
                            onClick={() => setIsCreatingNotebook(true)}
                            className="text-xs text-cyan-400 hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Novo Caderno</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {notebooksList.map(nb => {
                            const nbDet = getNotebookDetails(nb.id);
                            const IconComp = nbDet.icon;
                            const previewSubnotes = nb.allNotes.slice(0, 3);

                            return (
                              <div
                                key={nb.id}
                                className={`p-5 rounded-3xl border ${nbDet.bg} hover:border-accent/60 transition-all duration-200 hover:-translate-y-0.5 shadow-lg flex flex-col justify-between space-y-4 group`}
                              >
                                <div className="space-y-3">
                                  {/* Notebook Card Header */}
                                  <div className="flex items-start justify-between gap-3 min-w-0">
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                      <div className={`p-3 rounded-2xl ${nbDet.badgeBg} shadow-sm shrink-0`}>
                                        <IconComp className={`w-5 h-5 ${nbDet.color}`} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <h3 
                                          onClick={() => openNotebook(nb.id)}
                                          className="font-bold text-base text-slate-100 group-hover:text-accent-light transition-colors truncate cursor-pointer"
                                          title={`Abrir caderno ${nb.id}`}
                                        >
                                          {nb.id}
                                        </h3>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase inline-block mt-0.5 ${nbDet.badgeBg}`}>
                                          {nbDet.category}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-1.5 shrink-0">
                                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-panel border border-card-border text-slate-300 font-semibold">
                                        {nb.totalCount} {nb.totalCount === 1 ? 'anotação' : 'anotações'}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadEntireNotebook(nb.id);
                                        }}
                                        className="p-1.5 rounded-xl bg-panel hover:bg-accent/20 border border-card-border hover:border-accent/40 text-slate-400 hover:text-accent-light transition-colors cursor-pointer"
                                        title={`Baixar caderno "${nb.id}" completo formatado sem tags (.md) para a pasta de Downloads`}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>
                                      {nb.id !== 'Geral' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFolder(nb.id);
                                          }}
                                          className="p-1.5 rounded-xl bg-panel hover:bg-rose-500/20 border border-card-border hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                          title={`Excluir caderno "${nb.id}" e mover para a lixeira`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Subpastas Pills inside Notebook */}
                                  {nb.subfolders.length > 0 && (
                                    <div className="space-y-1.5 min-w-0">
                                      <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold block">
                                        Subpastas ({nb.subfolders.length}):
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {nb.subfolders.slice(0, 4).map(sub => (
                                          <div
                                            key={sub.path}
                                            className="inline-flex items-center rounded-lg bg-panel/80 hover:bg-card border border-card-border text-[10px] text-amber-300 font-mono transition-colors pl-2 pr-1 py-0.5 group/subpill max-w-full"
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openNotebook(nb.id);
                                                setCollapsedFolders(prev => ({ ...prev, [sub.path]: false, [`nb:${nb.id}`]: false }));
                                                if (sub.notes.length > 0) {
                                                  selectNote(sub.notes[0]);
                                                }
                                              }}
                                              className="flex items-center space-x-1 cursor-pointer truncate max-w-[220px]"
                                              title={`Abrir subpasta: ${sub.path} (${sub.notes.length} anotações)`}
                                            >
                                              <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                                              <span className="truncate">{sub.name}</span>
                                              <span className="text-slate-500 shrink-0">({sub.notes.length})</span>
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFolder(sub.path);
                                              }}
                                              className="p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                                              title={`Excluir subpasta "${sub.name}"`}
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        ))}
                                        {nb.subfolders.length > 4 && (
                                          <span className="px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
                                            +{nb.subfolders.length - 4} mais
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Subnotes Preview List */}
                                  <div className="space-y-1.5 pt-1 min-w-0">
                                    <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold block">
                                      {nb.directNotes.length > 0 && nb.subfolders.length > 0
                                        ? 'Anotações Recentes (Raiz & Subpastas):'
                                        : nb.directNotes.length === 0 && nb.subfolders.length > 0
                                        ? 'Anotações nas Subpastas:'
                                        : 'Anotações no Caderno:'}
                                    </span>
                                    {previewSubnotes.length === 0 ? (
                                      <div className="text-[11px] text-slate-500 italic py-1">
                                        Caderno vazio. Clique em Abrir para criar notas.
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        {previewSubnotes.map(note => {
                                          const noteFolderPath = getNoteFolder(note);
                                          const subfolderPart = noteFolderPath.includes('/')
                                            ? noteFolderPath.split('/').slice(1).join('/')
                                            : null;

                                          return (
                                            <div
                                              key={note.id}
                                              onClick={() => selectNote(note)}
                                              className="px-2.5 py-1.5 rounded-xl bg-card/60 hover:bg-card border border-card-border/60 hover:border-accent/40 text-xs text-slate-200 cursor-pointer transition-all flex items-center justify-between group/note min-w-0"
                                            >
                                              <span className="truncate flex items-center space-x-2 min-w-0 flex-1">
                                                <FileText className="w-3 h-3 text-accent-light shrink-0" />
                                                <span className="truncate font-medium group-hover/note:text-accent-light">{note.title}</span>
                                              </span>
                                              <div className="flex items-center space-x-1 shrink-0 ml-1.5">
                                                {subfolderPart && (
                                                  <span 
                                                    className="text-[9px] font-mono text-amber-300/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 max-w-[140px] truncate flex items-center space-x-1 shrink-0"
                                                    title={`Subpasta: ${noteFolderPath}`}
                                                  >
                                                    <Folder className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                                                    <span className="truncate">{subfolderPart}</span>
                                                  </span>
                                                )}
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteNote(note.id, note.isProjectSpecific);
                                                  }}
                                                  className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                                  title={`Excluir nota "${note.title}"`}
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                                <ChevronRight className="w-3 h-3 text-slate-500 group-hover/note:text-accent-light shrink-0" />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Footer Action */}
                                <div className="pt-3 border-t border-card-border/60 flex items-center justify-between">
                                  <button
                                    onClick={() => handleCreateNoteInFolder(nb.id)}
                                    className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Nova Nota</span>
                                  </button>

                                  <button
                                    onClick={() => openNotebook(nb.id)}
                                    className="px-3 py-1 rounded-xl bg-accent/20 hover:bg-accent border border-accent/40 text-accent-light hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                                  >
                                    <span>Abrir Caderno</span>
                                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Subpastas & Módulos Section */}
                    {subfoldersList.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center space-x-2">
                            <Folder className="w-3.5 h-3.5 text-amber-400" />
                            <span>Subpastas & Módulos ({subfoldersList.length})</span>
                          </h2>
                          <button
                            onClick={() => {
                              setNewFolderName(isAll ? '' : `${currentNb?.id}/`);
                              setIsCreatingFolder(true);
                            }}
                            className="text-xs text-accent-light hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <FolderPlus className="w-3 h-3" />
                            <span>Nova Subpasta</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {subfoldersList.map(sub => (
                            <div
                              key={sub.path}
                              onClick={() => {
                                if (sub.notes.length > 0) {
                                  selectNote(sub.notes[0]);
                                } else {
                                  handleCreateNoteInFolder(sub.path);
                                }
                              }}
                              className="p-3 rounded-2xl bg-card/70 border border-card-border/80 hover:border-amber-500/50 hover:bg-card cursor-pointer transition-all duration-200 flex items-center justify-between group min-w-0"
                            >
                              <div className="flex items-center space-x-2.5 truncate min-w-0 flex-1">
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                                  <Folder className="w-4 h-4" />
                                </div>
                                <div className="truncate min-w-0 flex-1">
                                  <span className="font-bold text-xs text-slate-200 group-hover:text-amber-300 transition-colors block truncate" title={sub.path}>
                                    {sub.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    {sub.notes.length} {sub.notes.length === 1 ? 'anotação' : 'anotações'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 shrink-0 ml-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateNoteInFolder(sub.path);
                                  }}
                                  className="p-1 rounded hover:bg-panel text-slate-400 hover:text-white"
                                  title={`Criar nova nota em "${sub.path}"`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolder(sub.path);
                                  }}
                                  className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                  title={`Excluir subpasta "${sub.name}" e mover para a lixeira`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notas Recentes & Destaques Grid */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center space-x-2">
                          <FileText className="w-3.5 h-3.5 text-accent-light" />
                          <span>
                            {isAll ? 'Todas as Anotações Recentes' : `Anotações do Caderno (${dashboardNotes.length})`}
                          </span>
                        </h2>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Clique em qualquer nota para ler formatada
                        </span>
                      </div>

                      {dashboardNotes.length === 0 ? (
                        <div className="p-12 text-center rounded-2xl border border-card-border bg-card/40 space-y-3">
                          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
                          <div className="space-y-1">
                            <p className="font-bold text-sm text-slate-300">Nenhuma anotação neste caderno ainda</p>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto">
                              Crie uma nova nota Markdown ou anexe a foto de uma página do seu caderno físico com o comando "anote isso".
                            </p>
                          </div>
                          <button
                            onClick={() => handleCreateNoteInFolder(isAll ? 'Geral' : currentNb?.id || 'Geral')}
                            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs inline-flex items-center space-x-2 shadow-md transition-all cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Criar Primeira Nota</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {dashboardNotes.map(n => {
                            const folderName = getNoteFolder(n);
                            const nbDet = getNotebookDetails(folderName.split('/')[0] || folderName);
                            const excerpt = n.content
                              .replace(/^#+.*?\n/g, '')
                              .replace(/<!--.*?-->/g, '')
                              .replace(/\[\[(.*?)\]\]/g, '$1')
                              .trim()
                              .slice(0, 160);

                            return (
                              <div
                                key={n.id}
                                onClick={() => {
                                  selectNote(n);
                                }}
                                className="p-4 rounded-2xl border border-card-border/80 bg-card/60 hover:bg-card hover:border-accent/50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md flex flex-col justify-between space-y-3 group"
                              >
                                <div className="space-y-2">
                                  {/* Folder Badge + Date + Delete Button */}
                                  <div className="flex items-center justify-between text-[10px] font-mono">
                                    <span className={`px-2 py-0.5 rounded-md font-semibold truncate max-w-[160px] ${nbDet.badgeBg}`} title={folderName}>
                                      📂 {folderName}
                                    </span>
                                    <div className="flex items-center space-x-1.5 shrink-0">
                                      <span className="text-slate-500">
                                        {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('pt-BR') : ''}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteNote(n.id, n.isProjectSpecific);
                                        }}
                                        className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                        title={`Excluir nota "${n.title}"`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Note Title */}
                                  <h3 className="font-bold text-sm text-slate-100 group-hover:text-accent-light transition-colors line-clamp-1">
                                    {n.title}
                                  </h3>

                                  {/* Note Excerpt */}
                                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                                    {excerpt || 'Sem conteúdo textual adicional.'}
                                  </p>
                                </div>

                                {/* Bottom Footer with Tags and Format Pill */}
                                <div className="pt-3 border-t border-card-border/50 flex items-center justify-between text-[10px]">
                                  <div className="flex flex-wrap gap-1 items-center max-w-[190px] overflow-hidden">
                                    {n.tags && n.tags.length > 0 ? (
                                      n.tags.slice(0, 2).map(t => (
                                        <span key={t} className="px-1.5 py-0.2 rounded bg-panel border border-card-border text-slate-400 font-mono">
                                          {t}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-600 font-mono">#nota</span>
                                    )}
                                  </div>

                                  <span className="text-accent-light font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                                    <span>Abrir</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Smart Dropzone Modal with AI Auto-Organization & Report */}
      <SmartDropzoneModal
        isOpen={isDropzoneOpen}
        initialFiles={initialHomeDropFiles}
        onClose={() => {
          setIsDropzoneOpen(false);
          setInitialHomeDropFiles(null);
        }}
        onOpenNote={(noteTitle) => {
          const cleanTitle = noteTitle.replace(/^#+\s*/, '').trim();
          const found = notes.find(n => n.title.toLowerCase() === cleanTitle.toLowerCase() || n.id.toLowerCase() === cleanTitle.toLowerCase());
          if (found) {
            selectNote(found);
            setViewMode('editor');
          }
        }}
        onRefreshNotes={fetchNotesAndFolders}
      />

      {/* Export Toast Notification */}
      {exportToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-card/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md flex items-center space-x-3 text-xs text-slate-200 animate-in fade-in slide-in-from-bottom-3 max-w-md">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-emerald-300 block">{exportToast.message}</span>
            {exportToast.filename && (
              <span className="text-[11px] text-slate-400 font-mono block truncate mt-0.5">
                📁 Salvo como: {exportToast.filename}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExportToast(null)}
            className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
