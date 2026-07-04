import dagre from 'dagre';
import type { AIDiagramEdge, AIDiagramNode, CreateBoardObjectInput, DiagramType } from '@collabboard/shared';
import { randomStickyColor } from './objectDefaults';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 110;

function intersectRectBoundary(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  towardX: number,
  towardY: number
): { x: number; y: number } {
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(scaleX, scaleY);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function layoutDiagram(
  nodes: AIDiagramNode[],
  edges: AIDiagramEdge[],
  diagramType: DiagramType,
  originX: number,
  originY: number
): CreateBoardObjectInput[] {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: diagramType === 'mindmap' ? 'LR' : 'TB',
    nodesep: 50,
    ranksep: 90,
    marginx: 20,
    marginy: 20,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const centers = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = graph.node(node.id) as { x: number; y: number } | undefined;
    centers.set(node.id, { x: originX + (pos?.x ?? 0), y: originY + (pos?.y ?? 0) });
  }

  const objects: CreateBoardObjectInput[] = [];

  for (const edge of edges) {
    const from = centers.get(edge.from);
    const to = centers.get(edge.to);
    if (!from || !to) continue;

    const start = intersectRectBoundary(from.x, from.y, NODE_WIDTH / 2, NODE_HEIGHT / 2, to.x, to.y);
    const end = intersectRectBoundary(to.x, to.y, NODE_WIDTH / 2, NODE_HEIGHT / 2, from.x, from.y);

    objects.push({
      type: 'arrow',
      x: start.x,
      y: start.y,
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
      rotation: 0,
      points: [0, 0, end.x - start.x, end.y - start.y],
      stroke: '#475569',
      strokeWidth: 2,
    });
  }

  const color = randomStickyColor();
  for (const node of nodes) {
    const center = centers.get(node.id);
    if (!center) continue;
    objects.push({
      type: 'sticky',
      x: center.x - NODE_WIDTH / 2,
      y: center.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rotation: 0,
      text: node.label,
      color,
    });
  }

  return objects;
}
