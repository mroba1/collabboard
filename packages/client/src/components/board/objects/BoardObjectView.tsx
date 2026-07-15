import {
  Group,
  Rect,
  Ellipse,
  Line,
  Arrow as KonvaArrow,
  Text as KonvaText,
  Image as KonvaImage,
  RegularPolygon,
  Star,
} from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { BoardObject, PathVariant, ShapeObject } from '@collabboard/shared';
import type { ToolType } from '../../../types/tool';

export interface TransformResult {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface BoardObjectViewProps {
  object: BoardObject;
  isSelected: boolean;
  tool: ToolType;
  canEdit: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (attrs: TransformResult) => void;
  onDblClick: () => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

function ImageContent({ src, width, height }: { src: string; width: number; height: number }) {
  const [img] = useImage(src);
  return <KonvaImage image={img} width={width} height={height} listening={false} />;
}

function konvaFontStyle(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return 'italic bold';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function pathStrokeDefaults(variant?: PathVariant): { strokeWidth: number; opacity: number } {
  switch (variant) {
    case 'brush':
      return { strokeWidth: 10, opacity: 1 };
    case 'highlighter':
      return { strokeWidth: 22, opacity: 0.35 };
    default:
      return { strokeWidth: 3, opacity: 1 };
  }
}

function sidesForShape(shape: ShapeObject): number {
  switch (shape.shapeKind) {
    case 'triangle':
      return 3;
    case 'diamond':
      return 4;
    case 'pentagon':
      return 5;
    case 'hexagon':
      return 6;
    case 'polygon':
      return Math.max(3, shape.sides ?? 5);
    default:
      return 5;
  }
}

const SHAPE_BASE_RADIUS = 50;

function ShapeContent({ shape }: { shape: ShapeObject }) {
  const scaleX = shape.width / (SHAPE_BASE_RADIUS * 2);
  const scaleY = shape.height / (SHAPE_BASE_RADIUS * 2);
  const fill = shape.fill ?? '#ffffff';
  const stroke = shape.stroke ?? '#334155';
  const strokeWidth = shape.strokeWidth ?? 2;

  return (
    <Group x={shape.width / 2} y={shape.height / 2} scaleX={scaleX} scaleY={scaleY}>
      {shape.shapeKind === 'star' ? (
        <Star
          numPoints={5}
          innerRadius={SHAPE_BASE_RADIUS * 0.5}
          outerRadius={SHAPE_BASE_RADIUS}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeScaleEnabled={false}
        />
      ) : (
        <RegularPolygon
          sides={sidesForShape(shape)}
          radius={SHAPE_BASE_RADIUS}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeScaleEnabled={false}
        />
      )}
    </Group>
  );
}

export function BoardObjectView({
  object,
  isSelected,
  tool,
  canEdit,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDblClick,
  registerNode,
}: BoardObjectViewProps) {
  const interactive = tool === 'select' || tool === 'pan' || tool === 'eraser';
  const canDrag = tool === 'select' || tool === 'pan';
  const canResize = canEdit && object.type !== 'path' && object.type !== 'arrow';

  function handleTransformEnd(e: { target: Konva.Node }) {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const width = Math.max(8, object.width * scaleX);
    const height = Math.max(8, object.height * scaleY);
    node.scaleX(1);
    node.scaleY(1);
    onTransformEnd({ x: node.x(), y: node.y(), width, height, rotation: node.rotation() });
  }

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      draggable={interactive && canDrag && canEdit}
      listening={interactive}
      opacity={object.opacity ?? 1}
      ref={(node) => registerNode(object.id, node)}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransformEnd={canResize ? handleTransformEnd : undefined}
    >
      {object.type === 'rectangle' && (
        <Rect
          width={object.width}
          height={object.height}
          fill={object.fill ?? '#ffffff'}
          stroke={object.stroke ?? '#334155'}
          strokeWidth={object.strokeWidth ?? 2}
          cornerRadius={object.cornerRadius ?? 6}
        />
      )}

      {object.type === 'ellipse' && (
        <Ellipse
          x={object.width / 2}
          y={object.height / 2}
          radiusX={object.width / 2}
          radiusY={object.height / 2}
          fill={object.fill ?? '#ffffff'}
          stroke={object.stroke ?? '#334155'}
          strokeWidth={object.strokeWidth ?? 2}
        />
      )}

      {object.type === 'path' &&
        (() => {
          const defaults = pathStrokeDefaults(object.variant);
          return (
            <Line
              points={object.points}
              stroke={object.stroke ?? '#111827'}
              strokeWidth={object.strokeWidth ?? defaults.strokeWidth}
              opacity={(object.opacity ?? 1) * defaults.opacity}
              lineCap="round"
              lineJoin="round"
              tension={object.variant === 'line' ? 0 : 0.4}
            />
          );
        })()}

      {object.type === 'shape' && <ShapeContent shape={object} />}

      {object.type === 'arrow' && (
        <KonvaArrow
          points={object.points}
          stroke={object.stroke ?? '#111827'}
          fill={object.stroke ?? '#111827'}
          strokeWidth={object.strokeWidth ?? 3}
          tension={object.curved ? 0.5 : 0}
          pointerLength={12}
          pointerWidth={12}
        />
      )}

      {object.type === 'text' && (
        <KonvaText
          text={object.text}
          width={object.width}
          height={object.height}
          fontSize={object.fontSize}
          fontFamily={object.fontFamily ?? 'inherit'}
          fontStyle={konvaFontStyle(object.bold, object.italic)}
          textDecoration={object.underline ? 'underline' : ''}
          align={object.align ?? 'left'}
          fill={object.fill ?? '#111827'}
          wrap="word"
        />
      )}

      {object.type === 'sticky' && (
        <>
          <Rect
            width={object.width}
            height={object.height}
            fill={object.color}
            shadowColor="rgba(0,0,0,0.15)"
            shadowBlur={8}
            shadowOffsetY={3}
            cornerRadius={2}
          />
          <KonvaText
            text={object.text}
            width={object.width - 20}
            height={object.height - 20}
            x={10}
            y={10}
            fontSize={object.fontSize ?? 16}
            fontStyle={konvaFontStyle(object.bold, object.italic)}
            textDecoration={object.underline ? 'underline' : ''}
            align={object.align ?? 'left'}
            fill={object.textColor ?? '#1f2937'}
            wrap="word"
          />
        </>
      )}

      {object.type === 'image' && <ImageContent src={object.src} width={object.width} height={object.height} />}

      {isSelected && (
        <Rect
          width={object.width}
          height={object.height}
          stroke="#3b82f6"
          strokeWidth={1.5}
          dash={[6, 4]}
          listening={false}
        />
      )}
    </Group>
  );
}
