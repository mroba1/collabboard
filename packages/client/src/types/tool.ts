export type ToolType =
  | 'select'
  | 'pan'
  | 'pen'
  | 'brush'
  | 'highlighter'
  | 'eraser'
  | 'sticky'
  | 'image'
  | 'rectangle'
  | 'roundedRectangle'
  | 'ellipse'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'polygon'
  | 'line'
  | 'arrow'
  | 'curvedArrow'
  | 'connector';

/** Tools shown directly in the main toolbar (everything else lives in the "more tools" overflow menu). */
export const PRIMARY_TOOLS: ToolType[] = [
  'pan',
  'select',
  'pen',
  'eraser',
  'sticky',
  'rectangle',
  'ellipse',
  'arrow',
];

/** Freehand drawing tools that use the same continuous-sampling gesture, differing only in stroke styling. */
export const FREEHAND_TOOLS: ToolType[] = ['pen', 'brush', 'highlighter'];

/** Tools that produce a ShapeObject (polygon-family), keyed to their shapeKind. */
export const POLYGON_TOOL_KIND = {
  triangle: 'triangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  star: 'star',
  polygon: 'polygon',
} as const;
