import type { BoardObject } from '@collabboard/shared';
import { worldToScreen } from '../../utils/coords';
import './FloatingFormatToolbar.css';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface FloatingFormatToolbarProps {
  object: Extract<BoardObject, { type: 'text' | 'sticky' }>;
  viewport: Viewport;
  onChange: (changes: Record<string, unknown>) => void;
}

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 96;
const FONT_SIZE_STEP = 4;

const TEXT_COLORS = ['#111827', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];

export function FloatingFormatToolbar({ object, viewport, onChange }: FloatingFormatToolbarProps) {
  const isSticky = object.type === 'sticky';
  const fontSize = object.fontSize ?? 16;
  const align = object.align ?? 'left';
  const colorField = isSticky ? 'textColor' : 'fill';
  const currentColor = isSticky ? (object.textColor ?? '#1f2937') : (object.fill ?? '#111827');

  const anchor = worldToScreen({ x: object.x + object.width / 2, y: object.y }, viewport);
  // Clamp so the toolbar (roughly 300px wide, centered on `left` via
  // translateX(-50%)) can't render off-screen when the object is near the
  // canvas edge -- a common case on narrow phone screens.
  const halfWidth = Math.min(150, typeof window !== 'undefined' ? window.innerWidth / 2 - 8 : 150);
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : anchor.x + halfWidth;
  const left = Math.min(Math.max(anchor.x, halfWidth), viewportWidth - halfWidth);
  const top = Math.max(8, anchor.y - 52);

  return (
    <div className="format-toolbar" style={{ left, top }} onMouseDown={(e) => e.preventDefault()}>
      <button
        className={`format-btn ${object.bold ? 'active' : ''}`}
        title="Bold"
        onClick={() => onChange({ bold: !object.bold })}
      >
        <strong>B</strong>
      </button>
      <button
        className={`format-btn ${object.italic ? 'active' : ''}`}
        title="Italic"
        onClick={() => onChange({ italic: !object.italic })}
      >
        <em>I</em>
      </button>
      <button
        className={`format-btn ${object.underline ? 'active' : ''}`}
        title="Underline"
        onClick={() => onChange({ underline: !object.underline })}
      >
        <span style={{ textDecoration: 'underline' }}>U</span>
      </button>

      <div className="format-divider" />

      <button
        className={`format-btn ${align === 'left' ? 'active' : ''}`}
        title="Align left"
        onClick={() => onChange({ align: 'left' })}
      >
        ⟸
      </button>
      <button
        className={`format-btn ${align === 'center' ? 'active' : ''}`}
        title="Align center"
        onClick={() => onChange({ align: 'center' })}
      >
        ⟺
      </button>
      <button
        className={`format-btn ${align === 'right' ? 'active' : ''}`}
        title="Align right"
        onClick={() => onChange({ align: 'right' })}
      >
        ⟹
      </button>

      <div className="format-divider" />

      <button
        className="format-btn"
        title="Decrease size"
        onClick={() => onChange({ fontSize: Math.max(MIN_FONT_SIZE, fontSize - FONT_SIZE_STEP) })}
      >
        A−
      </button>
      <span className="format-size-label">{fontSize}</span>
      <button
        className="format-btn"
        title="Increase size"
        onClick={() => onChange({ fontSize: Math.min(MAX_FONT_SIZE, fontSize + FONT_SIZE_STEP) })}
      >
        A+
      </button>

      <div className="format-divider" />

      <div className="format-colors">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            className={`format-color-swatch ${currentColor === color ? 'active' : ''}`}
            style={{ background: color }}
            title={color}
            onClick={() => onChange({ [colorField]: color })}
          />
        ))}
      </div>
    </div>
  );
}
