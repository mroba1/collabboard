import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { BoardObject, CreateBoardObjectInput, PathVariant, ShapeKind } from '@collabboard/shared';
import { useBoardStore } from '../../stores/boardStore';
import { emitCursorMove } from '../../hooks/useBoardSocket';
import { BoardObjectView } from './objects/BoardObjectView';
import { screenToWorld, clampScale, rectsIntersect, type Point } from '../../utils/coords';
import { SHAPE_FILL, SHAPE_STROKE, HIGHLIGHTER_COLOR, inkColor, randomStickyColor } from '../../utils/objectDefaults';
import { intersectRectBoundary } from '../../utils/geometry';
import { throttle } from '../../utils/throttle';
import { TextEditOverlay } from './TextEditOverlay';
import { FloatingFormatToolbar } from './FloatingFormatToolbar';
import { useTheme } from '../../theme/ThemeProvider';
import { canEditBoard } from '../../utils/permissions';
import type { ToolType } from '../../types/tool';
import './Canvas.css';

interface CanvasProps {
  boardId: string;
  stageRef: React.RefObject<Konva.Stage>;
}

type DrawPreview =
  | { kind: 'box'; tool: ToolType; x: number; y: number; width: number; height: number }
  | { kind: 'line'; tool: ToolType; points: number[] }
  | { kind: 'freehand'; tool: ToolType; points: number[] };

const BOX_TOOLS = new Set<ToolType>([
  'rectangle',
  'roundedRectangle',
  'ellipse',
  'circle',
  'triangle',
  'diamond',
  'pentagon',
  'hexagon',
  'star',
  'polygon',
]);
const LINE_TOOLS = new Set<ToolType>(['arrow', 'curvedArrow', 'connector', 'line']);
const FREEHAND_TOOLS = new Set<ToolType>(['pen', 'brush', 'highlighter']);

const SHAPE_KIND_BY_TOOL: Partial<Record<ToolType, ShapeKind>> = {
  triangle: 'triangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  star: 'star',
  polygon: 'polygon',
};

const PATH_VARIANT_BY_TOOL: Partial<Record<ToolType, PathVariant>> = {
  pen: 'pen',
  brush: 'brush',
  highlighter: 'highlighter',
  line: 'line',
};

const TAP_MOVE_THRESHOLD_PX = 6;
const DEFAULT_TEXT_FONT_SIZE = 32;
const MIN_DRAG_SIZE = 4;

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: 'select',
  h: 'pan',
  p: 'pen',
  e: 'eraser',
  s: 'sticky',
  r: 'rectangle',
  o: 'ellipse',
  a: 'arrow',
};

