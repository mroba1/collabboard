import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type Konva from 'konva';
import type { BoardSummary } from '@collabboard/shared';
import { boardsApi } from '../lib/api/boards.api';
import { useBoardStore } from '../stores/boardStore';
import { useBoardSocket } from '../hooks/useBoardSocket';
import { BoardTopBar } from '../components/board/BoardTopBar';
import { Toolbar } from '../components/board/Toolbar';
import { Canvas } from '../components/board/Canvas';
import { Cursors } from '../components/board/Cursors';
import { AIAssistantPanel } from '../components/board/AIAssistantPanel';
import { ShareModal } from '../components/board/ShareModal';
import { FullScreenSpinner } from '../components/common/FullScreenSpinner';
import './BoardPage.css';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const stageRef = useRef<Konva.Stage>(null);
  const [board, setBoard] = useState<BoardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const initBoard = useBoardStore((s) => s.initBoard);
  const reset = useBoardStore((s) => s.reset);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { board: summary, objects } = await boardsApi.get(boardId as string);
        if (cancelled) return;
        setBoard(summary);
        initBoard(boardId as string, objects);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      reset();
    };
  }, [boardId, initBoard, reset]);

  useBoardSocket(loading ? undefined : boardId);

  if (loading) return <FullScreenSpinner />;
  if (notFound || !board || !boardId) {
    return <div className="board-not-found">Board not found, or you don&apos;t have access to it.</div>;
  }

  return (
    <div className="board-page">
      <BoardTopBar
        board={board}
        stageRef={stageRef}
        onRename={async (name) => {
          const { board: updated } = await boardsApi.update(boardId, { name });
          setBoard(updated);
        }}
        onShareClick={() => setShareOpen(true)}
        aiOpen={aiOpen}
        onToggleAI={() => setAiOpen((v) => !v)}
      />

      <div className="board-workspace">
        <div className="board-canvas-area">
          <Canvas boardId={boardId} stageRef={stageRef} />
          <Cursors />
          <Toolbar />
        </div>

        {aiOpen && <AIAssistantPanel boardId={boardId} onClose={() => setAiOpen(false)} />}
      </div>

      {shareOpen && (
        <ShareModal
          boardId={boardId}
          members={board.members}
          onClose={() => setShareOpen(false)}
          onInvited={(members) => setBoard((prev) => (prev ? { ...prev, members } : prev))}
        />
      )}
    </div>
  );
}
