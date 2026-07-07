import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { BoardObject, CreateBoardObjectInput } from '@collabboard/shared';
import { useBoardStore } from '../../stores/boardStore';
import { emitCursorMove } from '../../hooks/useBoardSocket';
import { BoardObjectView } from './objects/BoardObjectView';
import { screenToWorld, clampScale, rectsIntersect, type Point } from '../../utils/coords';
import { SHAPE_FILL, SHAPE_STROKE, inkColor, randomStickyColor } from '../../utils/objectDefaults';
import { throttle } from '../../utils/throttle';
import { TextEditOverlay } from './TextEditOverlay';
import { useTheme } from '../../theme/ThemeProvider';
import { canEditBoard } from '../../utils/permissions';
import './Canvas.css';

interface CanvasProps {
  boardId: string;
  stageRef: React.RefObject<Konva.Stage>;
}

type DrawPreview =
  | { kind: 'rectangle' | 'ellipse'; x: number; y: number; width: number; height: number }
  | { kind: 'arrow'; points: number[] }
  | { kind: 'path'; points: number[] };

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
    transformer.nodes(tool === 'select' && canEdit ? nodes : []);
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
  }, [selectedIds, deleteObject, canEdit]);

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

    if (tool === 'pan' || spaceHeld.current || (e.evt as MouseEvent).button === 1) {
      setIsPanning(true);
      panLast.current = screenPos;
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

    if (tool === 'text') {
      const obj = createObject({
        type: 'text',
        x: world.x,
        y: world.y,
        width: 220,
        height: 40,
        rotation: 0,
        text: 'Double-click to edit',
        fontSize: 22,
        fill: inkColor(resolvedMode),
      } as CreateBoardObjectInput);
      setSelected([obj.id]);
      setEditingId(obj.id);
      setTool('select');
      return;
    }

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
      setTool('select');
      return;
    }

    if (tool === 'rectangle' || tool === 'ellipse') {
      setDrawStart(world);
      setPreview({ kind: tool, x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    if (tool === 'arrow') {
      setDrawStart(world);
      setPreview({ kind: 'arrow', points: [0, 0, 0, 0] });
      return;
    }

    if (tool === 'pen') {
      setDrawStart(world);
      setPreview({ kind: 'path', points: [0, 0] });
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

    if (preview.kind === 'rectangle' || preview.kind === 'ellipse') {
      setPreview({
        kind: preview.kind,
        x: Math.min(drawStart.x, world.x),
        y: Math.min(drawStart.y, world.y),
        width: Math.abs(world.x - drawStart.x),
        height: Math.abs(world.y - drawStart.y),
      });
    } else if (preview.kind === 'arrow') {
      setPreview({ kind: 'arrow', points: [0, 0, world.x - drawStart.x, world.y - drawStart.y] });
    } else if (preview.kind === 'path') {
      setPreview({ kind: 'path', points: [...preview.points, world.x - drawStart.x, world.y - drawStart.y] });
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
      if (preview.kind === 'rectangle' && preview.width > 4 && preview.height > 4) {
        createObject({
          type: 'rectangle',
          x: preview.x,
          y: preview.y,
          width: preview.width,
          height: preview.height,
          rotation: 0,
          fill: SHAPE_FILL,
          stroke: SHAPE_STROKE,
          strokeWidth: 2,
          cornerRadius: 6,
        } as CreateBoardObjectInput);
      } else if (preview.kind === 'ellipse' && preview.width > 4 && preview.height > 4) {
        createObject({
          type: 'ellipse',
          x: preview.x,
          y: preview.y,
          width: preview.width,
          height: preview.height,
          rotation: 0,
          fill: SHAPE_FILL,
          stroke: SHAPE_STROKE,
          strokeWidth: 2,
        } as CreateBoardObjectInput);
      } else if (preview.kind === 'arrow') {
        const [, , ex, ey] = preview.points;
        if (Math.hypot(ex ?? 0, ey ?? 0) > 4) {
          createObject({
            type: 'arrow',
            x: drawStart.x,
            y: drawStart.y,
            width: Math.abs(ex ?? 0),
            height: Math.abs(ey ?? 0),
            rotation: 0,
            points: preview.points,
            stroke: inkColor(resolvedMode),
            strokeWidth: 3,
          } as CreateBoardObjectInput);
        }
      } else if (preview.kind === 'path' && preview.points.length > 3) {
        const xs = [];
        const ys = [];
        for (let i = 0; i < preview.points.length; i += 2) {
          xs.push(preview.points[i] ?? 0);
          ys.push(preview.points[i + 1] ?? 0);
        }
        createObject({
          type: 'path',
          x: drawStart.x,
          y: drawStart.y,
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
          rotation: 0,
          points: preview.points,
          stroke: inkColor(resolvedMode),
          strokeWidth: 3,
        } as CreateBoardObjectInput);
      }
    }

    setPreview(null);
    setDrawStart(null);
  }

  const editingObject = editingId ? objects[editingId] : null;

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

          {preview && (preview.kind === 'rectangle' || preview.kind === 'ellipse') && (
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
          onChange={(text) => updateObject(editingObject.id, { text } as Partial<BoardObject>)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
