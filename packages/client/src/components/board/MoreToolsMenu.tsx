import { useState } from 'react';
import type { ToolType } from '../../types/tool';
import './MoreToolsMenu.css';

interface ToolEntry {
  type: ToolType;
  icon: string;
  label: string;
}

const SECTIONS: { title: string; tools: ToolEntry[] }[] = [
  {
    title: 'Drawing',
    tools: [
      { type: 'brush', icon: '🖌', label: 'Brush' },
      { type: 'highlighter', icon: '🖍', label: 'Highlighter' },
    ],
  },
  {
    title: 'Shapes',
    tools: [
      { type: 'roundedRectangle', icon: '▢', label: 'Rounded rectangle' },
      { type: 'circle', icon: '○', label: 'Circle' },
      { type: 'triangle', icon: '△', label: 'Triangle' },
      { type: 'diamond', icon: '◇', label: 'Diamond' },
      { type: 'pentagon', icon: '⬠', label: 'Pentagon' },
      { type: 'hexagon', icon: '⬡', label: 'Hexagon' },
      { type: 'star', icon: '★', label: 'Star' },
      { type: 'polygon', icon: '⬟', label: 'Polygon' },
    ],
  },
  {
    title: 'Lines & connectors',
    tools: [
      { type: 'line', icon: '╱', label: 'Line' },
      { type: 'curvedArrow', icon: '↝', label: 'Curved arrow' },
      { type: 'connector', icon: '⌁', label: 'Connector' },
    ],
  },
];

interface MoreToolsMenuProps {
  tool: ToolType;
  onSelect: (tool: ToolType) => void;
}

export function MoreToolsMenu({ tool, onSelect }: MoreToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const isActive = SECTIONS.some((s) => s.tools.some((t) => t.type === tool));

  return (
    <div className="more-tools">
      <button
        className={`toolbar-btn ${isActive ? 'active' : ''}`}
        title="More tools"
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="more-tools-backdrop" onClick={() => setOpen(false)} />
          <div className="more-tools-panel">
            {SECTIONS.map((section) => (
              <div key={section.title} className="more-tools-section">
                <span className="more-tools-title">{section.title}</span>
                <div className="more-tools-grid">
                  {section.tools.map((t) => (
                    <button
                      key={t.type}
                      className={`more-tools-item ${tool === t.type ? 'active' : ''}`}
                      title={t.label}
                      onClick={() => {
                        onSelect(t.type);
                        setOpen(false);
                      }}
                    >
                      <span className="more-tools-icon">{t.icon}</span>
                      <span className="more-tools-label">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
