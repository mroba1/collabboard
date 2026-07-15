/** Point where a ray from a rectangle's center toward (towardX, towardY) crosses the rectangle's edge. Used to clip arrow/connector endpoints to a shape's boundary instead of its center. */
export function intersectRectBoundary(
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
