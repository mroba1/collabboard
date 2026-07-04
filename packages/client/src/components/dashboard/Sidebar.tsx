import { useNavigate } from 'react-router-dom';
import type { BoardSummary } from '@collabboard/shared';
import { useTheme } from '../../theme/ThemeProvider';
import './Sidebar.css';

interface SidebarProps {
  boards: BoardSummary[];
  memberCount: number;
  onInviteClick: () => void;
}

export function Sidebar({ boards, memberCount, onInviteClick }: SidebarProps) {
  const navigate = useNavigate();
  const { resolvedMode, toggle } = useTheme();
  const recent = boards.slice(0, 5);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark" />
        <span>CollabBoard</span>
      </div>

      <div className="workspace-switcher">
        <div className="workspace-avatar" />
        <div className="workspace-info">
          <span className="workspace-name">Acme Inc.</span>
          <span className="workspace-plan">Free plan</span>
        </div>
        <span className="workspace-caret">▾</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-item active">
          <span className="sidebar-nav-dot" />
          Recent boards
        </div>
        <div className="sidebar-swatches">
          {recent.map((board) => (
            <button
              key={board.id}
              className="sidebar-swatch"
              style={{ background: board.color }}
              title={board.name}
              onClick={() => navigate(`/board/${board.id}`)}
            />
          ))}
          {recent.length === 0 && <div className="sidebar-swatch-empty">No boards yet</div>}
        </div>
      </nav>

      <button className="theme-toggle" onClick={toggle}>
        {resolvedMode === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
      </button>

      <div className="sidebar-footer">
        <span className="member-count">{memberCount} of 5 members</span>
        <button className="invite-link" onClick={onInviteClick}>
          + Invite teammates
        </button>
      </div>
    </aside>
  );
}
