import { useBoardStore } from '../../stores/boardStore';
import { worldToScreen } from '../../utils/coords';
import './Cursors.css';

export function Cursors() {
  const cursors = useBoardStore((s) => s.cursors);
  const viewport = useBoardStore((s) => s.viewport);

  return (
    <div className="cursors-layer">
      {Object.values(cursors).map((cursor) => {
        const pos = worldToScreen({ x: cursor.x, y: cursor.y }, viewport);
        return (
          <div key={cursor.userId} className="cursor-pointer" style={{ left: pos.x, top: pos.y }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 2L16 9.5L10 11L7.5 17L4 2Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            <span className="cursor-label" style={{ background: cursor.color }}>
              {cursor.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
