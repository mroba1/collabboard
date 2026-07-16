import type { BoardObject } from '@collabboard/shared';
import { worldToScreen } from '../../utils/coords';
import './FloatingFormatToolbar.css';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

type ColorableObject = Extract<BoardObject, { type: 'rectangle' | 'ellipse' | 'shape' | 'path' | 'arrow' }>;

interface ShapeColorToolbarProps {
  object: ColorableObject;
  viewport: Viewport;
  onChange: (changes: Record<string, unknown>) => void;
}

const FILL_COLORS = ['#e0f2fe', '#dcfce7', '#fef9c3', '#fee2e2', '#f3e8ff', '#ffe4e6', '#e2e8f0', 'transparent'];
const STROKE_COLORS = ['#0284c7', '#111827', '#16a34a', '#dc2626', '#7c3aed', '#db2777', '#64748b', '#f8fafc'];

export function ShapeColorToolbar({ object, viewport, onChange }: ShapeColorToolbarProps) {
  const hasFill = object.type === 'rectangle' || object.type === 'ellipse' || object.type === 'shape';
  const currentFill = object.fill ?? '#ffffff';
  const currentStroke = object.stroke ?? '#111827';

  const anchor = worldToScreen({ x: object.x + object.width / 2, y: object.y }, viewport);
  const halfWidth = Math.min(150, typeof window !== 'undefined' ? window.innerWidth / 2 - 8 : 150);
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : anchor.x + halfWidth;
  const left = Math.min(Math.max(anchor.x, halfWidth), viewportWidth - halfWidth);
  const top = Math.max(8, anchor.y - 52);

  return (
    <div className="format-toolbar" style={{ left, top }} onMouseDown={(e) => e.preventDefault()}>
      {hasFill && (
        <>
          <span className="format-color-group-label">Fill</span>
          <div className="format-colors">
            {FILL_COLORS.map((color) => (
              <button
                key={color}
                className={`format-color-swatch ${currentFill === color ? 'active' : ''}`}
                style={{ background: color === 'transparent' ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 8px 8px' : color }}
                title={color === 'transparent' ? 'No fill' : color}
                onClick={() => onChange({ fill: color })}
              />
            ))}
          </div>
          <div className="format-divider" />
        </>
      )}

      <span className="format-color-group-label">{hasFill ? 'Border' : 'Color'}</span>
      <div className="format-colors">
        {STROKE_COLORS.map((color) => (
          <button
            key={color}
            className={`format-color-swatch ${currentStroke === color ? 'active' : ''}`}
            style={{ background: color }}
            title={color}
            onClick={() => onChange({ stroke: color })}
          />
        ))}
      </div>
    </div>
  );
}
