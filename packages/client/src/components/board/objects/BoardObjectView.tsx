import { Group, Rect, Ellipse, Line, Arrow as KonvaArrow, Text as KonvaText, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { BoardObject } from '@collabboard/shared';
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

export function BoardObjectView({
  object,
  isSelected,
  tool,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDblClick,
  registerNode,
}: BoardObjectViewProps) {
  const interactive = tool === 'select' || tool === 'eraser';
  const canResize = object.type !== 'path' && object.type !== 'arrow';

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
      draggable={interactive && tool === 'select'}
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

      {object.type === 'path' && (
        <Line
          points={object.points}
          stroke={object.stroke ?? '#111827'}
          strokeWidth={object.strokeWidth ?? 3}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
        />
      )}

      {object.type === 'arrow' && (
        <KonvaArrow
          points={object.points}
          stroke={object.stroke ?? '#111827'}
          fill={object.stroke ?? '#111827'}
          strokeWidth={object.strokeWidth ?? 3}
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
          align={object.align ?? 'left'}
          fill={object.fill ?? '#111827'}
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
            fontSize={16}
            fill="#1f2937"
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
