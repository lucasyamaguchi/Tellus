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
  X,
  Flame,
  ExternalLink
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
  const [chargeStrength, setChargeStrength] = useState<number>(450);
  const [graphStyleMode, setGraphStyleMode] = useState<'solid' | 'neon'>('solid');

  // Filters state
  const [showSubNodes1, setShowSubNodes1] = useState<boolean>(true);  // folders / categories / modules
  const [showSubNodes2, setShowSubNodes2] = useState<boolean>(false); // tags / agents / memories (off by default to prevent clutter)
  const [showLinks, setShowLinks] = useState<boolean>(true);          // wikilinks / synergies / routines

  const [hoveredNode, setHoveredNode] = useState<{
    id: string;
    label: string;
    type: string;
    connections: number;
    details?: string;
  } | null>(null);

  const [selectedNodeDetails, setSelectedNodeDetails] = useState<GraphNode | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const [zoomTier, setZoomTier] = useState<1 | 2 | 3 | 4>(2);
  const [pendingZoomTarget, setPendingZoomTarget] = useState<{ zoom: number; nodeId?: string } | null>(null);

  // Extract Top Hot Terms from GraphData (Keywords with most connections)
  const hotKeywords = React.useMemo(() => {
    if (!graphData || activeTab !== 'notes') return [];
    return graphData.nodes
      .filter(n => n.type === 'keyword')
      .map(n => ({
        id: n.id,
        label: n.label.replace(/^[🔥#\s]+/, ''),
        count: n.hotness || 1,
        noteIds: n.linkedNoteIds || []
      }))
      .sort((a, b) => b.count - a.count);
  }, [graphData, activeTab]);

  // Expanded Term Details
  const expandedTerm = React.useMemo(() => {
    if (!expandedTermId || !graphData) return null;
    const node = graphData.nodes.find(n => n.id === expandedTermId);
    if (!node) return null;
    return {
      id: node.id,
      label: node.label.replace(/^[🔥#\s]+/, ''),
      count: node.hotness || 1,
      noteIds: node.linkedNoteIds || []
    };
  }, [expandedTermId, graphData]);

  // Notes linked to the active expanded term
  const linkedNotesForExpandedTerm = React.useMemo(() => {
    if (!expandedTerm || !graphData) return [];
    const noteIdSet = new Set(expandedTerm.noteIds);
    return graphData.nodes.filter(n => 
      n.type === 'note' && (
        noteIdSet.has(n.id) || 
        graphData.links.some(l => 
          (l.source === n.id && l.target === expandedTerm.id) || 
          (l.target === n.id && l.source === expandedTerm.id)
        )
      )
    );
  }, [expandedTerm, graphData]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Load Graph Data based on active tab
  const loadGraph = useCallback(async (tab: GraphViewType) => {
    setIsLoading(true);
    setGraphData(null);
    setHoveredNode(null);
    setExpandedTermId(null);
    setZoomTier(2);
    try {
      let data: GraphData;
      if (tab === 'notes') {
        data = await api.getNotesGraph();
      } else if (tab === 'skills') {
        data = await api.getSkillsGraph();
      } else {
        data = await api.getProjectsGraph();
      }
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        data = { nodes: (data && Array.isArray((data as any).nodes)) ? (data as any).nodes : [], links: (data && Array.isArray((data as any).links)) ? (data as any).links : [] };
      }
      setGraphData(data);
    } catch (err) {
      console.error('[InteractiveGraph] Failed to fetch graph data:', err);
      setGraphData({ nodes: [], links: [] });
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
      level?: 1 | 2 | 3 | 4;
      hotness?: number;
      linkedNoteIds?: string[];
      parentId?: string;
      macroCategory?: string;
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
      if (n.type === 'macro_category') radius = 30;
      else if (n.type === 'subject') radius = 17;
      else if (n.type === 'keyword') radius = Math.min(24, 11 + (n.hotness ? n.hotness * 2.2 : 2));
      else if (n.type === 'note') radius = Math.max(7, Math.min(18, 6 + (n.val / 3)));
      else if (n.type === 'project') radius = 22;
      else if (n.type === 'category' || n.type === 'agent') radius = 16;
      else if (n.type === 'skill') radius = 11;

      return {
        id: n.id,
        label: n.label,
        type: n.type,
        val: n.val,
        color: n.color || (n.type === 'keyword' ? '#f43f5e' : '#38bdf8'),
        details: n.details,
        level: n.level,
        hotness: n.hotness,
        linkedNoteIds: n.linkedNoteIds,
        parentId: n.parentId,
        macroCategory: n.macroCategory,
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

    let targetZoom: number | null = null;
    let targetPanX: number | null = null;
    let targetPanY: number | null = null;
    let lastReportedTier: 1 | 2 | 3 | 4 = 2;

    if (pendingZoomTarget) {
      if (pendingZoomTarget.nodeId) {
        const targetNode = nodeMap.get(pendingZoomTarget.nodeId);
        if (targetNode) {
          targetZoom = pendingZoomTarget.zoom;
          targetPanX = -(targetNode.x - initialCenterX);
          targetPanY = -(targetNode.y - initialCenterY);
        }
      } else {
        targetZoom = pendingZoomTarget.zoom;
        targetPanX = 0;
        targetPanY = 0;
      }
      setPendingZoomTarget(null);
    }

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

      // Calibrated, stable force constants (Obsidian-style)
      const kRepulsion = chargeStrength * 12;
      const kAttraction = 0.025;
      const damping = 0.88;
      const maxSpeed = 7;

      // 1. Repulsion between all node pairs with distance clamp
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          // Clamp minimum distance to prevent singularity / explosive repulsion
          const distSq = Math.max(dx * dx + dy * dy, 1600);
          const dist = Math.sqrt(distSq);

          if (dist < 600) {
            // Soft-capped repulsive force
            const force = Math.min(kRepulsion / distSq, 14);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!n1.isPinned) { n1.vx -= fx; n1.vy -= fy; }
            if (!n2.isPinned) { n2.vx += fx; n2.vy += fy; }
          }
        }
      }

      // 1.1 Collision separation to prevent overlapping nodes
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.hypot(dx, dy) || 1;
          const minDist = n1.radius + n2.radius + 28;
          if (dist < minDist) {
            const overlap = (minDist - dist) * 0.45;
            const ox = (dx / dist) * overlap;
            const oy = (dy / dist) * overlap;
            if (!n1.isPinned) { n1.vx -= ox; n1.vy -= oy; }
            if (!n2.isPinned) { n2.vx += ox; n2.vy += oy; }
          }
        }
      }

      // 2. Spring Attraction along links (180px distance for clear visual hierarchy)
      for (const link of simLinks) {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = 180;
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

      // Smooth Camera Transition Interpolation
      if (targetZoom !== null && targetPanX !== null && targetPanY !== null) {
        zoom += (targetZoom - zoom) * 0.16;
        panX += (targetPanX - panX) * 0.16;
        panY += (targetPanY - panY) * 0.16;
        if (Math.abs(targetZoom - zoom) < 0.008 && Math.abs(targetPanX - panX) < 0.8 && Math.abs(targetPanY - panY) < 0.8) {
          zoom = targetZoom;
          panX = targetPanX;
          panY = targetPanY;
          targetZoom = null;
          targetPanX = null;
          targetPanY = null;
        }
        ticks = 0;
      }

      // Calculate semantic zoom tier
      let currentTier: 1 | 2 | 3 | 4 = 2;
      if (zoom < 0.72) currentTier = 1;
      else if (zoom < 1.18) currentTier = 2;
      else if (zoom < 1.72) currentTier = 3;
      else currentTier = 4;

      if (currentTier !== lastReportedTier) {
        lastReportedTier = currentTier;
        setZoomTier(currentTier);
      }

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
        const isHovered = Boolean(activeHoverNode && 
          (activeHoverNode.id === link.source.id || activeHoverNode.id === link.target.id));
        const isConnectedToExpanded = Boolean(expandedTermId &&
          (link.source.id === expandedTermId || link.target.id === expandedTermId));

        let strokeColor = 'rgba(148, 163, 184, 0.22)';
        let strokeW = 1.1;
        let linkAlpha = 0.55;

        if (expandedTermId) {
          if (isConnectedToExpanded) {
            strokeColor = '#f43f5e';
            strokeW = 2.6;
            linkAlpha = 0.95;
          } else {
            strokeColor = 'rgba(148, 163, 184, 0.04)';
            strokeW = 0.6;
            linkAlpha = 0.06;
          }
        } else if (isHovered) {
          strokeColor = '#38bdf8';
          strokeW = 2.4;
          linkAlpha = 0.95;
        } else if (activeHoverNode) {
          strokeColor = 'rgba(148, 163, 184, 0.05)';
          strokeW = 0.8;
          linkAlpha = 0.12;
        } else {
          if (graphStyleMode === 'solid') {
            if (link.type === 'macro_subject') {
              strokeColor = '#38bdf8';
              strokeW = 2.0;
              linkAlpha = 0.7;
            } else if (link.type === 'keyword') {
              strokeColor = '#f43f5e';
              strokeW = 1.5;
              linkAlpha = 0.6;
            } else {
              strokeColor = 'rgba(100, 116, 139, 0.6)';
              strokeW = 1.3;
              linkAlpha = 0.5;
            }
          } else {
            strokeColor = link.type === 'keyword' ? 'rgba(244, 63, 94, 0.45)' : 'rgba(148, 163, 184, 0.22)';
            strokeW = link.type === 'macro_subject' ? 1.8 : 1.1;
            linkAlpha = 0.5;
          }
        }

        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeW;
        ctx.globalAlpha = linkAlpha;
        ctx.stroke();
      }

      // Draw Nodes
      for (const node of simNodes) {
        const isHovered = activeHoverNode?.id === node.id;
        const isConnectedToHover = Boolean(activeHoverNode && simLinks.some(
          l => (l.source.id === activeHoverNode?.id && l.target.id === node.id) ||
               (l.target.id === activeHoverNode?.id && l.source.id === node.id)
        ));

        const isExpandedTermNode = expandedTermId === node.id;
        const isConnectedToExpanded = Boolean(expandedTermId && simLinks.some(
          l => (l.source.id === expandedTermId && l.target.id === node.id) ||
               (l.target.id === expandedTermId && l.source.id === node.id)
        ));

        let nodeAlpha = 1.0;
        if (expandedTermId) {
          if (isExpandedTermNode || isConnectedToExpanded) {
            nodeAlpha = 1.0;
          } else {
            nodeAlpha = 0.08;
          }
        } else if (activeHoverNode) {
          nodeAlpha = (isHovered || isConnectedToHover) ? 1.0 : 0.18;
        } else if (activeTab === 'notes') {
          // Progressive Semantic Zooming Opacities
          if (currentTier === 1) {
            nodeAlpha = node.type === 'macro_category' ? 1.0 : node.type === 'subject' ? 0.6 : 0.25;
          } else if (currentTier === 2) {
            nodeAlpha = (node.type === 'macro_category' || node.type === 'subject') ? 1.0 : node.type === 'keyword' ? 0.65 : 0.4;
          } else if (currentTier === 3) {
            nodeAlpha = (node.type === 'keyword' || node.type === 'subject') ? 1.0 : 0.8;
          } else {
            nodeAlpha = 1.0;
          }
        }

        ctx.globalAlpha = nodeAlpha;

        // Visual Accents:
        // 1. Macro Category Orbital Ring (Level 1)
        if (node.type === 'macro_category' && nodeAlpha > 0.3) {
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.arc(node.x, node.y, node.radius + 8, 0, 2 * Math.PI);
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }

        // 2. Hot Term Radiant Aura (Level 3)
        if (node.type === 'keyword' && node.hotness && node.hotness >= 3 && nodeAlpha > 0.3) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, 2 * Math.PI);
          ctx.fillStyle = isExpandedTermNode ? 'rgba(244, 63, 94, 0.45)' : 'rgba(244, 63, 94, 0.25)';
          ctx.fill();
        }

        // 3. Hover or Connected Glow
        if (isHovered || isConnectedToHover || isExpandedTermNode) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, 2 * Math.PI);
          ctx.fillStyle = isExpandedTermNode ? 'rgba(244, 63, 94, 0.4)' : isHovered ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.18)';
          ctx.fill();
        }

        // Main Node Body (Solid 3D Spherical vs Neon Bloom)
        if (graphStyleMode === 'solid') {
          // Soft projected drop shadow
          ctx.beginPath();
          ctx.ellipse(node.x, node.y + node.radius * 0.45, node.radius * 0.95, node.radius * 0.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = nodeAlpha < 0.5 ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.65)';
          ctx.fill();

          // Spherical radial gradient
          const grad = ctx.createRadialGradient(
            node.x - node.radius * 0.32,
            node.y - node.radius * 0.32,
            node.radius * 0.08,
            node.x,
            node.y,
            node.radius
          );
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.28, node.color);
          grad.addColorStop(0.85, node.color);
          grad.addColorStop(1.0, '#0a0d14');

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.lineWidth = (isHovered || isExpandedTermNode) ? 2.5 : 1.2;
          ctx.strokeStyle = isExpandedTermNode ? '#f43f5e' : isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)';
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.shadowColor = node.color;
          ctx.shadowBlur = (isHovered || isExpandedTermNode) ? 18 : 5;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Label thresholding by semantic tier
        const isMacro = node.type === 'macro_category';
        const isSubject = node.type === 'subject';
        const isKeyword = node.type === 'keyword';
        const isNote = node.type === 'note';

        let shouldShowLabel = false;
        if (expandedTermId) {
          shouldShowLabel = (isExpandedTermNode || isConnectedToExpanded);
        } else if (isHovered || isConnectedToHover) {
          shouldShowLabel = true;
        } else if (isMacro) {
          shouldShowLabel = true;
        } else if (isSubject) {
          shouldShowLabel = zoom > 0.65;
        } else if (isKeyword) {
          shouldShowLabel = (node.hotness && node.hotness >= 3) ? zoom > 0.8 : zoom > 1.05;
        } else if (isNote) {
          shouldShowLabel = zoom > 1.25;
        } else {
          shouldShowLabel = zoom > 1.05;
        }

        if (shouldShowLabel && nodeAlpha > 0.3) {
          const fontSize = isMacro ? 'bold 12px' : isSubject ? 'bold 11px' : isKeyword ? 'bold 11px' : '10px';
          ctx.font = `${fontSize} -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const text = node.label.length > 30 ? node.label.slice(0, 28) + '...' : node.label;
          const textMetrics = ctx.measureText(text);
          const bgPaddingX = 6;
          const bgPaddingY = 3;

          const boxX = node.x - textMetrics.width / 2 - bgPaddingX;
          const boxY = node.y + node.radius + 6;
          const boxW = textMetrics.width + bgPaddingX * 2;
          const boxH = 14 + bgPaddingY * 2;

          ctx.fillStyle = 'rgba(10, 13, 20, 0.92)';
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.strokeStyle = isExpandedTermNode ? '#f43f5e' : isHovered ? '#38bdf8' : isMacro ? node.color : 'rgba(255, 255, 255, 0.14)';
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          ctx.fillStyle = isExpandedTermNode ? '#fda4af' : isHovered ? '#ffffff' : isMacro ? '#ffffff' : isKeyword ? '#f472b6' : isSubject ? '#fde68a' : '#cbd5e1';
          ctx.fillText(text, node.x, boxY + boxH / 2);
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

    const zoomToNode = (targetNode: SimNode, targetZ: number) => {
      const bRect = canvas.getBoundingClientRect();
      const cX = (bRect.width || 1) / 2;
      const cY = (bRect.height || 1) / 2;
      targetZoom = targetZ;
      targetPanX = -(targetNode.x - cX);
      targetPanY = -(targetNode.y - cY);
      ticks = 0;
    };

    const handleDblClick = (e: MouseEvent) => {
      const pos = getCanvasMousePos(e);
      const hit = findNodeAt(pos.x, pos.y);
      if (hit) {
        if (hit.type === 'macro_category') {
          zoomToNode(hit, 0.95);
        } else if (hit.type === 'subject') {
          zoomToNode(hit, 1.45);
        } else if (hit.type === 'keyword') {
          setExpandedTermId(hit.id);
          zoomToNode(hit, 2.0);
        } else if (hit.type === 'note') {
          const cleanTitle = hit.label.replace(/^#+\s*/, '');
          onOpenNote?.(cleanTitle);
        }
      } else {
        targetZoom = 1.0;
        targetPanX = 0;
        targetPanY = 0;
        setExpandedTermId(null);
        ticks = 0;
      }
    };

    const handleClick = (e: MouseEvent) => {
      const pos = getCanvasMousePos(e);
      const hit = findNodeAt(pos.x, pos.y);
      if (hit) {
        // Node Click Handler
        if (hit.type === 'keyword') {
          // Single click on keyword expands or focuses the term constellation
          setExpandedTermId(prev => prev === hit.id ? null : hit.id);
          setSelectedNodeDetails(hit);
        } else if (hit.type === 'macro_category' || hit.type === 'subject') {
          setSelectedNodeDetails(hit);
        } else if (activeTab === 'notes' && hit.type === 'note') {
          const cleanTitle = hit.label.replace(/^#+\s*/, '');
          onOpenNote?.(cleanTitle);
          setSelectedNodeDetails(hit);
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

    // Touchscreen Navigation Engine (Pan, Drag, Pinch-to-Zoom, Tap & Double-Tap)
    let initialPinchDist = 0;
    let initialPinchZoom = 1;
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTimestamp = 0;
    let lastTapNodeId: string | null = null;

    const getCanvasTouchPos = (touch: React.Touch | Touch) => {
      const bRect = canvas.getBoundingClientRect();
      const screenX = touch.clientX - bRect.left;
      const screenY = touch.clientY - bRect.top;
      const curCenterX = (bRect.width || 1) / 2;
      const curCenterY = (bRect.height || 1) / 2;

      const canvasWorldX = (screenX - (panX + curCenterX)) / zoom + curCenterX;
      const canvasWorldY = (screenY - (panY + curCenterY)) / zoom + curCenterY;

      return { x: canvasWorldX, y: canvasWorldY, screenX, screenY };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartTime = Date.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        const pos = getCanvasTouchPos(touch);
        const hit = findNodeAt(pos.x, pos.y);

        if (hit) {
          draggedNode = hit;
          hit.isPinned = true;
          ticks = 0;
        } else {
          isPanning = true;
          panStartX = touch.clientX - panX;
          panStartY = touch.clientY - panY;
        }
      } else if (e.touches.length === 2) {
        isPanning = false;
        if (draggedNode) {
          draggedNode.isPinned = false;
          draggedNode = null;
        }
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialPinchZoom = zoom;
      }
      if (e.cancelable) e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const pos = getCanvasTouchPos(touch);

        if (draggedNode) {
          draggedNode.x = pos.x;
          draggedNode.y = pos.y;
          draggedNode.vx = 0;
          draggedNode.vy = 0;
          ticks = 0;
          if (e.cancelable) e.preventDefault();
          return;
        }

        if (isPanning) {
          panX = touch.clientX - panStartX;
          panY = touch.clientY - panStartY;
          if (e.cancelable) e.preventDefault();
          return;
        }
      } else if (e.touches.length === 2 && initialPinchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const curDist = Math.hypot(dx, dy);
        const scale = curDist / initialPinchDist;
        zoom = Math.max(0.25, Math.min(3.8, initialPinchZoom * scale));
        ticks = 0;
        if (e.cancelable) e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (draggedNode) {
        draggedNode.isPinned = false;
        draggedNode = null;
      }
      isPanning = false;

      if (e.changedTouches.length === 1 && Date.now() - touchStartTime < 350) {
        const touch = e.changedTouches[0];
        const moveDist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
        if (moveDist < 14) {
          const pos = getCanvasTouchPos(touch);
          const hit = findNodeAt(pos.x, pos.y);
          const now = Date.now();
          const isDoubleTap = hit && lastTapNodeId === hit.id && (now - lastTapTimestamp < 350);

          if (isDoubleTap && hit) {
            // Double-tap on touchscreen:
            if (hit.type === 'macro_category') {
              zoomToNode(hit, 0.95);
            } else if (hit.type === 'subject') {
              zoomToNode(hit, 1.45);
            } else if (hit.type === 'keyword') {
              setExpandedTermId(hit.id);
              zoomToNode(hit, 2.0);
            } else if (hit.type === 'note') {
              const cleanTitle = hit.label.replace(/^#+\s*/, '');
              onOpenNote?.(cleanTitle);
            }
            lastTapTimestamp = 0;
            lastTapNodeId = null;
            return;
          }

          lastTapTimestamp = now;
          lastTapNodeId = hit ? hit.id : null;

          if (hit) {
            if (hit.type === 'keyword') {
              setExpandedTermId(prev => prev === hit.id ? null : hit.id);
              setSelectedNodeDetails(hit);
            } else if (hit.type === 'macro_category' || hit.type === 'subject') {
              setSelectedNodeDetails(hit);
            } else if (activeTab === 'notes' && hit.type === 'note') {
              const cleanTitle = hit.label.replace(/^#+\s*/, '');
              onOpenNote?.(cleanTitle);
              setSelectedNodeDetails(hit);
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
        }
      }
    };

    const handleTouchCancel = () => {
      if (draggedNode) {
        draggedNode.isPinned = false;
        draggedNode = null;
      }
      isPanning = false;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('dblclick', handleDblClick);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchCancel);

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
      canvas.removeEventListener('dblclick', handleDblClick);

      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    graphData, isLoading, activeTab, graphStyleMode, showSubNodes1, showSubNodes2, showLinks,
    searchFilter, chargeStrength, expandedTermId, pendingZoomTarget, onOpenNote, onOpenSkill, onSwitchProject
  ]);

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

        {/* Right Controls: Mode Toggle, Refresh & Close */}
        <div className="flex items-center space-x-1.5">
          {/* Visual Style Mode: Solid 3D vs Neon Bloom */}
          <div className="flex items-center bg-card rounded-xl p-0.5 border border-card-border text-[11px]">
            <button
              onClick={() => setGraphStyleMode('solid')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                graphStyleMode === 'solid'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Modo Sólido: Nós esféricos 3D com iluminação radial, sombras e condutos estruturais"
            >
              Sólido
            </button>
            <button
              onClick={() => setGraphStyleMode('neon')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                graphStyleMode === 'neon'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Modo Neon: Brilho de energia cósmica, partículas e bloom"
            >
              Neon
            </button>
          </div>

          <button
            onClick={() => loadGraph(activeTab)}
            className="p-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-slate-400 hover:text-white transition-colors cursor-pointer"
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

      {/* 2. Floating Filter Overlay & Semantic Zoom Stepper */}
      <div className="absolute top-16 left-4 z-10 flex flex-col gap-2 max-w-[calc(100%-2rem)]">
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
              {activeTab === 'notes' ? '🔥 Termos Quentes' : activeTab === 'skills' ? '🤖 Agentes' : '🧠 Memórias'}
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

        {/* Semantic Zoom Stepper (Notes Mode) */}
        {activeTab === 'notes' && (
          <div className="flex items-center space-x-1.5 bg-[#0f131c]/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-card-border/90 shadow-xl text-[11px] text-slate-300 w-fit">
            <span className="text-[10px] uppercase font-mono text-slate-400 mr-1 hidden md:inline">Nível Semântico:</span>
            {[
              { tier: 1, label: '1. Macro Cadernos', targetZ: 0.55 },
              { tier: 2, label: '2. Temas & Pastas', targetZ: 0.95 },
              { tier: 3, label: '3. Termos Quentes 🔥', targetZ: 1.45 },
              { tier: 4, label: '4. Notas Detalhadas', targetZ: 2.1 }
            ].map((step, idx) => {
              const isActive = zoomTier === step.tier;
              return (
                <React.Fragment key={step.tier}>
                  {idx > 0 && <span className="text-slate-600 text-[10px]">›</span>}
                  <button
                    onClick={() => setPendingZoomTarget({ zoom: step.targetZ })}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                    title={`Clique para navegar para o ${step.label}`}
                  >
                    {step.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Hot Topics Quick Filter Chips Bar (Notes Mode) */}
        {activeTab === 'notes' && hotKeywords.length > 0 && (
          <div className="flex items-center space-x-1.5 bg-[#0f131c]/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-rose-500/30 shadow-lg text-[11px] overflow-x-auto max-w-2xl py-1">
            <div className="flex items-center space-x-1 text-rose-400 font-bold shrink-0 text-[10px] uppercase font-mono mr-1">
              <Flame className="w-3.5 h-3.5 fill-rose-500/20 text-rose-500" />
              <span>Foco Atual:</span>
            </div>
            {hotKeywords.map((kw) => {
              const isSelected = expandedTermId === kw.id;
              return (
                <button
                  key={kw.id}
                  onClick={() => {
                    if (isSelected) {
                      setExpandedTermId(null);
                    } else {
                      setExpandedTermId(kw.id);
                      setPendingZoomTarget({ zoom: 1.9, nodeId: kw.id });
                    }
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center space-x-1 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/40 ring-1 ring-white/30'
                      : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-800/40'
                  }`}
                  title={`${kw.count} notas conectadas ao termo #${kw.label}`}
                >
                  <span>#{kw.label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-rose-700 text-white' : 'bg-rose-900/60 text-rose-300'}`}>
                    {kw.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Expanded Term Constellation Floating Banner */}
      {expandedTerm && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3 bg-[#0d1117]/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-rose-500/60 shadow-2xl animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs">
            <Flame className="w-4 h-4 fill-rose-500/40 text-rose-500 animate-pulse" />
            <span>Foco no Termo: <strong className="text-white">#{expandedTerm.label}</strong></span>
            <span className="bg-rose-500/20 text-rose-300 text-[10px] px-2 py-0.5 rounded-full border border-rose-500/30">
              {linkedNotesForExpandedTerm.length} notas vinculadas
            </span>
          </div>
          <button
            onClick={() => setExpandedTermId(null)}
            className="flex items-center space-x-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Ver Todo o Grafo</span>
          </button>
        </div>
      )}

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
            
            {/* Keyword / Hot Term Inspector */}
            {selectedNodeDetails.type === 'keyword' && (
              <div className="space-y-2 mt-2">
                <button
                  onClick={() => {
                    setExpandedTermId(prev => prev === selectedNodeDetails.id ? null : selectedNodeDetails.id);
                    setPendingZoomTarget({ zoom: 1.9, nodeId: selectedNodeDetails.id });
                  }}
                  className="w-full py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{expandedTermId === selectedNodeDetails.id ? '✕ Desfazer Foco no Termo' : '🔥 Focar Constelação deste Termo'}</span>
                </button>

                {selectedNodeDetails.linkedNoteIds && selectedNodeDetails.linkedNoteIds.length > 0 && (
                  <div className="pt-2 border-t border-card-border/60">
                    <span className="text-[10px] text-slate-400 font-mono block mb-1.5">
                      Notas Conectadas ({selectedNodeDetails.linkedNoteIds.length}):
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedNodeDetails.linkedNoteIds.map((noteId) => {
                        const noteTitle = noteId.replace(/^note_/, '').replace(/^#+\s*/, '');
                        return (
                          <div
                            key={noteId}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs transition-colors"
                          >
                            <span className="truncate text-slate-200 font-medium mr-2" title={noteTitle}>
                              📄 {noteTitle}
                            </span>
                            <button
                              onClick={() => {
                                onOpenNote?.(noteTitle);
                                setSelectedNodeDetails(null);
                              }}
                              className="shrink-0 px-2 py-1 bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-slate-950 font-bold text-[10px] rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                              title="Abrir nota no editor"
                            >
                              <span>Abrir</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Macro Category Drilldown */}
            {selectedNodeDetails.type === 'macro_category' && (
              <button
                onClick={() => {
                  setPendingZoomTarget({ zoom: 0.95, nodeId: selectedNodeDetails.id });
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Explorar Temas e Pastas</span>
              </button>
            )}

            {/* Subject Drilldown */}
            {selectedNodeDetails.type === 'subject' && (
              <button
                onClick={() => {
                  setPendingZoomTarget({ zoom: 1.45, nodeId: selectedNodeDetails.id });
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Explorar Termos e Notas</span>
              </button>
            )}

            {activeTab === 'notes' && selectedNodeDetails.type === 'note' && (
              <button
                onClick={() => {
                  onOpenNote?.(selectedNodeDetails.label.replace(/^#+\s*/, ''));
                  setSelectedNodeDetails(null);
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/80 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-brand-cyan/20 cursor-pointer"
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

            {selectedNodeDetails.type === 'project' && (
              <button
                onClick={() => {
                  const rawPath = (selectedNodeDetails as any).path || selectedNodeDetails.details?.replace(/^Caminho do projeto:\s*/, '').split('\n')[0] || '';
                  if (rawPath) onSwitchProject?.(rawPath);
                  setSelectedNodeDetails(null);
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Tornar Projeto Ativo</span>
              </button>
            )}

            {(selectedNodeDetails.type === 'note' || selectedNodeDetails.type === 'artifact' || selectedNodeDetails.type === 'memory') && (
              <button
                onClick={() => {
                  const target = (selectedNodeDetails as any).path || selectedNodeDetails.label.replace(/^[📄🧠📝]\s*/, '') || selectedNodeDetails.id;
                  onOpenNote?.(target);
                  setSelectedNodeDetails(null);
                }}
                className="w-full mt-2 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Abrir Anotação / Artefato</span>
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

        {!isLoading && (!graphData || graphData.nodes.length === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/40 backdrop-blur-sm z-20 space-y-3 p-6 text-center select-none">
            <Network className="w-10 h-10 text-slate-600" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-200">Nenhum nó disponível nesta categoria</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Selecione outra visualização acima (Arquivos & Notas, Skills ou Projetos) ou ative os filtros de módulos e rotinas.
              </p>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      {/* 6. Footer Navigation Hints */}
      <div className="h-7 bg-[#0b0e14] border-t border-card-border/60 px-4 flex items-center justify-between text-[10px] text-slate-500 font-mono shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden text-ellipsis whitespace-nowrap">
          <span>🤏 Pinça no touch / Scroll: Zoom Semântico (Níveis 1 a 4)</span>
          <span>•</span>
          <span>Duplo-clique ou toque: Entrar no nível</span>
          <span>•</span>
          <span>Clique em termo 🔥: Isolar constelação</span>
        </div>
        <div className="shrink-0 ml-2">
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
