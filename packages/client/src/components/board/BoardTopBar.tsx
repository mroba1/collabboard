import { useState } from 'react';
import type Konva from 'konva';
import { useNavigate } from 'react-router-dom';
import type { BoardSummary } from '@collabboard/shared';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { ExportMenu } from './ExportMenu';
import { useBoardStore } from '../../stores/boardStore';
import { useTheme } from '../../theme/ThemeProvider';
import { canEditBoard, isBoardOwner } from '../../utils/permissions';
import './BoardTopBar.css';

interface BoardTopBarProps {
  board: BoardSummary;
  stageRef: React.RefObject<Konva.Stage>;
  onRename: (name: string) => void;
  onShareClick: () => void;
  aiOpen: boolean;
  onToggleAI: () => void;
}

export function BoardTopBar({ board, stageRef, onRename, onShareClick, aiOpen, onToggleAI }: BoardTopBarProps) {
  const navigate = useNavigate();
  const members = useBoardStore((s) => s.members);
  const objectCount = useBoardStore((s) => Object.keys(s.objects).length);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const { resolvedMode, toggle } = useTheme();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(board.name);
  const canEdit = canEditBoard(board.role);
  const isOwner = isBoardOwner(board.role);

  function handleClearBoard() {
    if (objectCount === 0) return;
    if (window.confirm(`Delete all ${objectCount} objects from this board? You can undo afterward, one object at a time.`)) {
      clearBoard();
    }
  }

  function commitName() {
    setEditingName(false);
    if (nameDraft.trim() && nameDraft.trim() !== board.name) {
      onRename(nameDraft.trim());
    } else {
      setNameDraft(board.name);
    }
  }

  return (
    <header className="board-topbar">
      <div className="board-topbar-left">
        <button className="board-back" onClick={() => navigate('/')} title="Back to dashboard">
          ←
        </button>
        {editingName && canEdit ? (
          <input
            className="board-name-input"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
          />
        ) : (
          <h1
            className="board-name"
            onDoubleClick={() => canEdit && setEditingName(true)}
            title={canEdit ? 'Double-click to rename' : board.name}
          >
            {board.name}
          </h1>
        )}
      </div>

      <div className="board-topbar-right">
        <div className="board-presence">
          {members.map((m) => (
            <Avatar key={m.userId} name={m.name} color={m.color} size={28} />
          ))}
        </div>
        {canEdit && (
          <div className="board-history-controls">
            <button className="board-icon-btn" title="Undo (Ctrl+Z)" onClick={undo}>
              ↺
            </button>
            <button className="board-icon-btn" title="Redo (Ctrl+Shift+Z)" onClick={redo}>
              ↻
            </button>
            <button
              className="board-icon-btn"
              title="Clear board"
              onClick={handleClearBoard}
              disabled={objectCount === 0}
            >
              🗑
            </button>
          </div>
        )}
        {isOwner && (
          <Button size="sm" variant="secondary" onClick={onShareClick}>
            Share
          </Button>
        )}
        {!canEdit && <span className="board-role-badge">View only</span>}
        <ExportMenu stageRef={stageRef} boardName={board.name} />
        <Button size="sm" variant={aiOpen ? 'primary' : 'secondary'} onClick={onToggleAI}>
          ✨ AI Assistant
        </Button>
        <button className="board-theme-toggle" onClick={toggle} title="Toggle theme">
          {resolvedMode === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  );
}