export function Canvas({ boardId, stageRef }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRegistry = useRef(new Map<string, Konva.Group>());
  const transformerRef = useRef<Konva.Transformer>(null);

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [preview, setPreview] = useState<DrawPreview | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const panLast = useRef<Point | null>(null);
  const tapStart = useRef<Point | null>(null);
  const spaceHeld = useRef(false);
  const pinchRef = useRef<{
    startDistance: number;
    startScale: number;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);
  const { resolvedMode } = useTheme();

  const objects = useBoardStore((s) => s.objects);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const viewport = useBoardStore((s) => s.viewport);
  const tool = useBoardStore((s) => s.tool);
  const role = useBoardStore((s) => s.role);
  const setTool = useBoardStore((s) => s.setTool);
  const setViewport = useBoardStore((s) => s.setViewport);
  const setSelected = useBoardStore((s) => s.setSelected);
  const createObject = useBoardStore((s) => s.createObject);
  const updateObject = useBoardStore((s) => s.updateObject);
  const deleteObject = useBoardStore((s) => s.deleteObject);
  const canEdit = canEditBoard(role);

  const objectList = useMemo(() => Object.values(objects).sort((a, b) => a.zIndex - b.zIndex), [objects]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes = selectedIds.map((id) => nodeRegistry.current.get(id)).filter(Boolean) as Konva.Group[];
    transformer.nodes((tool === 'select' || tool === 'pan') && canEdit ? nodes : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, tool, canEdit, objectList.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') spaceHeld.current = true;
      const isTypingTarget = (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT';
      if (isTypingTarget) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useBoardStore.getState().selectAll();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const shortcutTool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (shortcutTool && (shortcutTool === 'select' || shortcutTool === 'pan' || canEdit)) {
          e.preventDefault();
          setTool(shortcutTool);
          return;
        }
      }
      if (!canEdit) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) deleteObject(id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useBoardStore.getState().redo();
        else useBoardStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useBoardStore.getState().redo();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceHeld.current = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [selectedIds, deleteObject, canEdit, setTool]);

  const emitCursorThrottled = useMemo(
    () => throttle((x: number, y: number) => emitCursorMove(boardId, x, y), 40),
    [boardId]
  );

  function pointerWorldPos(): Point {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition() ?? { x: 0, y: 0 };
    return screenToWorld(pos, viewport);
  }

  function getTouchDistance(t1: Touch, t2: Touch): number {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  function getTouchMidpointRelative(t1: Touch, t2: Touch): Point {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: (t1.clientX + t2.clientX) / 2 - (rect?.left ?? 0),
      y: (t1.clientY + t2.clientY) / 2 - (rect?.top ?? 0),
    };
  }

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      if (e.evt.ctrlKey || e.evt.metaKey) {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const oldScale = viewport.scale;
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = clampScale(oldScale * (1 + direction * 0.08));
        const mousePointTo = {
          x: (pointer.x - viewport.x) / oldScale,
          y: (pointer.y - viewport.y) / oldScale,
        };
        setViewport({
          scale: newScale,
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        });
      } else {
        setViewport({ x: viewport.x - e.evt.deltaX, y: viewport.y - e.evt.deltaY });
      }
    },
    [viewport, setViewport, stageRef]
  );

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = stageRef.current;
    if (!stage) return;

    if ('touches' in e.evt && e.evt.touches.length === 2) {
      const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]];
      if (t1 && t2) {
        const midpoint = getTouchMidpointRelative(t1, t2);
        const worldPoint = screenToWorld(midpoint, viewport);
        pinchRef.current = {
          startDistance: getTouchDistance(t1, t2),
          startScale: viewport.scale,
          startWorldX: worldPoint.x,
          startWorldY: worldPoint.y,
        };
      }
      setIsPanning(false);
      setDrawStart(null);
      setPreview(null);
      setMarquee(null);
      return;
    }

    const clickedOnEmpty = e.target === stage;
    const world = pointerWorldPos();
    const screenPos = stage.getPointerPosition() ?? { x: 0, y: 0 };

    if (spaceHeld.current || (e.evt as MouseEvent).button === 1) {
      setIsPanning(true);
      panLast.current = screenPos;
      return;
    }

    if (tool === 'pan') {
      if (clickedOnEmpty) {
        setIsPanning(true);
        panLast.current = screenPos;
        tapStart.current = screenPos;
      }
      // Clicking directly on an object is handled by that object's own
      // select/drag handlers (see BoardObjectView) -- nothing to do here.
      return;
    }

    if (!canEdit && tool !== 'select') return;

    if (tool === 'select') {
      if (clickedOnEmpty) {
        setSelected([]);
        setMarquee({ x: world.x, y: world.y, width: 0, height: 0 });
        setDrawStart(world);
      }
      return;
    }

    if (tool === 'eraser') return;

    if (tool === 'sticky') {
      const obj = createObject({
        type: 'sticky',
        x: world.x - 100,
        y: world.y - 80,
        width: 200,
        height: 160,
        rotation: 0,
        text: '',
        color: randomStickyColor(),
      } as CreateBoardObjectInput);
      setSelected([obj.id]);
      setEditingId(obj.id);
      setTool('pan');
      return;
    }

    if (BOX_TOOLS.has(tool)) {
      setDrawStart(world);
      setPreview({ kind: 'box', tool, x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    if (LINE_TOOLS.has(tool)) {
      setDrawStart(world);
      setPreview({ kind: 'line', tool, points: [0, 0, 0, 0] });
      return;
    }

    if (FREEHAND_TOOLS.has(tool)) {
      setDrawStart(world);
      setPreview({ kind: 'freehand', tool, points: [0, 0] });
    }
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = stageRef.current;
    if (!stage) return;

    if ('touches' in e.evt && e.evt.touches.length === 2 && pinchRef.current) {
      const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]];
      if (t1 && t2) {
        const { startDistance, startScale, startWorldX, startWorldY } = pinchRef.current;
        const distance = getTouchDistance(t1, t2);
        const newScale = clampScale(startScale * (distance / startDistance));
        const midpoint = getTouchMidpointRelative(t1, t2);
        setViewport({
          scale: newScale,
          x: midpoint.x - startWorldX * newScale,
          y: midpoint.y - startWorldY * newScale,
        });
      }
      return;
    }

    const screenPos = stage.getPointerPosition();
    if (!screenPos) return;
    const world = screenToWorld(screenPos, viewport);

    emitCursorThrottled(world.x, world.y);

    if (isPanning && panLast.current) {
      const dx = screenPos.x - panLast.current.x;
      const dy = screenPos.y - panLast.current.y;
      setViewport({ x: viewport.x + dx, y: viewport.y + dy });
      panLast.current = screenPos;
      return;
    }

    if (marquee && drawStart) {
      setMarquee({
        x: Math.min(drawStart.x, world.x),
        y: Math.min(drawStart.y, world.y),
        width: Math.abs(world.x - drawStart.x),
        height: Math.abs(world.y - drawStart.y),
      });
      return;
    }

    if (!preview || !drawStart) return;

    if (preview.kind === 'box') {
      let rawDx = world.x - drawStart.x;
      let rawDy = world.y - drawStart.y;
      if (preview.tool === 'circle') {
        // Constrain to a perfect circle while drawing (still resizable into
        // an ellipse afterward via the transform handles, like most tools).
        const size = Math.max(Math.abs(rawDx), Math.abs(rawDy));
        rawDx = Math.sign(rawDx || 1) * size;
        rawDy = Math.sign(rawDy || 1) * size;
      }
      setPreview({
        ...preview,
        x: Math.min(drawStart.x, drawStart.x + rawDx),
        y: Math.min(drawStart.y, drawStart.y + rawDy),
        width: Math.abs(rawDx),
        height: Math.abs(rawDy),
      });
    } else if (preview.kind === 'line') {
      setPreview({ ...preview, points: [0, 0, world.x - drawStart.x, world.y - drawStart.y] });
    } else if (preview.kind === 'freehand') {
      setPreview({ ...preview, points: [...preview.points, world.x - drawStart.x, world.y - drawStart.y] });
    }
  }

  function handleMouseUp(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if ('touches' in e.evt && e.evt.touches.length < 2 && pinchRef.current) {
      pinchRef.current = null;
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      panLast.current = null;

      if (tool === 'pan' && tapStart.current && canEdit) {
        const stage = stageRef.current;
        const upPos = stage?.getPointerPosition();
        const start = tapStart.current;
        if (upPos && Math.hypot(upPos.x - start.x, upPos.y - start.y) < TAP_MOVE_THRESHOLD_PX) {
          const world = screenToWorld(start, viewport);
          const obj = createObject({
            type: 'text',
            x: world.x,
            y: world.y,
            width: 300,
            height: 60,
            rotation: 0,
            text: '',
            fontSize: DEFAULT_TEXT_FONT_SIZE,
            fill: inkColor(resolvedMode),
          } as CreateBoardObjectInput);
          setSelected([obj.id]);
          setEditingId(obj.id);
        }
      }
      tapStart.current = null;
      return;
    }

    if (marquee) {
      const ids = objectList.filter((o) => rectsIntersect(marquee, o)).map((o) => o.id);
      setSelected(ids);
      setMarquee(null);
      setDrawStart(null);
      return;
    }

    if (preview && drawStart) {
      if (preview.kind === 'box' && preview.width > MIN_DRAG_SIZE && preview.height > MIN_DRAG_SIZE) {
        finalizeBoxObject(preview.tool, preview.x, preview.y, preview.width, preview.height);
      } else if (preview.kind === 'line') {
        finalizeLineObject(preview.tool, drawStart, preview.points);
      } else if (preview.kind === 'freehand' && preview.points.length > 3) {
        finalizeFreehandObject(preview.tool, drawStart, preview.points);
      }
    }

    setPreview(null);
    setDrawStart(null);
  }

  function finalizeBoxObject(tool: ToolType, x: number, y: number, width: number, height: number): void {
    if (tool === 'rectangle' || tool === 'roundedRectangle') {
      createObject({
        type: 'rectangle',
        x,
        y,
        width,
        height,
        rotation: 0,
        fill: SHAPE_FILL,
        stroke: SHAPE_STROKE,
        strokeWidth: 2,
        cornerRadius: tool === 'roundedRectangle' ? Math.min(20, Math.min(width, height) / 3) : 0,
      } as CreateBoardObjectInput);
      return;
    }

    if (tool === 'ellipse' || tool === 'circle') {
      createObject({
        type: 'ellipse',
        x,
        y,
        width,
        height,
        rotation: 0,
        fill: SHAPE_FILL,
        stroke: SHAPE_STROKE,
        strokeWidth: 2,
      } as CreateBoardObjectInput);
      return;
    }

    const shapeKind = SHAPE_KIND_BY_TOOL[tool];
    if (!shapeKind) return;
    createObject({
      type: 'shape',
      shapeKind,
      x,
      y,
      width,
      height,
      rotation: 0,
      fill: SHAPE_FILL,
      stroke: SHAPE_STROKE,
      strokeWidth: 2,
      ...(shapeKind === 'polygon' ? { sides: 5 } : {}),
    } as CreateBoardObjectInput);
  }

  function buildCurvedPoints(points: number[]): number[] {
    const endX = points[2] ?? 0;
    const endY = points[3] ?? 0;
    const len = Math.hypot(endX, endY) || 1;
    const bow = Math.min(60, len * 0.25);
    const perpX = (-endY / len) * bow;
    const perpY = (endX / len) * bow;
    return [0, 0, endX / 2 + perpX, endY / 2 + perpY, endX, endY];
  }

  /** Topmost non-line object whose bounding box contains a world point (axis-aligned, ignores rotation). Used to snap connector endpoints to a shape. */
  function findShapeAtPoint(point: Point): BoardObject | null {
    for (let i = objectList.length - 1; i >= 0; i--) {
      const o = objectList[i];
      if (!o || o.type === 'arrow' || o.type === 'path') continue;
      if (point.x >= o.x && point.x <= o.x + o.width && point.y >= o.y && point.y <= o.y + o.height) {
        return o;
      }
    }
    return null;
  }

  function finalizeLineObject(tool: ToolType, start: Point, relativePoints: number[]): void {
    const endX = relativePoints[2] ?? 0;
    const endY = relativePoints[3] ?? 0;
    if (Math.hypot(endX, endY) <= MIN_DRAG_SIZE) return;

    if (tool === 'connector') {
      finalizeConnector(start, { x: start.x + endX, y: start.y + endY });
      return;
    }

    if (tool === 'line') {
      createObject({
        type: 'path',
        variant: 'line',
        x: start.x,
        y: start.y,
        width: Math.abs(endX),
        height: Math.abs(endY),
        rotation: 0,
        points: relativePoints,
        stroke: inkColor(resolvedMode),
        strokeWidth: 3,
      } as CreateBoardObjectInput);
      return;
    }

    const curved = tool === 'curvedArrow';
    const points = curved ? buildCurvedPoints(relativePoints) : relativePoints;
    createObject({
      type: 'arrow',
      x: start.x,
      y: start.y,
      width: Math.abs(endX),
      height: Math.abs(endY),
      rotation: 0,
      points,
      curved,
      stroke: inkColor(resolvedMode),
      strokeWidth: 3,
    } as CreateBoardObjectInput);
  }

  function finalizeConnector(startWorld: Point, endWorld: Point): void {
    const fromShape = findShapeAtPoint(startWorld);
    const toShape = findShapeAtPoint(endWorld);

    let start = startWorld;
    let end = endWorld;

    if (fromShape) {
      start = intersectRectBoundary(
        fromShape.x + fromShape.width / 2,
        fromShape.y + fromShape.height / 2,
        fromShape.width / 2,
        fromShape.height / 2,
        endWorld.x,
        endWorld.y
      );
    }
    if (toShape) {
      end = intersectRectBoundary(
        toShape.x + toShape.width / 2,
        toShape.y + toShape.height / 2,
        toShape.width / 2,
        toShape.height / 2,
        startWorld.x,
        startWorld.y
      );
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.hypot(dx, dy) <= MIN_DRAG_SIZE) return;

    createObject({
      type: 'arrow',
      x: start.x,
      y: start.y,
      width: Math.abs(dx),
      height: Math.abs(dy),
      rotation: 0,
      points: [0, 0, dx, dy],
      stroke: inkColor(resolvedMode),
      strokeWidth: 2,
      connectorFrom: fromShape?.id,
      connectorTo: toShape?.id,
    } as CreateBoardObjectInput);
  }

  function finalizeFreehandObject(tool: ToolType, start: Point, points: number[]): void {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      xs.push(points[i] ?? 0);
      ys.push(points[i + 1] ?? 0);
    }
    const variant = PATH_VARIANT_BY_TOOL[tool] ?? 'pen';
    const strokeWidth = variant === 'brush' ? 10 : variant === 'highlighter' ? 22 : 3;
    createObject({
      type: 'path',
      variant,
      x: start.x,
      y: start.y,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      rotation: 0,
      points,
      stroke: variant === 'highlighter' ? HIGHLIGHTER_COLOR : inkColor(resolvedMode),
      strokeWidth,
    } as CreateBoardObjectInput);
  }

  const editingObject = editingId ? objects[editingId] : null;
  const selectedSingle = selectedIds.length === 1 ? objects[selectedIds[0] as string] : null;
  const formatTarget =
    canEdit && selectedSingle && (selectedSingle.type === 'text' || selectedSingle.type === 'sticky')
      ? selectedSingle
      : null;

  return (
    <div className="canvas-container" ref={containerRef}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        onDblClick={() => undefined}
        className={`board-stage tool-${tool}`}
      >
        <Layer>
          {objectList.map((object: BoardObject) => (
            <BoardObjectView
              key={object.id}
              object={object}
              isSelected={selectedIds.includes(object.id)}
              tool={tool}
              canEdit={canEdit}
              onSelect={() => setSelected([object.id])}
              onDragEnd={(x, y) => updateObject(object.id, { x, y })}
              onTransformEnd={(attrs) => updateObject(object.id, attrs)}
              onDblClick={() => {
                if (!canEdit) return;
                if (object.type === 'text' || object.type === 'sticky') {
                  setSelected([object.id]);
                  setEditingId(object.id);
                }
                if (tool === 'eraser') deleteObject(object.id);
              }}
              registerNode={(id, node) => {
                if (node) nodeRegistry.current.set(id, node);
                else nodeRegistry.current.delete(id);
              }}
            />
          ))}

          {preview && preview.kind === 'box' && (
            <Rect
              x={preview.x}
              y={preview.y}
              width={preview.width}
              height={preview.height}
              stroke={SHAPE_STROKE}
              dash={[6, 4]}
              listening={false}
            />
          )}

          {preview && preview.kind === 'line' && drawStart && (
            <Line
              x={drawStart.x}
              y={drawStart.y}
              points={preview.points}
              stroke={inkColor(resolvedMode)}
              strokeWidth={2}
              dash={[8, 6]}
              listening={false}
            />
          )}

          {preview && preview.kind === 'freehand' && drawStart && (
            <Line
              x={drawStart.x}
              y={drawStart.y}
              points={preview.points}
              stroke={preview.tool === 'highlighter' ? HIGHLIGHTER_COLOR : inkColor(resolvedMode)}
              strokeWidth={preview.tool === 'brush' ? 10 : preview.tool === 'highlighter' ? 22 : 3}
              opacity={preview.tool === 'highlighter' ? 0.35 : 1}
              lineCap="round"
              lineJoin="round"
              tension={0.4}
              listening={false}
            />
          )}

          {marquee && (
            <Rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              stroke="#3b82f6"
              fill="rgba(59,130,246,0.08)"
              listening={false}
            />
          )}

          <Transformer
            ref={transformerRef}
            rotateEnabled
            borderStroke="#3b82f6"
            anchorStroke="#3b82f6"
            anchorFill="#ffffff"
            flipEnabled={false}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>

      {editingObject && (editingObject.type === 'text' || editingObject.type === 'sticky') && (
        <TextEditOverlay
          object={editingObject}
          viewport={viewport}
          onChange={(text) => {
            if (editingObject.type === 'text' && text.trim() === '') {
              deleteObject(editingObject.id);
            } else {
              updateObject(editingObject.id, { text } as Partial<BoardObject>);
            }
          }}
          onClose={() => setEditingId(null)}
        />
      )}

      {formatTarget && (
        <FloatingFormatToolbar
          object={formatTarget}
          viewport={viewport}
          onChange={(changes) => updateObject(formatTarget.id, changes as Partial<BoardObject>)}
        />
      )}
    </div>
  );
}
