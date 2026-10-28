import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Grid,
  AlignJustify,
  MoreHorizontal,
  Square,
  ArrowUpRight,
  Minus,
  Hand,
  Check,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';
import { InkPoint, InkStroke, NoteInkData } from '../types';
import { api } from '../api';

interface NoteInkCanvasProps {
  noteId: string;
  mode: 'hybrid' | 'canvas_only';
  inkEditable?: boolean;
  onToggleInkEditable?: () => void;
  onInkMetadataChange?: (hasInk: boolean, strokeCount: number) => void;
  minHeight?: number;
}

const INK_COLORS = [
  { id: 'cyan', label: 'Ciano Tellus', value: '#22d3ee' },
  { id: 'yellow', label: 'Amarelo Destaque', value: '#facc15' },
  { id: 'emerald', label: 'Verde Esmeralda', value: '#34d399' },
  { id: 'rose', label: 'Rosa / Vermelho', value: '#fb7185' },
  { id: 'violet', label: 'Roxo / Violeta', value: '#a78bfa' },
  { id: 'amber', label: 'Laranja', value: '#fb923c' },
  { id: 'white', label: 'Branco', value: '#f8fafc' },
  { id: 'dark', label: 'Grafite Escuro', value: '#1e293b' }
];

export const NoteInkCanvas: React.FC<NoteInkCanvasProps> = ({
  noteId,
  mode,
  inkEditable = true,
  onToggleInkEditable,
  onInkMetadataChange,
  minHeight = 900
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [redoStack, setRedoStack] = useState<InkStroke[][]>([]);
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'eraser'>('pen');
  const [activeColor, setActiveColor] = useState<string>('#22d3ee');
  const [strokeWidth, setStrokeWidth] = useState<number>(3.5);
  const [isInkToolbarExpanded, setIsInkToolbarExpanded] = useState<boolean>(true);
  const [isInkOptionsOpen, setIsInkOptionsOpen] = useState<boolean>(false);
  const [backgroundPattern, setBackgroundPattern] = useState<'none' | 'ruled' | 'grid' | 'dots'>(
    mode === 'canvas_only' ? 'dots' : 'none'
  );
  const [canvasHeight, setCanvasHeight] = useState<number>(minHeight);
  const [penOnlyPalmRejection, setPenOnlyPalmRejection] = useState<boolean>(false);
  const [showInkLayer, setShowInkLayer] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastPointerType, setLastPointerType] = useState<string>('mouse');

  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<InkPoint[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Ink Data for current note + Live Co-Editing Auto-Merge Poll (every 3.5s)
  useEffect(() => {
    let cancelled = false;
    const loadOrMergeInk = (isInitial: boolean) => {
      if (!isInitial && isDrawingRef.current) return;
      api.getNoteInk(noteId)
        .then((data: NoteInkData) => {
          if (cancelled || (!isInitial && isDrawingRef.current)) return;
          const incomingStrokes = Array.isArray(data.strokes) ? data.strokes : [];

          if (isInitial) {
            setStrokes(incomingStrokes);
            setRedoStack([]);
            if (data.canvasHeight && data.canvasHeight >= 600) {
              setCanvasHeight(data.canvasHeight);
            } else {
              setCanvasHeight(minHeight);
            }
            if (data.backgroundPattern) {
              setBackgroundPattern(data.backgroundPattern);
            }
            onInkMetadataChange?.(incomingStrokes.length > 0, incomingStrokes.length);
          } else {
            // Merge incoming strokes from 2nd device by unique stroke.id
            setStrokes((prev) => {
              const map = new Map<string, InkStroke>();
              for (const s of prev) {
                if (s && s.id) map.set(s.id, s);
              }
              let addedAny = false;
              for (const s of incomingStrokes) {
                if (s && s.id && !map.has(s.id)) {
                  map.set(s.id, s);
                  addedAny = true;
                }
              }
              if (!addedAny && incomingStrokes.length === prev.length) {
                return prev;
              }
              const merged = Array.from(map.values()).sort(
                (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
              );
              onInkMetadataChange?.(merged.length > 0, merged.length);
              return merged;
            });
          }
        })
        .catch(() => {});
    };

    loadOrMergeInk(true);
    const interval = setInterval(() => loadOrMergeInk(false), 3500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [noteId]);

  const persistInkData = useCallback(
    (nextStrokes: InkStroke[], nextHeight = canvasHeight, nextPattern = backgroundPattern) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setIsSaving(true);
      onInkMetadataChange?.(nextStrokes.length > 0, nextStrokes.length);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await api.saveNoteInk(noteId, {
            strokes: nextStrokes,
            canvasHeight: nextHeight,
            backgroundPattern: nextPattern,
            overlayMode: mode
          });
        } catch (err) {
          console.error('[NoteInkCanvas] Falha ao salvar camada Ink:', err);
        } finally {
          setIsSaving(false);
        }
      }, 350);
    },
    [noteId, canvasHeight, backgroundPattern, mode, onInkMetadataChange]
  );

  const drawSingleStroke = (ctx: CanvasRenderingContext2D, stroke: InkStroke) => {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.34 : stroke.opacity ?? 1;

    if (stroke.tool === 'line' || stroke.tool === 'arrow') {
      const start = pts[0];
      const end = pts[pts.length - 1];
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      if (stroke.tool === 'arrow') {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = Math.max(10, stroke.width * 3.5);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle - Math.PI / 6),
          end.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle + Math.PI / 6),
          end.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (stroke.tool === 'rect') {
      const start = pts[0];
      const end = pts[pts.length - 1];
      ctx.lineWidth = stroke.width;
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.restore();
      return;
    }

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Smooth quadratic curve with pressure sensitivity for stylus pen
    if (stroke.tool === 'highlighter') {
      ctx.lineWidth = stroke.width * 3.2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    } else {
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const pressure = p1.pressure !== undefined && p1.pressure > 0 ? p1.pressure : 0.5;
        const dynamicWidth = Math.max(1, stroke.width * (0.55 + pressure * 0.9));
        ctx.lineWidth = dynamicWidth;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth || 800;
    const height = Math.max(canvasHeight, minHeight);

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Draw background pattern when in canvas_only mode or if pattern explicitly selected
    if (mode === 'canvas_only' || backgroundPattern !== 'none') {
      if (backgroundPattern === 'ruled') {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.lineWidth = 1;
        for (let y = 36; y < height; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (backgroundPattern === 'grid') {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 28) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (backgroundPattern === 'dots') {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
        for (let x = 24; x < width; x += 26) {
          for (let y = 24; y < height; y += 26) {
            ctx.beginPath();
            ctx.arc(x, y, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    if (showInkLayer) {
      for (const s of strokes) {
        drawSingleStroke(ctx, s);
      }

      if (isDrawingRef.current && currentPointsRef.current.length > 0 && activeTool !== 'eraser') {
        drawSingleStroke(ctx, {
          id: 'preview',
          tool: activeTool,
          color: activeColor,
          width: strokeWidth,
          opacity: activeTool === 'highlighter' ? 0.34 : 1,
          points: currentPointsRef.current,
          createdAt: Date.now()
        });
      }
    }

    ctx.restore();
  }, [strokes, canvasHeight, minHeight, backgroundPattern, mode, showInkLayer, activeTool, activeColor, strokeWidth]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  const getRelativePoint = (e: React.PointerEvent<HTMLCanvasElement>): InkPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * 10) / 10,
      y: Math.round((e.clientY - rect.top) * 10) / 10,
      pressure: e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5,
      t: Date.now()
    };
  };

  const eraseStrokeAtPoint = (pt: InkPoint) => {
    const hitRadius = Math.max(14, strokeWidth * 3);
    const remaining = strokes.filter(stroke => {
      return !stroke.points.some(p => {
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
      });
    });
    if (remaining.length !== strokes.length) {
      setRedoStack(prev => [...prev, strokes]);
      setStrokes(remaining);
      persistInkData(remaining);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!inkEditable) return;
    setLastPointerType(e.pointerType);

    // Palm Rejection: if penOnly is enabled, ignore touch pointers so resting palm doesn't draw
    if (penOnlyPalmRejection && e.pointerType === 'touch') {
      return;
    }

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pt = getRelativePoint(e);
    isDrawingRef.current = true;

    if (activeTool === 'eraser') {
      eraseStrokeAtPoint(pt);
      return;
    }

    currentPointsRef.current = [pt];
    renderCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !inkEditable) return;
    if (penOnlyPalmRejection && e.pointerType === 'touch') return;

    const pt = getRelativePoint(e);

    if (activeTool === 'eraser') {
      eraseStrokeAtPoint(pt);
      return;
    }

    if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'rect') {
      currentPointsRef.current = [currentPointsRef.current[0], pt];
    } else {
      currentPointsRef.current.push(pt);
    }
    renderCanvas();
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (activeTool === 'eraser') return;

    const pts = currentPointsRef.current;
    currentPointsRef.current = [];
    if (pts.length === 0) return;

    const newStroke: InkStroke = {
      id: `ink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tool: activeTool,
      color: activeColor,
      width: strokeWidth,
      opacity: activeTool === 'highlighter' ? 0.34 : 1,
      points: pts,
      createdAt: Date.now()
    };

    const nextStrokes = [...strokes, newStroke];
    setRedoStack([]);
    setStrokes(nextStrokes);
    persistInkData(nextStrokes);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const nextStrokes = strokes.slice(0, -1);
    setRedoStack(prev => [...prev, strokes]);
    setStrokes(nextStrokes);
    persistInkData(nextStrokes);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const previousState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setStrokes(previousState);
    persistInkData(previousState);
  };

  const handleClearAll = () => {
    if (strokes.length === 0) return;
    if (!window.confirm('Deseja limpar todos os traços de caneta (Ink) desta nota? O texto .md permanecerá intacto.')) {
      return;
    }
    setRedoStack(prev => [...prev, strokes]);
    setStrokes([]);
    persistInkData([]);
  };

  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${noteId}-ink.png`;
    a.click();
  };

  return (
    <div
      ref={containerRef}
      className={
        mode === 'hybrid'
          ? 'absolute inset-0 z-20 pointer-events-none'
          : 'relative w-full bg-background/90 rounded-2xl border border-card-border/80 overflow-hidden shadow-inner'
      }
      style={{ minHeight: `${ Math.max(canvasHeight, minHeight) }px` }}
    >
      {/* Goodnotes-Style Expandable Ink Toolbar */}
      <div className="sticky top-2 z-30 flex flex-col items-center pointer-events-none px-2 pt-1.5">
        {!isInkToolbarExpanded ? (
          /* Collapsed Pill: Click to Expand Ink Tools (Goodnotes Pen Toggle) */
          <button
            type="button"
            onClick={() => setIsInkToolbarExpanded(true)}
            className="pointer-events-auto flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-card/95 hover:bg-card border border-card-border shadow-lg text-xs text-slate-200 hover:text-white transition-all cursor-pointer"
            title="Clique para abrir a barra de ferramentas da Caneta Ink (Goodnotes Style)"
          >
            <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white">
              <PenTool className="w-3 h-3" />
            </span>
            <span className="font-medium">Caneta Ink</span>
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/40"
              style={{ backgroundColor: activeColor }}
            />
            <span className="text-[10px] text-slate-400 font-mono">({strokes.length})</span>
          </button>
        ) : (
          /* Expanded Goodnotes Single-Row Contextual Tool Strip */
          <div className="pointer-events-auto relative flex flex-wrap items-center justify-between gap-3 px-4 py-1.5 rounded-full bg-card/95 backdrop-blur-md border border-card-border/90 shadow-xl max-w-full">
            {/* Left: Undo / Redo (Goodnotes Layout) */}
            <div className="flex items-center space-x-0.5 pr-2 border-r border-card-border/70">
              <button
                type="button"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 hover:bg-panel transition-colors cursor-pointer"
                title="Desfazer traço"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 hover:bg-panel transition-colors cursor-pointer"
                title="Refazer traço"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Center: Goodnotes Icon-Only Tool Dock (Circular Active Pill) */}
            <div className="flex items-center space-x-1">
              {mode === 'hybrid' && onToggleInkEditable && (
                <button
                  type="button"
                  onClick={onToggleInkEditable}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center space-x-1 transition-all mr-1 cursor-pointer ${
                    inkEditable
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-panel text-slate-400 hover:text-white'
                  }`}
                  title={inkEditable ? 'Caneta Ativa sobre o texto (Clique para rolar/editar texto)' : 'Modo Texto (Clique para ativar Caneta)'}
                >
                  <PenTool className="w-3 h-3" />
                  <span>{inkEditable ? 'Desenhar' : 'Texto'}</span>
                </button>
              )}

              {[
                { id: 'pen' as const, icon: PenTool, title: 'Caneta Stylus' },
                { id: 'eraser' as const, icon: Eraser, title: 'Borracha de Traços' },
                { id: 'highlighter' as const, icon: Highlighter, title: 'Marca-Texto' },
                { id: 'line' as const, icon: Minus, title: 'Linha Reta / Sublinhado' },
                { id: 'arrow' as const, icon: ArrowUpRight, title: 'Seta' },
                { id: 'rect' as const, icon: Square, title: 'Caixa / Forma' },
              ].map((t) => {
                const IconComp = t.icon;
                const isActive = activeTool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTool(t.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-accent/20 text-accent-light ring-1 ring-accent/50 shadow-xs'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-panel/80'
                    }`}
                    title={t.title}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
            </div>

            {/* Right: Goodnotes 3 Stroke-Thickness Slots + Quick Color Dots + Overflow Menu + Collapse */}
            <div className="flex items-center space-x-2.5 pl-2 border-l border-card-border/70">
              {/* 3 Stroke Thickness Slots (Goodnotes style) */}
              <div className="flex items-center space-x-1 bg-panel/80 px-1.5 py-0.5 rounded-full border border-card-border/60">
                {[
                  { w: 2, hClass: 'h-[1.5px]' },
                  { w: 4, hClass: 'h-[3px]' },
                  { w: 8, hClass: 'h-[5px]' },
                ].map((slot) => (
                  <button
                    key={slot.w}
                    type="button"
                    onClick={() => setStrokeWidth(slot.w)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      strokeWidth === slot.w
                        ? 'bg-card text-white ring-1 ring-accent/50'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title={`Espessura ${slot.w}px`}
                  >
                    <span className={`w-3.5 rounded-full bg-current ${slot.hClass}`} />
                  </button>
                ))}
              </div>

              {/* Color Dots */}
              <div className="flex items-center space-x-1.5">
                {INK_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveColor(c.value)}
                    className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                      activeColor === c.value
                        ? 'scale-125 ring-2 ring-white shadow-xs'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>

              {/* Goodnotes Paper & Options Popover Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsInkOptionsOpen(!isInkOptionsOpen)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isInkOptionsOpen ? 'bg-panel text-white' : 'text-slate-400 hover:text-white hover:bg-panel'
                  }`}
                  title="Opções da Folha, Rejeição de Palma e Exportação"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {isInkOptionsOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-card border border-card-border shadow-2xl p-2.5 space-y-2 z-50 text-xs animate-in fade-in">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                      Papel & Folha Ink
                    </div>
                    <div className="grid grid-cols-4 gap-1 bg-panel p-1 rounded-xl border border-card-border/60">
                      {[
                        { id: 'none' as const, label: 'Limpo' },
                        { id: 'dots' as const, label: 'Pontos' },
                        { id: 'ruled' as const, label: 'Linhas' },
                        { id: 'grid' as const, label: 'Grade' },
                      ].map((pat) => (
                        <button
                          key={pat.id}
                          type="button"
                          onClick={() => {
                            setBackgroundPattern(pat.id);
                            persistInkData(strokes, canvasHeight, pat.id);
                          }}
                          className={`py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                            backgroundPattern === pat.id
                              ? 'bg-accent text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {pat.label}
                        </button>
                      ))}
                    </div>

                    {/* Extra Colors */}
                    <div className="flex items-center justify-between px-1 pt-1">
                      <span className="text-[11px] text-slate-400">Todas as cores:</span>
                      <div className="flex items-center gap-1">
                        {INK_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setActiveColor(c.value)}
                            className={`w-3.5 h-3.5 rounded-full ${
                              activeColor === c.value ? 'ring-2 ring-white' : 'opacity-75'
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Palm Rejection */}
                    <button
                      type="button"
                      onClick={() => setPenOnlyPalmRejection(!penOnlyPalmRejection)}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-panel flex items-center justify-between text-slate-300 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Hand className="w-3.5 h-3.5 text-slate-400" />
                        <span>Rejeição de Palma</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel border border-card-border">
                        {penOnlyPalmRejection ? 'Só Caneta' : 'Caneta+Toque'}
                      </span>
                    </button>

                    {/* Show/Hide Ink Layer */}
                    <button
                      type="button"
                      onClick={() => setShowInkLayer(!showInkLayer)}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-panel flex items-center justify-between text-slate-300 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        {showInkLayer ? <Eye className="w-3.5 h-3.5 text-slate-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                        <span>Camada de Traços</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {showInkLayer ? 'Visível' : 'Oculta'}
                      </span>
                    </button>

                    {/* Export PNG & Clear */}
                    <div className="pt-1 border-t border-card-border flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsInkOptionsOpen(false);
                          handleExportPng();
                        }}
                        className="flex-1 px-2 py-1.5 rounded-xl bg-panel hover:bg-card-border text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsInkOptionsOpen(false);
                          handleClearAll();
                        }}
                        disabled={strokes.length === 0}
                        className="flex-1 px-2 py-1.5 rounded-xl bg-panel hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Limpar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapse Goodnotes Ink Bar Button */}
              <button
                type="button"
                onClick={() => setIsInkToolbarExpanded(false)}
                className="w-7 h-7 rounded-full bg-accent/15 hover:bg-accent/25 text-accent-light flex items-center justify-center transition-colors cursor-pointer"
                title="Recolher barra de caneta para visualização limpa"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive HTML5 Vector Ink Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        style={{
          touchAction: inkEditable ? 'none' : 'auto',
          cursor: inkEditable
            ? activeTool === 'eraser'
              ? 'cell'
              : 'crosshair'
            : 'default'
        }}
        className={`block w-full ${inkEditable ? 'pointer-events-auto' : 'pointer-events-none'}`}
      />

      {/* Expand Canvas Height Button at Bottom */}
      {inkEditable && (
        <div className="sticky bottom-3 z-30 flex justify-center pointer-events-auto mt-2 pb-2">
          <button
            type="button"
            onClick={() => {
              const nextH = canvasHeight + 600;
              setCanvasHeight(nextH);
              persistInkData(strokes, nextH, backgroundPattern);
            }}
            className="px-3 py-1.5 rounded-full bg-card/90 hover:bg-card border border-brand-cyan/30 text-brand-cyan text-xs font-medium flex items-center space-x-1.5 shadow-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Expandir Folha de Anotação (+600px)</span>
          </button>
        </div>
      )}
    </div>
  );
};
