import { useState, type FormEvent } from 'react';
import type { BoardRole, BoardSummary } from '@collabboard/shared';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface InviteModalProps {
  boards: BoardSummary[];
  onClose: () => void;
  onInvite: (boardId: string, email: string, role: BoardRole) => Promise<void>;
}

export function InviteModal({ boards, onClose, onInvite }: InviteModalProps) {
  const ownedBoards = boards.filter((b) => b.role === 'OWNER');
  const [boardId, setBoardId] = useState(ownedBoards[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('EDITOR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!boardId || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onInvite(boardId, email.trim(), role);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError((err as Error).message || 'Failed to invite teammate');
    } finally {
      setSubmitting(false);
    }
  }

  if (ownedBoards.length === 0) {
    return (
      <Modal title="Invite teammates" onClose={onClose}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          You need to own at least one board before you can invite teammates to it. Create a board first.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title="Invite teammates" onClose={onClose}>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="invite-board">Board</label>
          <select id="invite-board" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
            {ownedBoards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="invite-email">Teammate's email</label>
          <input
            id="invite-email"
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="invite-role">Role</label>
          <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as BoardRole)}>
            <option value="EDITOR">Editor — can edit the board</option>
            <option value="VIEWER">Viewer — can only view</option>
          </select>
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && !error && (
          <div style={{ color: 'var(--color-primary)', fontSize: 13 }}>Invitation sent successfully.</div>
        )}
        <Button type="submit" disabled={submitting || !email.trim()}>
          {submitting ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
    </Modal>
  );
}
