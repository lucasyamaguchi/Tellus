import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Network, 
  Search, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Layers, 
  Sparkles, 
  BookOpen, 
  FolderGit2, 
  Cpu, 
  FileText, 
  Sliders, 
  Info,
  CheckCircle2,
  X
} from 'lucide-react';
import { GraphData, GraphNode, GraphLink } from '../types';
import { api } from '../api';

export type GraphViewType = 'notes' | 'skills' | 'projects';

interface InteractiveGraphCanvasProps {
  initialType?: GraphViewType;
  onOpenNote?: (noteIdOrTitle: string) => void;
  onOpenSkill?: (skillId: string) => void;
  onSwitchProject?: (projectPath: string) => void;
  onClose?: () => void;
  embeddedMode?: boolean;
}

export const InteractiveGraphCanvas: React.FC<InteractiveGraphCanvasProps> = ({
  initialType = 'notes',
  onOpenNote,
  onOpenSkill,
  onSwitchProject,
  onClose,
  embeddedMode = false
}) => {
  const [activeTab, setActiveTab] = useState<GraphViewType>(initialType);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [chargeStrength, setChargeStrength] = useState<number>(300);

  // Filters state
  const [showSubNodes1, setShowSubNodes1] = useState<boolean>(true); // folders / categories / modules
  const [showSubNodes2, setShowSubNodes2] = useState<boolean>(true); // tags / agents / memories
  const [showLinks, setShowLinks] = useState<boolean>(true);         // wikilinks / synergies / routines

  const [hoveredNode, setHoveredNode] = useState<{
    id: string;
    label: string;
    type: string;
    connections: number;
    details?: string;
  } | null>(null);

  const [selectedNodeDetails, setSelectedNodeDetails] = useState<GraphNode | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Load Graph Data based on active tab
  const loadGraph = useCallback(async (tab: GraphViewType) => {
    setIsLoading(true);
    setGraphData(null);
    setHoveredNode(null);
    try {
      let data: GraphData;
      if (tab === 'notes') {
        data = await api.getNotesGraph();
      } else if (tab === 'skills') {
        data = await api.getSkillsGraph();
      } else {
        data = await api.getProjectsGraph();
      }
      setGraphData(data);
    } catch (err) {
      console.error('[InteractiveGraph] Failed to fetch graph data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph(activeTab);
  }, [activeTab, loadGraph]);

  // Canvas Physics & Interaction Engine
  useEffect(() => {
    if (!canvasRef.current || !graphData || isLoading) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Filter nodes based on user search & toggles
    const filteredRawNodes = graphData.nodes.filter(n => {
      if (activeTab === 'notes') {
        if (n.type === 'subject' && !showSubNodes1) return false;
        if (n.type === 'tag' && !showSubNodes2) return false;
      } else if (activeTab === 'skills') {
        if (n.type === 'category' && !showSubNodes1) return false;
        if (n.type === 'agent' && !showSubNodes2) return false;
      } else if (activeTab === 'projects') {
        if (n.type === 'module' && !showSubNodes1) return false;
        if ((n.type === 'memory' || n.type === 'routine') && !showSubNodes2) return false;
      }
      if (searchFilter.trim() && !n.label.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      return true;
    });

    const nodeIds = new Set(filteredRawNodes.map(n => n.id));

    const filteredRawLinks = graphData.links.filter(l => {
      if (!showLinks) return false;
      return nodeIds.has(l.source) && nodeIds.has(l.target);
    });

    // Resize high-DPI canvas
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };
    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      ticks = 0; // awaken simulation on container resize
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    } else {
      resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', resizeCanvas);

    const initialRect = canvas.getBoundingClientRect();
    const cssInitW = Math.max(1, initialRect.width || 600);
    const cssInitH = Math.max(1, initialRect.height || 400);
    const initialCenterX = cssInitW / 2;
    const initialCenterY = cssInitH / 2;
    const spreadRadius = Math.min(cssInitW, cssInitH) * 0.35;

    interface SimNode {
      id: string;
      label: string;
      type: string;
      val: number;
      color: string;
      details?: string;
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

    // Initialize Sim Nodes with distributed circular positions
    const simNodes: SimNode[] = filteredRawNodes.map((n, i) => {
      const angle = (i / Math.max(filteredRawNodes.length, 1)) * 2 * Math.PI;
      const dist = Math.min(spreadRadius, 30 + (i % 4) * 25);
      
      let radius = 9;
      if (n.type === 'note') radius = Math.max(7, Math.min(22, 6 + (n.val / 3)));
      else if (n.type === 'project') radius = 22;
      else if (n.type === 'category' || n.type === 'agent') radius = 16;
      else if (n.type === 'skill') radius = 11;
      else if (n.type === 'subject') radius = 14;

      return {
        id: n.id,
        label: n.label,
        type: n.type,
        val: n.val,
        color: n.color || '#38bdf8',
        details: n.details,
        x: initialCenterX + Math.cos(angle) * dist,
        y: initialCenterY + Math.sin(angle) * dist,
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

    // Pan & Zoom Transform State
    let zoom = 1;
    let panX = 0;
    let panY = 0;

    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let draggedNode: SimNode | null = null;
    let activeHoverNode: SimNode | null = null;

    // Simulation loop
    let ticks = 0;
    const maxTicks = 450;

    const simulate = () => {
      if (ticks > maxTicks) return;
      ticks++;

      // Calibrated, stable force constants
      const kRepulsion = chargeStrength * 5;
      const kAttraction = 0.035;
      const damping = 0.85;
      const maxSpeed = 6;

      // 1. Repulsion between all node pairs with distance clamp
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          // Clamp minimum distance to prevent singularity / explosive repulsion
          const distSq = Math.max(dx * dx + dy * dy, 900);
          const dist = Math.sqrt(distSq);

          if (dist < 450) {
            // Soft-capped repulsive force
            const force = Math.min(kRepulsion / distSq, 10);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!n1.isPinned) { n1.vx -= fx; n1.vy -= fy; }
            if (!n2.isPinned) { n2.vx += fx; n2.vy += fy; }
          }
        }
      }

      // 2. Spring Attraction along links
      for (const link of simLinks) {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = 70;
        const displacement = dist - targetDist;
        const force = Math.min(Math.max(displacement * kAttraction, -15), 15);

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!link.source.isPinned) { link.source.vx += fx; link.source.vy += fy; }
        if (!link.target.isPinned) { link.target.vx -= fx; link.target.vy -= fy; }
      }

      // 3. Centering Gravitational Pull & Soft Boundary Constraints
      const bRect = canvas.getBoundingClientRect();
      const cssW = Math.max(1, bRect.width);
      const cssH = Math.max(1, bRect.height);
      const curCenterX = cssW / 2;
      const curCenterY = cssH / 2;

      for (const node of simNodes) {
        if (!node.isPinned) {
          const dx = curCenterX - node.x;
          const dy = curCenterY - node.y;
          node.vx += dx * 0.012;
          node.vy += dy * 0.012;

          // Clamp velocity (Speed limit)
          const speed = Math.hypot(node.vx, node.vy);
          if (speed > maxSpeed) {
            node.vx = (node.vx / speed) * maxSpeed;
            node.vy = (node.vy / speed) * maxSpeed;
          }

          node.vx *= damping;
          node.vy *= damping;
          node.x += node.vx;
          node.y += node.vy;

          // Soft boundary constraints to keep nodes inside visible canvas
          const pad = node.radius + 15;
          if (node.x < pad) { node.x = pad; node.vx *= -0.2; }
          if (node.x > cssW - pad) { node.x = cssW - pad; node.vx *= -0.2; }
          if (node.y < pad) { node.y = pad; node.vy *= -0.2; }
          if (node.y > cssH - pad) { node.y = cssH - pad; node.vy *= -0.2; }
        }
      }
    };

    // Render loop
    const render = () => {
      if (!isRunning) return;

      simulate();

      const bRect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.max(1, bRect.width);
      const cssH = Math.max(1, bRect.height);
      const targetW = Math.round(cssW * dpr);
      const targetH = Math.round(cssH * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const curCenterX = cssW / 2;
      const curCenterY = cssH / 2;

      // Deterministic HiDPI scaling & clean canvas
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      ctx.save();
      // Apply Pan & Zoom around center
      ctx.translate(panX + curCenterX, panY + curCenterY);
      ctx.scale(zoom, zoom);
      ctx.translate(-curCenterX, -curCenterY);

      // Draw Grid / Stars subtle background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      const step = 60;
      const startX = Math.floor((curCenterX - panX - 2000) / step) * step;
      const endX = startX + 4000;
      const startY = Math.floor((curCenterY - panY - 2000) / step) * step;
      const endY = startY + 4000;
      for (let gx = startX; gx < endX; gx += step) {
        for (let gy = startY; gy < endY; gy += step) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // Draw Links
      for (const link of simLinks) {
        const isHovered = activeHoverNode && 
          (activeHoverNode.id === link.source.id || activeHoverNode.id === link.target.id);

        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);

        if (isHovered) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.2;
        } else {
          ctx.strokeStyle = link.type === 'synergy' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148, 163, 184, 0.18)';
          ctx.lineWidth = link.type === 'synergy' ? 1.5 : 1;
        }

        ctx.stroke();
      }

      // Draw Nodes
      for (const node of simNodes) {
        const isHovered = activeHoverNode?.id === node.id;
        const isConnectedToHover = activeHoverNode && simLinks.some(
          l => (l.source.id === activeHoverNode?.id && l.target.id === node.id) ||
               (l.target.id === activeHoverNode?.id && l.source.id === node.id)
        );

        // Glow ring for hovered/connected
        if (isHovered || isConnectedToHover) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.15)';
          ctx.fill();
        }

        // Main Node Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isHovered ? 14 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        const shouldShowLabel = isHovered || isConnectedToHover || zoom > 0.8 || node.radius > 13;
        if (shouldShowLabel) {
          ctx.font = `${isHovered ? 'bold 12px' : '10px'} -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Label Shadow / Background Box
          const text = node.label.length > 24 ? node.label.slice(0, 22) + '...' : node.label;
          const textMetrics = ctx.measureText(text);
          const bgPadding = 3;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(
            node.x - textMetrics.width / 2 - bgPadding,
            node.y + node.radius + 4,
            textMetrics.width + bgPadding * 2,
            14
          );

          ctx.fillStyle = isHovered ? '#ffffff' : '#cbd5e1';
          ctx.fillText(text, node.x, node.y + node.radius + 11);
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    // Mouse coordinates helper
    const getCanvasMousePos = (e: MouseEvent) => {
      const bRect = canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - bRect.left;
      const mouseScreenY = e.clientY - bRect.top;
      const curCenterX = (bRect.width || 1) / 2;
      const curCenterY = (bRect.height || 1) / 2;

      // Invert pan & zoom relative to current center
      const canvasWorldX = (mouseScreenX - (panX + curCenterX)) / zoom + curCenterX;
      const canvasWorldY = (mouseScreenY - (panY + curCenterY)) / zoom + curCenterY;

      return { x: canvasWorldX, y: canvasWorldY, screenX: mouseScreenX, screenY: mouseScreenY };
    };

    // Find node at position
    const findNodeAt = (worldX: number, worldY: number) => {
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
          return n;
        }
      }
      return null;
    };

    // Mouse Events
    const handleMouseDown = (e: MouseEvent) => {
      const pos = getCanvasMousePos(e);
      const hit = findNodeAt(pos.x, pos.y);

      if (hit) {
        draggedNode = hit;
        hit.isPinned = true;
        ticks = 0; // awaken physics
      } else {
        isPanning = true;
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pos = getCanvasMousePos(e);

      if (draggedNode) {
        draggedNode.x = pos.x;
        draggedNode.y = pos.y;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
        ticks = 0;
        return;
      }

      if (isPanning) {
        panX = e.clientX - panStartX;
        panY = e.clientY - panStartY;
        return;
      }

      // Hover detection
      const hoverHit = findNodeAt(pos.x, pos.y);
      if (hoverHit !== activeHoverNode) {
        activeHoverNode = hoverHit;
        if (hoverHit) {
          canvas.style.cursor = 'pointer';
          setHoveredNode({
            id: hoverHit.id,
            label: hoverHit.label,
            type: hoverHit.type,
            connections: hoverHit.connections,
            details: hoverHit.details
          });
        } else {
          canvas.style.cursor = 'grab';
          setHoveredNode(null);
        }
      }
    };

    const handleMouseUp = () => {
      if (draggedNode) {
        draggedNode.isPinned = false;
        draggedNode = null;
      }
      isPanning = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      zoom = Math.max(0.25, Math.min(3.5, zoom * zoomFactor));
    };

    const handleClick = (e: MouseEvent) => {
      const pos = getCanvasMousePos(e);
      const hit = findNodeAt(pos.x, pos.y);
      if (hit) {
        // Node Click Handler
        if (activeTab === 'notes' && hit.type === 'note') {
          const cleanTitle = hit.label.replace(/^#+\s*/, '');
          onOpenNote?.(cleanTitle);
        } else if (activeTab === 'skills' && hit.type === 'skill') {
          const skillId = hit.id.replace(/^skill_/, '');
          onOpenSkill?.(skillId);
          setSelectedNodeDetails(hit);
        } else if (activeTab === 'projects' && hit.type === 'project') {
          const rawPath = hit.details?.replace(/^Caminho do projeto:\s*/, '') || '';
          if (rawPath && onSwitchProject) {
            onSwitchProject(rawPath);
          }
          setSelectedNodeDetails(hit);
        } else {
          setSelectedNodeDetails(hit);
        }
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('click', handleClick);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('click', handleClick);
    };
  }, [graphData, isLoading, activeTab, showSubNodes1, showSubNodes2, showLinks, searchFilter, chargeStrength, onOpenNote, onOpenSkill, onSwitchProject]);

  return (
    <div className={`flex flex-col w-full h-full bg-[#0a0c10] text-slate-100 select-none overflow-hidden relative ${embeddedMode ? '' : 'rounded-2xl border border-card-border shadow-2xl'}`}>
      {/* 1. Header Toolbar with 3 Separate Graph Tabs */}
      <div className="h-14 border-b border-card-border/80 bg-[#0e121a] px-4 flex items-center justify-between z-20 gap-3 shrink-0">
        {/* Left: 3 Graph Mode Switcher */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light shrink-0 shadow-sm">
            <Network className="w-4 h-4" />
          </div>

          <div className="flex items-center bg-card rounded-xl p-0.5 border border-card-border text-xs">
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'notes'
                  ? 'bg-brand-cyan text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grafo de Notas, Assuntos, Tags e Wikilinks do Obsidian/Vault"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Arquivos & Notas</span>
            </button>

            <button
              onClick={() => setActiveTab('skills')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'skills'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grafo de Habilidades, Especialistas, Categorias e Capacidades do Tellus"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Skills do Tellus</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'projects'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grafo de Projetos, Módulos, Memórias de Arquitetura e Rotinas"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Projetos</span>
            </button>
          </div>
        </div>

        {/* Center: Search inside active graph */}
        <div className="relative flex-1 max-w-xs hidden md:block">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Buscar em ${activeTab === 'notes' ? 'notas' : activeTab === 'skills' ? 'skills' : 'projetos'}...`}
            className="w-full bg-panel border border-card-border rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent"
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className="absolute right-2.5 top-2 text-slate-500 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right Controls: Refresh & Close */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => loadGraph(activeTab)}
            className="p-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-slate-400 hover:text-white transition-colors"
            title="Recarregar grafo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-slate-400 hover:text-rose-400 transition-colors"
              title="Fechar Grafo"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Floating Filter Overlay */}
      <div className="absolute top-16 left-4 z-10 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center space-x-1 bg-card/90 backdrop-blur-md p-1 rounded-xl border border-card-border shadow-lg">
          {/* Toggle 1 */}
          <button
            onClick={() => setShowSubNodes1(!showSubNodes1)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
              showSubNodes1
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-transparent border-transparent text-slate-500 line-through'
            }`}
          >
            {activeTab === 'notes' ? '📂 Pastas' : activeTab === 'skills' ? '📂 Categorias' : '📁 Módulos'}
          </button>

          {/* Toggle 2 */}
          <button
            onClick={() => setShowSubNodes2(!showSubNodes2)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
              showSubNodes2
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-transparent border-transparent text-slate-500 line-through'
            }`}
          >
            {activeTab === 'notes' ? '#️⃣ Tags' : activeTab === 'skills' ? '🤖 Agentes' : '🧠 Memórias'}
          </button>

          {/* Toggle 3: Links */}
          <button
            onClick={() => setShowLinks(!showLinks)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
              showLinks
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-transparent border-transparent text-slate-500 line-through'
            }`}
          >
            {activeTab === 'notes' ? '🔗 Wikilinks' : activeTab === 'skills' ? '⚡ Sinergias' : '⚡ Rotinas'}
          </button>
        </div>

        {/* Repulsion / Physics Slider */}
        <div className="hidden sm:flex items-center space-x-2 bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-card-border shadow-lg text-[11px] text-slate-400">
          <span>Repulsão:</span>
          <input
            type="range"
            min="150"
            max="600"
            step="25"
            value={chargeStrength}
            onChange={(e) => setChargeStrength(parseInt(e.target.value, 10))}
            className="w-20 accent-brand-cyan cursor-pointer"
          />
        </div>
      </div>

      {/* 3. Hover Tooltip Badge */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 z-10 bg-card/95 backdrop-blur-md p-3 rounded-2xl border border-brand-cyan/40 shadow-2xl max-w-sm pointer-events-none animate-in fade-in">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-cyan animate-pulse" />
            <span className="font-bold text-xs text-white truncate">{hoveredNode.label}</span>
          </div>
          <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-1 font-mono">
            <span>Tipo: <strong className="text-slate-200 capitalize">{hoveredNode.type}</strong></span>
            <span>Conexões: <strong className="text-brand-cyan font-bold">{hoveredNode.connections}</strong></span>
          </div>
          {hoveredNode.details && (
            <p className="text-[11px] text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
              {hoveredNode.details}
            </p>
          )}
        </div>
      )}

      {/* 4. Selected Node Inspector Flyout */}
      {selectedNodeDetails && (
        <div className="absolute top-16 right-4 z-20 bg-card/95 backdrop-blur-md p-4 rounded-2xl border border-card-border shadow-2xl w-80 max-h-[70vh] overflow-y-auto animate-in slide-in-from-right-4">
          <div className="flex items-start justify-between pb-2 border-b border-card-border/60">
            <div>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                {selectedNodeDetails.type}
              </span>
              <h4 className="font-bold text-sm text-white mt-1">{selectedNodeDetails.label}</h4>
            </div>
            <button onClick={() => setSelectedNodeDetails(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-2.5 space-y-2 text-xs text-slate-300">
            {selectedNodeDetails.details && (
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">Detalhes:</span>
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{selectedNodeDetails.details}</p>
              </div>
            )}
            
            {activeTab === 'notes' && selectedNodeDetails.type === 'note' && (
              <button
                onClick={() => {
                  onOpenNote?.(selectedNodeDetails.label.replace(/^#+\s*/, ''));
                  setSelectedNodeDetails(null);
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/80 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-brand-cyan/20"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Abrir no Editor de Notas</span>
              </button>
            )}

            {activeTab === 'skills' && selectedNodeDetails.type === 'skill' && (
              <button
                onClick={() => {
                  onOpenSkill?.(selectedNodeDetails.id.replace(/^skill_/, ''));
                  setSelectedNodeDetails(null);
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-purple-600/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Inspecionar Skill</span>
              </button>
            )}

            {activeTab === 'projects' && selectedNodeDetails.type === 'project' && (
              <button
                onClick={() => {
                  const rawPath = selectedNodeDetails.details?.replace(/^Caminho do projeto:\s*/, '') || '';
                  if (rawPath) onSwitchProject?.(rawPath);
                  setSelectedNodeDetails(null);
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-blue-600/20"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Tornar Projeto Ativo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Main Canvas Rendering Area */}
      <div className="flex-1 relative cursor-grab active:cursor-grabbing w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm z-30 space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin" />
            <span className="text-xs text-slate-300 font-mono">Calculando topologia e física do grafo...</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      {/* 6. Footer Navigation Hints */}
      <div className="h-7 bg-[#0b0e14] border-t border-card-border/60 px-4 flex items-center justify-between text-[10px] text-slate-500 font-mono shrink-0">
        <div className="flex items-center space-x-3">
          <span>💡 Clique e arraste para mover nós</span>
          <span>•</span>
          <span>Roda do mouse: Zoom</span>
          <span>•</span>
          <span>Clique no nó: Abrir / Inspecionar</span>
        </div>
        <div>
          {graphData && (
            <span>
              {graphData.nodes.length} nós • {graphData.links.length} conexões
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
