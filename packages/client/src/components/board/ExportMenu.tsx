import { useState } from 'react';
import type Konva from 'konva';
import { jsPDF } from 'jspdf';
import { useBoardStore } from '../../stores/boardStore';
import { computeBoundingBox } from '../../utils/boundingBox';
import './ExportMenu.css';

const PADDING = 60;
const MAX_DIMENSION = 4000;

interface ExportMenuProps {
  stageRef: React.RefObject<Konva.Stage>;
  boardName: string;
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function renderFullBoardToDataUrl(stage: Konva.Stage): string | null {
  const objects = Object.values(useBoardStore.getState().objects);
  const bbox = computeBoundingBox(objects);
  if (!bbox) return null;

  const scale = Math.min(2, MAX_DIMENSION / Math.max(bbox.width + PADDING * 2, bbox.height + PADDING * 2));

  const prevX = stage.x();
  const prevY = stage.y();
  const prevScaleX = stage.scaleX();
  const prevScaleY = stage.scaleY();
  const prevWidth = stage.width();
  const prevHeight = stage.height();

  const exportWidth = (bbox.width + PADDING * 2) * scale;
  const exportHeight = (bbox.height + PADDING * 2) * scale;

  useBoardStore.getState().setSelected([]);
  stage.size({ width: exportWidth, height: exportHeight });
  stage.position({ x: -bbox.minX * scale + PADDING * scale, y: -bbox.minY * scale + PADDING * scale });
  stage.scale({ x: scale, y: scale });
  stage.batchDraw();

  const dataUrl = stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });

  stage.size({ width: prevWidth, height: prevHeight });
  stage.position({ x: prevX, y: prevY });
  stage.scale({ x: prevScaleX, y: prevScaleY });
  stage.batchDraw();

  return dataUrl;
}

export function ExportMenu({ stageRef, boardName }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  function handleExportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = renderFullBoardToDataUrl(stage);
    if (!dataUrl) {
      alert('Add some objects to the board before exporting.');
      return;
    }
    downloadDataUrl(dataUrl, `${boardName || 'collabboard'}.png`);
    setOpen(false);
  }

  function handleExportPdf() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = renderFullBoardToDataUrl(stage);
    if (!dataUrl) {
      alert('Add some objects to the board before exporting.');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const orientation = img.width >= img.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: [img.width, img.height] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save(`${boardName || 'collabboard'}.pdf`);
    };
    img.src = dataUrl;
    setOpen(false);
  }

  return (
    <div className="export-menu">
      <button className="export-trigger" onClick={() => setOpen((o) => !o)} title="Export">
        ⬇ <span className="btn-label-text">Export</span> ▾
      </button>
      {open && (
        <>
          <div className="export-backdrop" onClick={() => setOpen(false)} />
          <div className="export-dropdown">
            <button onClick={handleExportPng}>Export as PNG</button>
            <button onClick={handleExportPdf}>Export as PDF</button>
          </div>
        </>
      )}
    </div>
  );
}
