import { useBoardStore } from '../../stores/boardStore';
import { clampScale } from '../../utils/coords';
import './ZoomControls.css';

export function ZoomControls() {
  const viewport = useBoardStore((s) => s.viewport);
  const setViewport = useBoardStore((s) => s.setViewport);

  return (
    <div className="zoom-controls">
      <button
        className="zoom-btn"
        title="Zoom out"
        onClick={() => setViewport({ scale: clampScale(viewport.scale * 0.85) })}
      >
        −
      </button>
      <span className="zoom-label">{Math.round(viewport.scale * 100)}%</span>
      <button
        className="zoom-btn"
        title="Zoom in"
        onClick={() => setViewport({ scale: clampScale(viewport.scale * 1.15) })}
      >
        +
      </button>
      <button className="zoom-btn" title="Reset view" onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}>
        ⤢
      </button>
    </div>
  );
}
