import { useNavigate } from 'react-router-dom';
import type { BoardSummary } from '@collabboard/shared';
import { Avatar } from '../common/Avatar';
import { boardGradient } from '../../utils/color';
import { formatRelativeTime } from '../../utils/time';
import './BoardCard.css';

interface BoardCardProps {
  board: BoardSummary;
  onToggleFavorite: (board: BoardSummary) => void;
}

export function BoardCard({ board, onToggleFavorite }: BoardCardProps) {
  const navigate = useNavigate();

  return (
    <div className="board-card" onClick={() => navigate(`/board/${board.id}`)}>
      <div className="board-card-thumb" style={{ background: boardGradient(board.color) }}>
        <button
          className={`board-card-star ${board.isFavorite ? 'is-favorite' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(board);
          }}
          aria-label="Toggle favorite"
        >
          {board.isFavorite ? '★' : '☆'}
        </button>
      </div>
      <div className="board-card-body">
        <span className="board-card-name">{board.name}</span>
        <div className="board-card-meta">
          <span className="board-card-edited">Edited {formatRelativeTime(board.updatedAt)}</span>
          <div className="board-card-avatars">
            {board.members.slice(0, 3).map((m) => (
              <Avatar key={m.userId} name={m.name} color={m.color} size={22} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
