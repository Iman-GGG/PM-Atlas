"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type {
  StructuredKnowledgeEdge,
  StructuredKnowledgeNode,
  StructuredKnowledgeNodeType,
} from "./knowledge-graph-data";

type SimNode = StructuredKnowledgeNode & {
  degree: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type Camera = { x: number; y: number; scale: number };

type DragState = {
  kind: "node" | "pan";
  moved: boolean;
  node?: SimNode;
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

type KnowledgeGraphCanvasProps = {
  edges: StructuredKnowledgeEdge[];
  nodes: StructuredKnowledgeNode[];
  onSelect: (node: StructuredKnowledgeNode, openDossier: boolean) => void;
  selectedId: string | null;
};

const nodeTypeMeta: Record<StructuredKnowledgeNodeType, { color: string; label: string }> = {
  "process-group": { color: "#c4b5fd", label: "5 过程组" },
  "knowledge-area": { color: "#93c5fd", label: "10 管理过程" },
  process: { color: "#fcd34d", label: "49 子过程" },
  document: { color: "#86efac", label: "32 项目文档" },
  tool: { color: "#e5e7eb", label: "133 工具与技术" },
};

const nodeTypeOrder = Object.keys(nodeTypeMeta) as StructuredKnowledgeNodeType[];

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function initialRadius(type: StructuredKnowledgeNodeType) {
  if (type === "process-group") return 90;
  if (type === "knowledge-area") return 210;
  if (type === "process") return 390;
  if (type === "document") return 570;
  return 760;
}

function nodeRadius(node: SimNode) {
  const base = node.type === "process-group" ? 5.6 : node.type === "knowledge-area" ? 4.8 : 2.5;
  return base + Math.sqrt(Math.max(1, node.degree)) * 1.35;
}

function createSimulationNodes(nodes: StructuredKnowledgeNode[], degree: Map<string, number>) {
  return nodes.map((node, index) => {
    const seed = stableHash(node.id);
    const angle = (seed % 6283) / 1000 + index * .037;
    const radius = initialRadius(node.type) + ((seed >>> 8) % 120) - 60;
    return {
      ...node,
      degree: degree.get(node.id) ?? 0,
      vx: 0,
      vy: 0,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * .72,
    };
  });
}

function cameraForNodes(canvas: HTMLCanvasElement, candidates: SimNode[]): Camera | null {
  if (!candidates.length) return null;
  const minX = Math.min(...candidates.map((node) => node.x));
  const maxX = Math.max(...candidates.map((node) => node.x));
  const minY = Math.min(...candidates.map((node) => node.y));
  const maxY = Math.max(...candidates.map((node) => node.y));
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = Math.max(.16, Math.min(1.2, Math.min((width - 110) / Math.max(180, maxX - minX), (height - 110) / Math.max(180, maxY - minY))));
  return {
    scale,
    x: width / 2 - (minX + maxX) / 2 * scale,
    y: height / 2 - (minY + maxY) / 2 * scale,
  };
}

export function KnowledgeGraphCanvas({ edges, nodes, onSelect, selectedId }: KnowledgeGraphCanvasProps) {
  const [interactionActive, setInteractionActive] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hiddenTypes, setHiddenTypes] = useState<StructuredKnowledgeNodeType[]>([]);
  const [localDepth, setLocalDepth] = useState<0 | 1 | 2>(0);
  const [labelThreshold, setLabelThreshold] = useState(.82);
  const [groupColors, setGroupColors] = useState(false);
  const [cameraDisplay, setCameraDisplay] = useState(.42);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: .42 });
  const simulationRef = useRef<{ alpha: number; byId: Map<string, SimNode>; nodes: SimNode[] } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const hoverRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const didFitRef = useRef(false);

  const degree = useMemo(() => {
    const counts = new Map(nodes.map((node) => [node.id, 0]));
    edges.forEach((edge) => {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    });
    return counts;
  }, [edges, nodes]);

  const adjacency = useMemo(() => {
    const result = new Map(nodes.map((node) => [node.id, new Set<string>()]));
    edges.forEach((edge) => {
      result.get(edge.source)?.add(edge.target);
      result.get(edge.target)?.add(edge.source);
    });
    return result;
  }, [edges, nodes]);

  const visibleIds = useMemo(() => {
    const typeVisible = new Set(nodes.filter((node) => !hiddenTypes.includes(node.type)).map((node) => node.id));
    let result = typeVisible;
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");

    if (normalizedQuery) {
      const matches = nodes.filter((node) => typeVisible.has(node.id) && `${node.title} ${node.category} ${node.description}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery));
      const searchSet = new Set<string>();
      matches.forEach((node) => {
        searchSet.add(node.id);
        adjacency.get(node.id)?.forEach((id) => {
          if (typeVisible.has(id)) searchSet.add(id);
        });
      });
      result = searchSet;
    }

    if (localDepth > 0 && selectedId) {
      const localSet = new Set<string>([selectedId]);
      let frontier = new Set<string>([selectedId]);
      for (let depth = 0; depth < localDepth; depth += 1) {
        const next = new Set<string>();
        frontier.forEach((id) => adjacency.get(id)?.forEach((neighbor) => {
          if (!localSet.has(neighbor)) next.add(neighbor);
          localSet.add(neighbor);
        }));
        frontier = next;
      }
      result = new Set([...result].filter((id) => localSet.has(id)));
    }

    return result;
  }, [adjacency, hiddenTypes, localDepth, nodes, query, selectedId]);

  const visibleEdgeCount = useMemo(() => edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).length, [edges, visibleIds]);
  const focusId = hoveredId ?? selectedId;
  const focusNeighbors = useMemo(() => {
    if (!focusId) return new Set<string>();
    return new Set([focusId, ...(adjacency.get(focusId) ?? [])]);
  }, [adjacency, focusId]);

  const renderStateRef = useRef({
    focusId,
    focusNeighbors,
    groupColors,
    labelThreshold,
    selectedId,
    visibleIds,
  });

  useEffect(() => {
    renderStateRef.current = { focusId, focusNeighbors, groupColors, labelThreshold, selectedId, visibleIds };
  }, [focusId, focusNeighbors, groupColors, labelThreshold, selectedId, visibleIds]);

  useEffect(() => {
    activeRef.current = interactionActive;
  }, [interactionActive]);

  useEffect(() => {
    hoverRef.current = hoveredId;
  }, [hoveredId]);

  const fitVisibleNodes = () => {
    const canvas = canvasRef.current;
    const simulation = simulationRef.current;
    if (!canvas || !simulation) return;
    const candidates = simulation.nodes.filter((node) => visibleIds.has(node.id));
    const camera = cameraForNodes(canvas, candidates);
    if (!camera) return;
    cameraRef.current = camera;
    setCameraDisplay(camera.scale);
  };

  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const pointerX = clientX === undefined ? bounds.width / 2 : clientX - bounds.left;
    const pointerY = clientY === undefined ? bounds.height / 2 : clientY - bounds.top;
    const camera = cameraRef.current;
    const scale = Math.max(.12, Math.min(4.5, camera.scale * factor));
    const ratio = scale / camera.scale;
    cameraRef.current = {
      scale,
      x: pointerX - (pointerX - camera.x) * ratio,
      y: pointerY - (pointerY - camera.y) * ratio,
    };
    setCameraDisplay(scale);
  };

  const nodeAt = (clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;
    const simulation = simulationRef.current;
    if (!canvas || !simulation) return null;
    const bounds = canvas.getBoundingClientRect();
    const camera = cameraRef.current;
    const worldX = (clientX - bounds.left - camera.x) / camera.scale;
    const worldY = (clientY - bounds.top - camera.y) / camera.scale;
    let closest: SimNode | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    simulation.nodes.forEach((node) => {
      if (!renderStateRef.current.visibleIds.has(node.id)) return;
      const distance = Math.hypot(node.x - worldX, node.y - worldY);
      const hitRadius = Math.max(nodeRadius(node) + 5, 10 / camera.scale);
      if (distance <= hitRadius && distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    });
    return closest;
  };

  const activateInteraction = () => {
    activeRef.current = true;
    setInteractionActive(true);
  };

  useEffect(() => {
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        activeRef.current = false;
        setInteractionActive(false);
      }
    };
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!activeRef.current) return;
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * .00125), event.clientX, event.clientY);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const simNodes = createSimulationNodes(nodes, degree);
    const byId = new Map(simNodes.map((node) => [node.id, node]));
    const simulation = { alpha: 1, byId, nodes: simNodes };
    simulationRef.current = simulation;
    let animationFrame = 0;
    let fitTimer = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!didFitRef.current && width > 0) {
        didFitRef.current = true;
        fitTimer = window.setTimeout(() => {
          const camera = cameraForNodes(canvas, simNodes);
          if (!camera) return;
          cameraRef.current = camera;
          setCameraDisplay(camera.scale);
        }, 120);
      }
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const tickSimulation = () => {
      if (simulation.alpha < .012 || dragRef.current?.kind === "pan") return;
      const alpha = simulation.alpha;
      const forces = new Map(simulation.nodes.map((node) => [node.id, { x: 0, y: 0 }]));

      for (let leftIndex = 0; leftIndex < simulation.nodes.length; leftIndex += 1) {
        const left = simulation.nodes[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < simulation.nodes.length; rightIndex += 1) {
          const right = simulation.nodes[rightIndex];
          let dx = right.x - left.x;
          let dy = right.y - left.y;
          let distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < 4) {
            dx = ((stableHash(left.id + right.id) % 17) - 8) * .1;
            dy = ((stableHash(right.id + left.id) % 17) - 8) * .1;
            distanceSquared = Math.max(1, dx * dx + dy * dy);
          }
          const distance = Math.sqrt(distanceSquared);
          const minimumDistance = nodeRadius(left) + nodeRadius(right) + 6;
          const repulsion = 1850 / Math.max(90, distanceSquared) + (distance < minimumDistance ? (minimumDistance - distance) * .055 : 0);
          const unitX = dx / distance;
          const unitY = dy / distance;
          const leftForce = forces.get(left.id)!;
          const rightForce = forces.get(right.id)!;
          leftForce.x -= unitX * repulsion;
          leftForce.y -= unitY * repulsion;
          rightForce.x += unitX * repulsion;
          rightForce.y += unitY * repulsion;
        }
      }

      edges.forEach((edge) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const desired = edge.relation === "belongs-process-group" || edge.relation === "belongs-knowledge-area" ? 88 : edge.relation === "uses" ? 72 : 78;
        const pull = (distance - desired) * .0035;
        const unitX = dx / distance;
        const unitY = dy / distance;
        forces.get(source.id)!.x += unitX * pull;
        forces.get(source.id)!.y += unitY * pull;
        forces.get(target.id)!.x -= unitX * pull;
        forces.get(target.id)!.y -= unitY * pull;
      });

      simulation.nodes.forEach((node) => {
        const force = forces.get(node.id)!;
        force.x += -node.x * .00036;
        force.y += -node.y * .00036;
        node.vx = (node.vx + force.x * alpha) * .84;
        node.vy = (node.vy + force.y * alpha) * .84;
        if (dragRef.current?.kind === "node" && dragRef.current.node?.id === node.id) return;
        node.x += node.vx;
        node.y += node.vy;
      });
      simulation.alpha *= .992;
    };

    const draw = () => {
      tickSimulation();
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#1b1b1b";
      context.fillRect(0, 0, width, height);
      const camera = cameraRef.current;
      const state = renderStateRef.current;
      const focus = state.focusId;

      edges.forEach((edge) => {
        if (!state.visibleIds.has(edge.source) || !state.visibleIds.has(edge.target)) return;
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return;
        const active = Boolean(focus && (edge.source === focus || edge.target === focus));
        context.beginPath();
        context.moveTo(source.x * camera.scale + camera.x, source.y * camera.scale + camera.y);
        context.lineTo(target.x * camera.scale + camera.x, target.y * camera.scale + camera.y);
        context.strokeStyle = active ? "rgba(139, 92, 246, .96)" : focus ? "rgba(190, 190, 190, .035)" : "rgba(185, 185, 185, .17)";
        context.lineWidth = active ? 1.35 : .65;
        context.stroke();
      });

      const occupiedLabels: Array<{ bottom: number; left: number; right: number; top: number }> = [];
      const orderedNodes = [...simulation.nodes].sort((left, right) => left.degree - right.degree);
      orderedNodes.forEach((node) => {
        if (!state.visibleIds.has(node.id)) return;
        const screenX = node.x * camera.scale + camera.x;
        const screenY = node.y * camera.scale + camera.y;
        if (screenX < -40 || screenX > width + 40 || screenY < -40 || screenY > height + 40) return;
        const active = node.id === focus;
        const neighbor = !focus || state.focusNeighbors.has(node.id);
        const radius = Math.max(2, nodeRadius(node) * camera.scale * (active ? 1.55 : 1));
        context.globalAlpha = active ? 1 : neighbor ? .94 : .12;
        context.beginPath();
        context.arc(screenX, screenY, radius, 0, Math.PI * 2);
        context.fillStyle = active ? "#8b5cf6" : state.groupColors ? nodeTypeMeta[node.type].color : "#bdbdbd";
        context.fill();
        if (active) {
          context.strokeStyle = "rgba(221, 214, 254, .95)";
          context.lineWidth = 1.5;
          context.stroke();
          context.beginPath();
          context.arc(screenX, screenY, radius + 5, 0, Math.PI * 2);
          context.strokeStyle = "rgba(139, 92, 246, .28)";
          context.lineWidth = 4;
          context.stroke();
        }

        const labelImportant = node.degree >= 12 && camera.scale >= state.labelThreshold * .68;
        const shouldLabel = active || node.id === hoverRef.current || camera.scale >= state.labelThreshold || labelImportant;
        if (!shouldLabel) return;
        context.font = `${active ? 600 : 500} ${active ? 13 : 11}px system-ui, sans-serif`;
        const textWidth = context.measureText(node.title).width;
        const labelLeft = screenX + radius + 7;
        const labelTop = screenY - 8;
        const box = { left: labelLeft - 3, right: labelLeft + textWidth + 4, top: labelTop - 2, bottom: labelTop + 15 };
        const overlaps = occupiedLabels.some((item) => !(box.right < item.left || box.left > item.right || box.bottom < item.top || box.top > item.bottom));
        if (overlaps && !active && node.id !== hoverRef.current) return;
        occupiedLabels.push(box);
        context.fillStyle = active ? "rgba(16, 16, 16, .9)" : "rgba(27, 27, 27, .78)";
        context.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
        context.fillStyle = active ? "#fff" : "#dedede";
        context.fillText(node.title, labelLeft, labelTop + 11);
      });
      context.globalAlpha = 1;
      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(fitTimer);
      resizeObserver.disconnect();
    };
  }, [degree, edges, nodes]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    activateInteraction();
    const canvas = event.currentTarget;
    const hit = nodeAt(event.clientX, event.clientY);
    if (hit) onSelect(hit, false);
    canvas.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: hit ? "node" : "pan",
      moved: false,
      node: hit ?? undefined,
      originX: hit ? hit.x : cameraRef.current.x,
      originY: hit ? hit.y : cameraRef.current.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      const hit = nodeAt(event.clientX, event.clientY);
      const nextHoveredId = hit?.id ?? null;
      if (nextHoveredId !== hoverRef.current) setHoveredId(nextHoveredId);
      return;
    }
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true;
    if (drag.kind === "pan") {
      cameraRef.current = { ...cameraRef.current, x: drag.originX + deltaX, y: drag.originY + deltaY };
    } else if (drag.node) {
      drag.node.x = drag.originX + deltaX / cameraRef.current.scale;
      drag.node.y = drag.originY + deltaY / cameraRef.current.scale;
      drag.node.vx = 0;
      drag.node.vy = 0;
      if (simulationRef.current) simulationRef.current.alpha = Math.max(.24, simulationRef.current.alpha);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleDoubleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const hit = nodeAt(event.clientX, event.clientY);
    if (hit) onSelect(hit, true);
  };

  const toggleType = (type: StructuredKnowledgeNodeType) => {
    setHiddenTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  };

  return (
    <div className={`canvas-knowledge-graph${interactionActive ? " interaction-active" : ""}`} ref={rootRef} onPointerDown={activateInteraction}>
      <canvas
        ref={canvasRef}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredId(null)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="application"
        aria-label="项目管理知识关系图谱，点击激活滚轮缩放，拖动画布或节点进行探索"
        tabIndex={0}
      />

      <div className="canvas-graph-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索节点、分类或说明" aria-label="搜索知识图谱" />
        {query && <button onClick={() => setQuery("")} aria-label="清空搜索">×</button>}
      </div>

      <div className="canvas-graph-controls" aria-label="图谱视图控制">
        <button onClick={() => zoomAt(1 / 1.25)} aria-label="缩小图谱">−</button>
        <span>{Math.round(cameraDisplay * 100)}%</span>
        <button onClick={() => zoomAt(1.25)} aria-label="放大图谱">＋</button>
        <button onClick={fitVisibleNodes}>全局</button>
        <button className={localDepth ? "active" : ""} onClick={() => setLocalDepth((depth) => depth === 0 ? 1 : depth === 1 ? 2 : 0)} disabled={!selectedId}>
          {localDepth ? `局部 ${localDepth} 跳` : "局部图谱"}
        </button>
      </div>

      <div className="canvas-graph-filters" aria-label="知识类型筛选">
        {nodeTypeOrder.map((type) => (
          <button className={hiddenTypes.includes(type) ? "disabled" : ""} key={type} onClick={() => toggleType(type)}>
            <i style={{ background: nodeTypeMeta[type].color }} />{nodeTypeMeta[type].label}
          </button>
        ))}
      </div>

      <div className="canvas-graph-options">
        <label><span>显字</span><input type="range" min=".45" max="1.6" step=".05" value={labelThreshold} onChange={(event) => setLabelThreshold(Number(event.target.value))} /></label>
        <label><input type="checkbox" checked={groupColors} onChange={(event) => setGroupColors(event.target.checked)} />分组配色</label>
      </div>

      <div className="canvas-graph-mode">
        <strong>{interactionActive ? "图谱滚轮已激活" : "点击图谱以激活滚轮缩放"}</strong>
        <span>{interactionActive ? "点击图谱外任意位置即可恢复页面滚动" : "当前滚轮仍控制页面滚动"}</span>
      </div>

      <div className="canvas-graph-stats">{visibleIds.size} / {nodes.length} 节点 · {visibleEdgeCount} 条关系</div>
    </div>
  );
}
