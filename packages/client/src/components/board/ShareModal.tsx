import { useState, type FormEvent } from 'react';
import type { BoardMemberInfo, BoardRole } from '@collabboard/shared';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { boardsApi } from '../../lib/api/boards.api';

interface ShareModalProps {
  boardId: string;
  members: BoardMemberInfo[];
  onClose: () => void;
  onInvited: (members: BoardMemberInfo[]) => void;
}

export function ShareModal({ boardId, members, onClose, onInvited }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('EDITOR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { board } = await boardsApi.invite(boardId, { email: email.trim(), role });
      onInvited(board.members);
      setEmail('');
    } catch (err) {
      setError((err as Error).message || 'Failed to invite teammate');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Share this board" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {members.map((m) => (
          <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <Avatar name={m.name} color={m.color} size={26} />
            <span style={{ flex: 1 }}>{m.name}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{m.role.toLowerCase()}</span>
          </div>
        ))}
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="share-email">Invite by email</label>
          <input
            id="share-email"
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="share-role">Role</label>
          <select id="share-role" value={role} onChange={(e) => setRole(e.target.value as BoardRole)}>
            <option value="EDITOR">Editor — can edit the board</option>
            <option value="VIEWER">Viewer — can only view</option>
          </select>
        </div>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={submitting || !email.trim()}>
          {submitting ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
    </Modal>
  );
}
