import type { BoardObject } from '@collabboard/shared';

interface DigestObject {
  id: string;
  label: string;
  region: string;
}

function regionFor(x: number, y: number, minX: number, minY: number, maxX: number, maxY: number): string {
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const nx = (x - minX) / w;
  const ny = (y - minY) / h;
  const vertical = ny < 0.34 ? 'top' : ny > 0.66 ? 'bottom' : 'middle';
  const horizontal = nx < 0.34 ? 'left' : nx > 0.66 ? 'right' : 'center';
  return `${vertical}-${horizontal}`;
}

function labelFor(obj: BoardObject): string {
  switch (obj.type) {
    case 'text':
      return `Text("${obj.text}")`;
    case 'sticky':
      return `Sticky note("${obj.text}")`;
    case 'rectangle':
      return 'Rectangle shape';
    case 'ellipse':
      return 'Ellipse shape';
    case 'image':
      return 'Image';
    case 'arrow':
      return 'Arrow';
    case 'path':
      return 'Freehand drawing';
    default:
      return 'Object';
  }
}

function nearestObject(
  px: number,
  py: number,
  candidates: { id: string; label: string; cx: number; cy: number }[]
): string | null {
  let best: { id: string; label: string } | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = Math.hypot(c.cx - px, c.cy - py);
    if (dist < bestDist) {
      bestDist = dist;
      best = { id: c.id, label: c.label };
    }
  }
  return best ? `${best.label} [${best.id.slice(0, 6)}]` : null;
}

export function buildBoardDigest(objects: BoardObject[]): string {
  if (objects.length === 0) {
    return 'The board is currently empty. No shapes, text, or notes have been added yet.';
  }

  const xs = objects.map((o) => o.x);
  const ys = objects.map((o) => o.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...objects.map((o) => o.x + o.width));
  const maxY = Math.max(...objects.map((o) => o.y + o.height));

  const shapeCandidates = objects
    .filter((o) => o.type !== 'arrow')
    .map((o) => ({
      id: o.id,
      label: labelFor(o),
      cx: o.x + o.width / 2,
      cy: o.y + o.height / 2,
    }));

  const lines: string[] = [];
  const digestItems: DigestObject[] = [];

  for (const obj of objects) {
    if (obj.type === 'arrow') continue;
    const region = regionFor(obj.x + obj.width / 2, obj.y + obj.height / 2, minX, minY, maxX, maxY);
    digestItems.push({ id: obj.id, label: labelFor(obj), region });
    lines.push(`- [${obj.id.slice(0, 6)}] ${labelFor(obj)} (position: ${region})`);
  }

  for (const obj of objects) {
    if (obj.type !== 'arrow') continue;
    const points = obj.points;
    if (points.length < 4) continue;
    const startX = obj.x + (points[0] ?? 0);
    const startY = obj.y + (points[1] ?? 0);
    const endX = obj.x + (points[points.length - 2] ?? 0);
    const endY = obj.y + (points[points.length - 1] ?? 0);
    const from = nearestObject(startX, startY, shapeCandidates);
    const to = nearestObject(endX, endY, shapeCandidates);
    if (from && to) {
      lines.push(`- Arrow connects ${from} -> ${to}`);
    }
  }

  return [
    `The whiteboard contains ${objects.length} objects.`,
    'Objects and their approximate layout:',
    ...lines,
  ].join('\n');
}
