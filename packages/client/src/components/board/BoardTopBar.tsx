import { useState } from 'react';
import type Konva from 'konva';
import { useNavigate } from 'react-router-dom';
import type { BoardSummary } from '@collabboard/shared';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { ExportMenu } from './ExportMenu';
import { useBoardStore } from '../../stores/boardStore';
import { useTheme } from '../../theme/ThemeProvider';
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
  const { resolvedMode, toggle } = useTheme();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(board.name);

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
        {editingName ? (
          <input
            className="board-name-input"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
          />
        ) : (
          <h1 className="board-name" onDoubleClick={() => setEditingName(true)} title="Double-click to rename">
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
        <Button size="sm" variant="secondary" onClick={onShareClick}>
          Share
        </Button>
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
