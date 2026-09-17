import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  LayoutGrid
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FrankNote, GraphData, DeletedNoteItem } from '../types';
import { api } from '../api';
import { InteractiveGraphCanvas } from './InteractiveGraphCanvas';
import { SmartDropzoneModal } from './SmartDropzoneModal';

interface FrankNoteViewProps {
  onMentionInChat?: (note: FrankNote) => void;
  onStudyTopic?: (topic: string) => void;
  onReturnToAgent?: () => void;
  targetNoteIdOrTitle?: string | null;
}

export const FrankNoteView: React.FC<FrankNoteViewProps> = ({
  onMentionInChat,
  onStudyTopic,
  onReturnToAgent,
  targetNoteIdOrTitle
}) => {
  const [notes, setNotes] = useState<FrankNote[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<{ [f: string]: boolean }>({});
  const [activeNote, setActiveNote] = useState<FrankNote | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'editor' | 'graph'>('editor');
  
  // Note View Mode: 'preview' (Default) vs 'edit'
  const [noteViewMode, setNoteViewMode] = useState<'preview' | 'edit'>('preview');

  // Sidebar Tab: 'folders' (Active Notes) vs 'trash' (Deleted Notes)
  const [sidebarTab, setSidebarTab] = useState<'folders' | 'trash'>('folders');
  const [deletedNotes, setDeletedNotes] = useState<DeletedNoteItem[]>([]);
  const [retentionPolicy, setRetentionPolicy] = useState<'30_days' | '90_days' | '120_days' | '1_year' | 'never'>('90_days');
  const [selectedDeletedNote, setSelectedDeletedNote] = useState<DeletedNoteItem | null>(null);
  const [isLoadingTrash, setIsLoadingTrash] = useState<boolean>(false);

  const [editContent, setEditContent] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editFolder, setEditFolder] = useState<string>('Geral');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Text Selection & Context Menu for Study Engine
  const [selectedText, setSelectedText] = useState<string>('');
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showFloatingAction, setShowFloatingAction] = useState<boolean>(false);
  const [floatingActionPos, setFloatingActionPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Window Resizing & Layout State (Obsidian / Notion style)
  const [sidebarWidth, setSidebarWidth] = useState<number>(330);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
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

  // Edit Mode Resizable Split
  const [editSplitRatio, setEditSplitRatio] = useState<number>(50); // percentage (default 50%)
  const [editSplitMode, setEditSplitMode] = useState<'both' | 'editor' | 'preview'>('both');
  const [isDraggingEditSplit, setIsDraggingEditSplit] = useState<boolean>(false);
  const editContainerRef = useRef<HTMLDivElement | null>(null);

  // Mouse Drag Handlers for Resizing
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingSidebar) {
      const newWidth = Math.min(Math.max(e.clientX, 220), 650);
      setSidebarWidth(newWidth);
    } else if (isDraggingEditSplit && editContainerRef.current) {
      const rect = editContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percentage = Math.min(Math.max((relativeX / rect.width) * 100, 20), 80);
      setEditSplitRatio(percentage);
    }
  }, [isDraggingSidebar, isDraggingEditSplit]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false);
    setIsDraggingEditSplit(false);
  }, []);

  useEffect(() => {
    if (isDraggingSidebar || isDraggingEditSplit) {
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
  }, [isDraggingSidebar, isDraggingEditSplit, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenuPos(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const fetchNotesAndFolders = async () => {
    try {
      const [notesList, foldersList] = await Promise.all([
        api.listNotes(),
        api.listFolders()
      ]);
      setNotes(notesList);
      setFolders(foldersList);
      if (notesList.length > 0 && !activeNote) {
        selectNote(notesList[0]);
      }
    } catch {
      // ignore
    }
  };

  const handleMoveNote = async (noteId: string, targetFolder: string) => {
    try {
      const updated = await api.moveNote(noteId, targetFolder);
      await fetchNotesAndFolders();
      if (activeNote?.id === noteId) {
        setActiveNote(updated);
        setEditFolder(updated.folder || updated.subject || targetFolder);
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
      setNoteViewMode('preview');
      setViewMode('editor');
      setSidebarTab('folders');
    }
  }, [targetNoteIdOrTitle, notes]);

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

  const selectNote = (note: FrankNote) => {
    setActiveNote(note);
    setEditTitle(note.title);
    setEditFolder(note.folder || note.subject || 'Geral');
    setEditContent(note.content);
    setNoteViewMode('preview'); // Always open in formatted preview first!
  };

  const handleCreateNoteInFolder = (folderName: string = 'Geral') => {
    const newNoteTemplate = {
      title: 'Nova Anotação ' + new Date().toLocaleDateString('pt-BR'),
      folder: folderName,
      subject: folderName,
      content: `# Nova Anotação\n\nEscreva suas notas aqui no formato Notion/Markdown.\n\nUse \`[[Nome de Outra Nota]]\` para criar conexões e #tags para categorizar.\n`,
      isProjectSpecific: false
    };

    api.saveNote(newNoteTemplate).then((created) => {
      fetchNotesAndFolders();
      setActiveNote(created);
      setEditTitle(created.title);
      setEditFolder(created.folder || folderName);
      setEditContent(created.content);
      setNoteViewMode('edit'); // Open new notes in edit mode
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
    setCollapsedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const handleReviewFolderWithAgent = (folderName: string) => {
    const folderNotes = notes.filter(n => (n.folder || n.subject || 'Geral') === folderName);
    if (folderNotes.length === 0) {
      alert(`A pasta "${folderName}" está vazia.`);
      return;
    }

    const payload = `Quero fazer uma revisão e aprimoramento visual completo de todas as anotações da pasta "${folderName}".

Aqui estão as notas atuais da pasta:

${folderNotes.map(n => `### [[${n.title}]] (Arquivo: ${n.filename})\n${n.content}`).join('\n\n---\n\n')}

Por favor, revise o conteúdo, organize com títulos hierárquicos, tabelas comparativas, diagramas Mermaid, callouts de destaque e checklists estruturados para deixar as anotações visualmente muito agradáveis, claras e profissionais. Salve as melhorias diretamente no FrankMD Vault usando a ferramenta frank_note_save.`;

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
    try {
      const updated = await api.saveNote({
        id: activeNote.id,
        title: editTitle,
        folder: editFolder,
        subject: editFolder,
        content: editContent,
        isProjectSpecific: activeNote.isProjectSpecific
      });
      setActiveNote(updated);
      setNoteViewMode('preview'); // Switch to preview after saving
      fetchNotesAndFolders();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id: string, isProjectSpecific?: boolean) => {
    if (!confirm('Deseja mover esta anotação para o backup de segurança e deletar?')) return;
    try {
      await api.deleteNote(id, isProjectSpecific);
      const remaining = notes.filter(n => n.id !== id);
      setNotes(remaining);
      if (remaining.length > 0) selectNote(remaining[0]);
      else setActiveNote(null);
    } catch (err: any) {
      alert(`Erro ao deletar: ${err.message}`);
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (folderName === 'Geral') {
      alert('A pasta padrão "Geral" não pode ser excluída.');
      return;
    }
    const folderNotes = notes.filter(n => {
      const f = n.folder || n.subject || 'Geral';
      return f === folderName || f.startsWith(`${folderName}/`);
    });
    
    const countMsg = folderNotes.length === 1 ? '1 nota' : `${folderNotes.length} notas`;
    const confirmMessage = `Tem certeza que deseja excluir toda a pasta "${folderName}" e todas as suas ${countMsg}?\n\n` +
      `🛡️ Todas as notas serão arquivadas no backup de segurança (.backups) do Obsidian antes da exclusão.`;

    if (!confirm(confirmMessage)) return;

    try {
      await api.deleteFolder(folderName);
      await fetchNotesAndFolders();
      if (viewMode === 'graph') {
        fetchGraph();
      }
      if (activeNote) {
        const activeNoteFolder = activeNote.folder || activeNote.subject || 'Geral';
        if (activeNoteFolder === folderName || activeNoteFolder.startsWith(`${folderName}/`)) {
          const remainingNotes = notes.filter(n => {
            const f = n.folder || n.subject || 'Geral';
            return f !== folderName && !f.startsWith(`${folderName}/`);
          });
          if (remainingNotes.length > 0) {
            selectNote(remainingNotes[0]);
          } else {
            setActiveNote(null);
          }
        }
      }
    } catch (err: any) {
      alert(`Erro ao excluir pasta: ${err.message}`);
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
      if (text && text.length >= 2) {
        setSelectedText(text);
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setFloatingActionPos({
            x: Math.min(Math.max(rect.left + rect.width / 2 - 130, 20), window.innerWidth - 320),
            y: Math.max(rect.top - 48, 12)
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
    ...folders,
    ...notes.map(n => n.folder || n.subject || 'Geral')
  ]));

  const filteredNotes = notes.filter(n => {
    const matchesQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = selectedFolderFilter === 'all' || (n.folder || n.subject || 'Geral') === selectedFolderFilter;
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
    const folderPath = note.folder || note.subject || 'Geral';
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

  const notebooksList = Array.from(notebooksMap.values()).map(nb => ({
    id: nb.id,
    subfolders: Array.from(nb.subfolders.values()),
    directNotes: nb.directNotes,
    allNotes: nb.allNotes,
    totalCount: nb.allNotes.length
  })).sort((a, b) => {
    if (a.id === 'Geral') return 1;
    if (b.id === 'Geral') return -1;
    return a.id.localeCompare(b.id);
  });

  const currentSelectedNotebook = selectedNotebookId === 'all' 
    ? null 
    : notebooksList.find(nb => nb.id === selectedNotebookId) || null;

  return (
    <div className="h-full flex flex-col bg-background text-slate-200 overflow-hidden select-none font-sans relative">
      {/* Floating Action Pill on Text Selection */}
      {showFloatingAction && selectedText && (
        <div
          style={{ left: `${floatingActionPos.x}px`, top: `${floatingActionPos.y}px` }}
          className="fixed z-50 bg-card/95 backdrop-blur-md border border-accent/60 shadow-2xl rounded-2xl p-1.5 flex items-center space-x-1.5 animate-in fade-in zoom-in-95"
        >
          <button
            onClick={() => {
              setShowFloatingAction(false);
              onStudyTopic?.(selectedText);
            }}
            className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
            title="Iniciar Roteiro de Estudo Ativo no Chat"
          >
            <GraduationCap className="w-3.5 h-3.5 text-accent-light" />
            <span>Estudar sobre "{selectedText.slice(0, 20)}{selectedText.length > 20 ? '...' : ''}"</span>
          </button>

          <button
            onClick={() => {
              setShowFloatingAction(false);
              if (activeNote) {
                onMentionInChat?.({
                  ...activeNote,
                  content: `Pergunta sobre o trecho "${selectedText}" na anotação [[${activeNote.title}]]:\n\n${activeNote.content}`
                });
              }
            }}
            className="p-1.5 rounded-xl hover:bg-card-border text-slate-300 hover:text-white transition-colors"
            title="Perguntar no Chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
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
            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-panel text-slate-300 hover:text-white flex items-center space-x-2 transition-all"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Criar Nota [[{selectedText.slice(0, 16)}]]</span>
          </button>
        </div>
      )}

      {/* Quick Move Note Modal */}
      {moveModalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none">
          <div className="bg-card border border-card-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
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
                      (moveModalNote.folder || moveModalNote.subject || 'Geral') === f
                        ? 'bg-accent/20 border-accent text-accent-light font-semibold'
                        : 'bg-panel border-card-border text-slate-300 hover:bg-card-border hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>{f}</span>
                    </div>
                    {(moveModalNote.folder || moveModalNote.subject || 'Geral') === f && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in select-none">
          <div className="bg-card border border-card-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
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

      {/* Top Bar Controls */}
      <div className="h-12 border-b border-card-border bg-sidebar px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
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

          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-white p-0.5 border border-card-border shadow-xs flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Tellus" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xs text-slate-100 font-mono">FrankMD Vault & Pastas</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full hidden sm:flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Obsidian Standard Compatible</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Notion Import Button */}
          <button
            onClick={() => setIsNotionModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card border border-card-border text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
            title="Importar notas exportadas do Notion (.md / .csv)"
          >
            <Download className="w-3.5 h-3.5 text-accent-light" />
            <span>Importar do Notion</span>
          </button>

          {/* Mode Switcher: Editor vs Graph */}
          <div className="flex items-center bg-card rounded-lg p-0.5 border border-card-border text-xs">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                viewMode === 'editor'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Notas ({notes.length})</span>
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
          {/* Notes & Folders Explorer Sidebar */}
          <div 
            style={{ width: isSidebarCollapsed || isNoteMaximized ? '0px' : `${sidebarWidth}px` }}
            className={`border-r border-card-border bg-sidebar flex flex-col shrink-0 overflow-hidden relative select-none transition-[width] duration-75 ${
              isSidebarCollapsed || isNoteMaximized ? 'w-0 border-r-0 invisible' : ''
            }`}
          >
            {/* Sidebar Navigation Tabs (Pastas vs Lixeira) */}
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
            </div>

            {/* Search & Actions Bar */}
            <div className="p-3 border-b border-card-border space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={sidebarTab === 'trash' ? "Pesquisar notas na lixeira..." : "Pesquisar por título, conteúdo ou #tags..."}
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
                    <div className="flex items-center space-x-2">
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

                  {/* Notebook Filter Pills / Tabs Bar */}
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

          {/* Floating Collapsed Sidebar Restore Button */}
          {(isSidebarCollapsed || isNoteMaximized) && (
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
                  {noteViewMode === 'edit' ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título da Anotação..."
                      className="font-bold text-base bg-transparent text-slate-100 focus:outline-none focus:border-b border-accent flex-1"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-5 h-5 text-accent-light shrink-0" />
                      <h2 className="font-bold text-base text-slate-100 truncate">{editTitle}</h2>
                    </div>
                  )}
                  
                  {/* Folder Breadcrumb & Switcher */}
                  <div className="flex items-center space-x-1.5 bg-panel border border-card-border px-2.5 py-1 rounded-xl shrink-0">
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {noteViewMode === 'edit' ? (
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
                    ) : (
                      <span className="text-xs text-amber-300 font-mono truncate max-w-[200px]" title={`Pasta: ${editFolder}`}>
                        {editFolder}
                      </span>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  {noteViewMode === 'preview' ? (
                    <>
                      <button
                        onClick={() => setNoteViewMode('edit')}
                        className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-accent/20"
                        title="Editar conteúdo da nota em Markdown"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Nota</span>
                      </button>

                      <button
                        onClick={() => setMoveModalNote(activeNote)}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 hover:text-amber-300 flex items-center space-x-1.5 transition-all"
                        title="Mover esta anotação para outra pasta"
                      >
                        <FolderInput className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mover</span>
                      </button>

                      <button
                        onClick={() => copyNoteContent(editContent, activeNote.id)}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 flex items-center space-x-1.5 transition-all"
                      >
                        {copiedId === activeNote.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Markdown</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteNote(activeNote.id, activeNote.isProjectSpecific)}
                        className="p-2 rounded-xl hover:bg-card-border text-slate-400 hover:text-rose-400 transition-colors"
                        title="Excluir anotação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Full Width Toggle */}
                      <button
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
                        title={isNoteMaximized ? "Restaurar tamanho normal" : "Maximizar nota (foco total na leitura)"}
                      >
                        {isNoteMaximized ? (
                          <Minimize2 className="w-4 h-4 text-accent-light" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Layout Mode Toggle for Editor */}
                      <div className="flex items-center bg-card rounded-xl p-0.5 border border-card-border text-[11px] shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditSplitMode('editor')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            editSplitMode === 'editor'
                              ? 'bg-accent text-white font-semibold shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Apenas Editor de Código Markdown"
                        >
                          Editor
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditSplitMode('both')}
                          className={`px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1 ${
                            editSplitMode === 'both'
                              ? 'bg-accent text-white font-semibold shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Dividir: Editor e Preview Lado a Lado"
                        >
                          <Columns className="w-3 h-3" />
                          <span>Split</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditSplitMode('preview')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            editSplitMode === 'preview'
                              ? 'bg-accent text-white font-semibold shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Apenas Pré-visualização Formatada"
                        >
                          Preview
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setEditContent(activeNote.content);
                          setEditTitle(activeNote.title);
                          setNoteViewMode('preview');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-all"
                      >
                        Cancelar
                      </button>

                      <button
                        onClick={() => setNoteViewMode('preview')}
                        className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
                        title="Ver visualização formatada"
                      >
                        <Eye className="w-3.5 h-3.5 text-accent-light" />
                        <span>Modo Leitura</span>
                      </button>

                      <button
                        onClick={handleSaveActiveNote}
                        disabled={isSaving}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-950/30"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Salvando...' : 'Salvar & Visualizar'}</span>
                      </button>

                      {/* Full Width Toggle in Edit Mode */}
                      <button
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

                      {/* Maximize / Restore in Edit Mode */}
                      <button
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
                        title={isNoteMaximized ? "Restaurar tamanho normal" : "Maximizar tela de edição"}
                      >
                        {isNoteMaximized ? (
                          <Minimize2 className="w-4 h-4 text-accent-light" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* DOCUMENT BODY */}
              {noteViewMode === 'preview' ? (
                /* 1. FORMATTED PREVIEW VIEW (DEFAULT) */
                <div 
                  className="flex-1 overflow-y-auto bg-[#0a0c12] p-8 scrollbar-thin scrollbar-thumb-card-border select-text"
                  onMouseUp={handleTextSelection}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={() => setNoteViewMode('edit')}
                  title="Dê duplo clique para editar esta anotação"
                >
                  <div className={`space-y-6 ${isFullWidth ? 'w-full max-w-none' : 'max-w-4xl mx-auto'}`}>
                    {/* Top banner info */}
                    <div className="flex items-center justify-between pb-4 border-b border-card-border/60 text-xs text-slate-400 font-mono">
                      <span className="flex items-center space-x-1.5">
                        <Folder className="w-3.5 h-3.5 text-amber-400" />
                        <span>Caminho: <strong>{activeNote.relativePath || `${editFolder}/${activeNote.filename}`}</strong></span>
                      </span>
                      <button
                        onClick={() => setNoteViewMode('edit')}
                        className="text-[11px] text-accent-light hover:underline flex items-center space-x-1 font-sans"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Clique ou dê duplo-clique para editar</span>
                      </button>
                    </div>

                    {/* Rendered Markdown Document */}
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed select-text space-y-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editContent}
                      </ReactMarkdown>
                    </div>

                    {/* Backlinks Section */}
                    {activeNote.backlinks && activeNote.backlinks.length > 0 && (
                      <div className="mt-12 pt-6 border-t border-card-border">
                        <div className="flex items-center space-x-2 text-xs font-bold text-accent-light mb-3">
                          <LinkIcon className="w-4 h-4" />
                          <span>Notas que mencionam esta ({activeNote.backlinks.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeNote.backlinks.map(b => (
                            <span key={b} className="px-3 py-1 rounded-xl bg-accent/15 border border-accent/30 text-xs text-slate-200 font-medium">
                              [[{b}]]
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 2. SPLIT-SCREEN EDIT MODE */
                <div 
                  ref={editContainerRef}
                  className="flex-1 flex overflow-hidden select-text relative"
                  onMouseUp={handleTextSelection}
                  onContextMenu={handleContextMenu}
                >
                  {/* Editor Column */}
                  {(editSplitMode === 'both' || editSplitMode === 'editor') && (
                    <div 
                      style={{ width: editSplitMode === 'editor' ? '100%' : `${editSplitRatio}%` }}
                      className="border-r border-card-border p-6 flex flex-col bg-[#08090e] shrink-0 overflow-hidden"
                    >
                      <div className="flex items-center justify-between text-[11px] uppercase font-bold text-slate-500 mb-3 font-mono">
                        <span>Editor Markdown (suporta [[Wikilinks]] e #tags)</span>
                        <span className="text-emerald-400">● Protegido por Backup</span>
                      </div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onMouseUp={handleTextSelection}
                        onContextMenu={handleContextMenu}
                        placeholder="Escreva seu documento com formatação Markdown, tabelas, código e [[Conexões]]..."
                        className="flex-1 w-full bg-transparent text-xs text-slate-200 font-mono resize-none focus:outline-none leading-relaxed select-text"
                      />
                    </div>
                  )}

                  {/* Resizable Splitter between Editor and Preview */}
                  {editSplitMode === 'both' && (
                    <div
                      onMouseDown={() => setIsDraggingEditSplit(true)}
                      className={`w-1.5 cursor-col-resize hover:bg-accent transition-colors z-20 flex items-center justify-center shrink-0 ${
                        isDraggingEditSplit ? 'bg-accent shadow-sm' : 'bg-transparent hover:bg-accent/40'
                      }`}
                      title="Arraste para redimensionar Editor e Pré-visualização"
                    >
                      <div className="w-0.5 h-6 rounded-full bg-slate-700/60" />
                    </div>
                  )}

                  {/* Live Preview Column */}
                  {(editSplitMode === 'both' || editSplitMode === 'preview') && (
                    <div 
                      className="flex-1 p-8 overflow-y-auto bg-[#0a0c12] scrollbar-thin scrollbar-thumb-card-border select-text"
                      onMouseUp={handleTextSelection}
                      onContextMenu={handleContextMenu}
                    >
                      <div className={`space-y-6 ${isFullWidth ? 'w-full max-w-none' : 'max-w-3xl mx-auto'}`}>
                        <span className="text-[11px] uppercase font-bold text-slate-500 block font-mono">
                          Pré-visualização em Tempo Real
                        </span>

                        <div className="prose prose-invert max-w-none text-xs leading-relaxed select-text">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {editContent}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                                <span><strong>{dashboardNotes.length}</strong> anotações</span>
                              </span>
                              <span className="px-2.5 py-1 rounded-xl bg-panel border border-card-border text-slate-300 flex items-center space-x-1.5">
                                <Folder className="w-3.5 h-3.5 text-amber-400" />
                                <span><strong>{subfoldersList.length}</strong> subpastas</span>
                              </span>
                              <span className="px-2.5 py-1 rounded-xl bg-panel border border-card-border text-slate-400 flex items-center space-x-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>FrankMD Vault Conectado</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions Row */}
                        <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
                          <button
                            onClick={() => handleCreateNoteInFolder(isAll ? 'Geral' : currentNb?.id || 'Geral')}
                            className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center space-x-2 transition-all shadow-md shadow-accent/20 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ Nova Anotação</span>
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

                    {/* Cadernos Temáticos Grid (When in 'all' view) */}
                    {isAll && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center space-x-2">
                            <Book className="w-3.5 h-3.5 text-accent-light" />
                            <span>Cadernos Temáticos ({notebooksList.length})</span>
                          </h2>
                          <button
                            onClick={() => setIsCreatingNotebook(true)}
                            className="text-xs text-cyan-400 hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Novo Caderno</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                          {notebooksList.map(nb => {
                            const nbDet = getNotebookDetails(nb.id);
                            const IconComp = nbDet.icon;
                            return (
                              <div
                                key={nb.id}
                                onClick={() => setSelectedNotebookId(nb.id)}
                                className={`p-4 rounded-2xl border ${nbDet.bg} hover:border-accent/60 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md flex flex-col justify-between group`}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-xl ${nbDet.badgeBg}`}>
                                      <IconComp className={`w-4 h-4 ${nbDet.color}`} />
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-panel border border-card-border text-slate-400">
                                      {nb.subfolders.length} subpastas
                                    </span>
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-accent-light transition-colors truncate">
                                      {nb.id}
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                      {nb.totalCount} anotaç{nb.totalCount === 1 ? 'ão' : 'ões'}
                                    </p>
                                  </div>
                                </div>
                                <div className="pt-3 mt-2 border-t border-card-border/60 flex items-center justify-between text-[11px] text-accent-light font-semibold">
                                  <span>Abrir Caderno</span>
                                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
                              className="p-3 rounded-2xl bg-card/70 border border-card-border/80 hover:border-amber-500/50 hover:bg-card cursor-pointer transition-all duration-200 flex items-center justify-between group"
                            >
                              <div className="flex items-center space-x-2.5 truncate">
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                                  <Folder className="w-4 h-4" />
                                </div>
                                <div className="truncate">
                                  <span className="font-bold text-xs text-slate-200 group-hover:text-amber-300 transition-colors block truncate" title={sub.path}>
                                    {sub.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    {sub.notes.length} anotaç{sub.notes.length === 1 ? 'ão' : 'ões'}
                                  </span>
                                </div>
                              </div>
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
                            const folderName = n.folder || n.subject || 'Geral';
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
                                  setNoteViewMode('preview'); // Open formatted version first
                                }}
                                className="p-4 rounded-2xl border border-card-border/80 bg-card/60 hover:bg-card hover:border-accent/50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md flex flex-col justify-between space-y-3 group"
                              >
                                <div className="space-y-2">
                                  {/* Folder Badge + Date */}
                                  <div className="flex items-center justify-between text-[10px] font-mono">
                                    <span className={`px-2 py-0.5 rounded-md font-semibold truncate max-w-[170px] ${nbDet.badgeBg}`} title={folderName}>
                                      📂 {folderName}
                                    </span>
                                    <span className="text-slate-500">
                                      {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('pt-BR') : ''}
                                    </span>
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
        onClose={() => setIsDropzoneOpen(false)}
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
    </div>
  );
};
