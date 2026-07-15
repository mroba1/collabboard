import { useRef } from 'react';
import { useBoardStore } from '../../stores/boardStore';
import { canEditBoard } from '../../utils/permissions';
import { MoreToolsMenu } from './MoreToolsMenu';
import type { ToolType } from '../../types/tool';
import './Toolbar.css';

const VIEW_TOOLS: { type: ToolType; icon: string; label: string }[] = [
  { type: 'pan', icon: '✋', label: 'Move & tap to type (H)' },
  { type: 'select', icon: '↖', label: 'Select / box-select (V)' },
];

const EDIT_TOOLS: { type: ToolType; icon: string; label: string }[] = [
  { type: 'pen', icon: '✎', label: 'Pen (P)' },
  { type: 'rectangle', icon: '▭', label: 'Rectangle (R)' },
  { type: 'ellipse', icon: '◯', label: 'Ellipse (O)' },
  { type: 'arrow', icon: '↗', label: 'Arrow (A)' },
  { type: 'sticky', icon: '▤', label: 'Sticky note (S)' },
  { type: 'eraser', icon: '⌫', label: 'Eraser (E)' },
];

export function Toolbar() {
  const tool = useBoardStore((s) => s.tool);
  const role = useBoardStore((s) => s.role);
  const setTool = useBoardStore((s) => s.setTool);
  const viewport = useBoardStore((s) => s.viewport);
  const createObject = useBoardStore((s) => s.createObject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = canEditBoard(role);

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
      <div className="toolbar-scroll">
        {VIEW_TOOLS.map((t) => (
          <button
            key={t.type}
            className={`toolbar-btn ${tool === t.type ? 'active' : ''}`}
            title={t.label}
            onClick={() => setTool(t.type)}
          >
            {t.icon}
          </button>
        ))}

        {canEdit && (
          <>
            {EDIT_TOOLS.map((t) => (
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
          </>
        )}
      </div>

      {canEdit && (
        <>
          <div className="toolbar-divider" />
          <MoreToolsMenu tool={tool} onSelect={setTool} />
        </>
      )}
    </div>
  );
}
