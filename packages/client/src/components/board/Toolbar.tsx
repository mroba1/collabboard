import { useRef } from 'react';
import { useBoardStore } from '../../stores/boardStore';
import { clampScale } from '../../utils/coords';
import type { ToolType } from '../../types/tool';
import './Toolbar.css';

const TOOLS: { type: ToolType; icon: string; label: string }[] = [
  { type: 'select', icon: '↖', label: 'Select (V)' },
  { type: 'pan', icon: '✋', label: 'Pan (H)' },
  { type: 'pen', icon: '✎', label: 'Pen (P)' },
  { type: 'rectangle', icon: '▭', label: 'Rectangle (R)' },
  { type: 'ellipse', icon: '◯', label: 'Ellipse (O)' },
  { type: 'arrow', icon: '↗', label: 'Arrow (A)' },
  { type: 'text', icon: 'T', label: 'Text (T)' },
  { type: 'sticky', icon: '▤', label: 'Sticky note (S)' },
  { type: 'eraser', icon: '⌫', label: 'Eraser (E)' },
];

export function Toolbar() {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);
  const viewport = useBoardStore((s) => s.viewport);
  const setViewport = useBoardStore((s) => s.setViewport);
  const createObject = useBoardStore((s) => s.createObject);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 360;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const width = img.naturalWidth * scale;
        const height = img.naturalHeight * scale;
        const worldCenterX = (-viewport.x + window.innerWidth / 2) / viewport.scale;
        const worldCenterY = (-viewport.y + window.innerHeight / 2) / viewport.scale;
        createObject({
          type: 'image',
          x: worldCenterX - width / 2,
          y: worldCenterY - height / 2,
          width,
          height,
          rotation: 0,
          src,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.type}
          className={`toolbar-btn ${tool === t.type ? 'active' : ''}`}
          title={t.label}
          onClick={() => setTool(t.type)}
        >
          {t.icon}
        </button>
      ))}

      <button className="toolbar-btn" title="Upload image" onClick={() => fileInputRef.current?.click()}>
        🖼
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageFile} />

      <div className="toolbar-divider" />

      <button className="toolbar-btn" title="Undo (Ctrl+Z)" onClick={undo}>
        ↺
      </button>
      <button className="toolbar-btn" title="Redo (Ctrl+Shift+Z)" onClick={redo}>
        ↻
      </button>

      <div className="toolbar-divider" />

      <button
        className="toolbar-btn"
        title="Zoom out"
        onClick={() => setViewport({ scale: clampScale(viewport.scale * 0.85) })}
      >
        −
      </button>
      <span className="toolbar-zoom-label">{Math.round(viewport.scale * 100)}%</span>
      <button
        className="toolbar-btn"
        title="Zoom in"
        onClick={() => setViewport({ scale: clampScale(viewport.scale * 1.15) })}
      >
        +
      </button>
      <button className="toolbar-btn" title="Reset view" onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}>
        ⤢
      </button>
    </div>
  );
}
