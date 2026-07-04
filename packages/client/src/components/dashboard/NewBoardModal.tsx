import { useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface NewBoardModalProps {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function NewBoardModal({ onClose, onCreate }: NewBoardModalProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to create board');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New board" onClose={onClose}>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="board-name">Board name</label>
          <input
            id="board-name"
            autoFocus
            placeholder="e.g. Sprint Retro — July"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? 'Creating…' : 'Create board'}
        </Button>
      </form>
    </Modal>
  );
}
