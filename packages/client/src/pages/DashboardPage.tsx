import { useEffect, useMemo, useState } from 'react';
import type { BoardRole, BoardSummary } from '@collabboard/shared';
import { Sidebar } from '../components/dashboard/Sidebar';
import { BoardCard } from '../components/dashboard/BoardCard';
import { NewBoardModal } from '../components/dashboard/NewBoardModal';
import { InviteModal } from '../components/dashboard/InviteModal';
import { Button } from '../components/common/Button';
import { Avatar } from '../components/common/Avatar';
import { boardsApi } from '../lib/api/boards.api';
import { useAuthStore } from '../stores/authStore';
import { greetingForNow } from '../utils/time';
import './DashboardPage.css';

type TabKey = 'recent' | 'favorites' | 'templates' | 'shared';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'templates', label: 'Templates' },
  { key: 'shared', label: 'Shared with me' },
];

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('recent');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    void loadBoards();
  }, []);

  async function loadBoards() {
    setLoading(true);
    try {
      const { boards: list } = await boardsApi.list();
      setBoards(list);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBoard(name: string) {
    const { board } = await boardsApi.create({ name });
    setBoards((prev) => [board, ...prev]);
  }

  async function handleToggleFavorite(board: BoardSummary) {
    const { board: updated } = await boardsApi.update(board.id, { isFavorite: !board.isFavorite });
    setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  async function handleInvite(boardId: string, email: string, role: BoardRole) {
    const { board: updated } = await boardsApi.invite(boardId, { email, role });
    setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  const memberCount = useMemo(() => {
    const ids = new Set<string>();
    for (const b of boards) for (const m of b.members) ids.add(m.userId);
    return ids.size;
  }, [boards]);

  const filtered = useMemo(() => {
    let list = boards;
    if (tab === 'favorites') list = list.filter((b) => b.isFavorite);
    else if (tab === 'shared') list = list.filter((b) => b.role !== 'OWNER');
    else if (tab === 'templates') list = [];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    return list;
  }, [boards, tab, search]);

  return (
    <div className="dashboard-shell">
      <Sidebar boards={boards} memberCount={memberCount} onInviteClick={() => setShowInvite(true)} />

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-greeting">
              {greetingForNow()}, {user?.name.split(' ')[0]}
            </h1>
            <p className="dashboard-subtitle">Pick up where you left off, or start something new.</p>
          </div>
          <div className="dashboard-header-actions">
            <input
              className="dashboard-search"
              placeholder="Search boards, templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button onClick={() => setShowNewBoard(true)}>+ New board</Button>
            <button className="dashboard-user" onClick={() => void logout()} title="Sign out">
              {user && <Avatar name={user.name} color={user.color} size={32} />}
            </button>
          </div>
        </div>

        <div className="dashboard-toolbar">
          <div className="dashboard-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`dashboard-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="dashboard-view-toggle">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view">
              ▦
            </button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view">
              ☰
            </button>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-empty">Loading boards…</div>
        ) : tab === 'templates' ? (
          <div className="dashboard-empty">Templates are coming soon.</div>
        ) : filtered.length === 0 ? (
          <div className="dashboard-empty">
            {tab === 'favorites' ? 'No favorite boards yet.' : 'No boards yet — create your first one.'}
          </div>
        ) : view === 'grid' ? (
          <div className="board-grid">
            {filtered.map((board) => (
              <BoardCard key={board.id} board={board} onToggleFavorite={() => void handleToggleFavorite(board)} />
            ))}
          </div>
        ) : (
          <div className="board-list">
            {filtered.map((board) => (
              <div key={board.id} className="board-list-row">
                <span className="board-list-swatch" style={{ background: board.color }} />
                <span className="board-list-name">{board.name}</span>
                <div className="board-card-avatars">
                  {board.members.slice(0, 3).map((m) => (
                    <Avatar key={m.userId} name={m.name} color={m.color} size={22} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showNewBoard && <NewBoardModal onClose={() => setShowNewBoard(false)} onCreate={handleCreateBoard} />}
      {showInvite && (
        <InviteModal boards={boards} onClose={() => setShowInvite(false)} onInvite={handleInvite} />
      )}
    </div>
  );
}
