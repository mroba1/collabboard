import { useEffect } from 'react';
import type { ServerToClientEvents } from '@collabboard/shared';
import { connectSocket, getSocket } from '../lib/socketClient';
import { useBoardStore } from '../stores/boardStore';

export function useBoardSocket(boardId: string | undefined): void {
  const initBoard = useBoardStore((s) => s.initBoard);
  const setPresence = useBoardStore((s) => s.setPresence);
  const setCursor = useBoardStore((s) => s.setCursor);
  const removeCursor = useBoardStore((s) => s.removeCursor);
  const applyRemoteCreated = useBoardStore((s) => s.applyRemoteCreated);
  const applyRemoteUpdated = useBoardStore((s) => s.applyRemoteUpdated);
  const applyRemoteDeleted = useBoardStore((s) => s.applyRemoteDeleted);
  const applyRemoteBatchCreated = useBoardStore((s) => s.applyRemoteBatchCreated);
  const setError = useBoardStore((s) => s.setError);

  useEffect(() => {
    if (!boardId) return;
    const socket = connectSocket();

    const onState: ServerToClientEvents['board:state'] = (payload) => {
      initBoard(boardId, payload.objects);
      setPresence(payload.members);
    };
    const onPresence: ServerToClientEvents['presence:update'] = (payload) => setPresence(payload.users);
    const onCursor: ServerToClientEvents['cursor:update'] = (payload) => setCursor(payload);
    const onCursorRemove: ServerToClientEvents['cursor:remove'] = (payload) => removeCursor(payload.userId);
    const onCreated: ServerToClientEvents['object:created'] = (payload) =>
      applyRemoteCreated(payload.object, payload.userId, payload.clientOpId);
    const onUpdated: ServerToClientEvents['object:updated'] = (payload) =>
      applyRemoteUpdated(payload.id, payload.changes, payload.userId, payload.clientOpId);
    const onDeleted: ServerToClientEvents['object:deleted'] = (payload) =>
      applyRemoteDeleted(payload.id, payload.userId, payload.clientOpId);
    const onBatch: ServerToClientEvents['object:batch:created'] = (payload) =>
      applyRemoteBatchCreated(payload.objects, payload.userId, payload.clientOpId);
    const onServerError: ServerToClientEvents['server:error'] = (payload) => {
      setError(payload.message);
      // The rejected mutation may already be applied optimistically on this
      // client with no way to roll back just that change, so re-request the
      // authoritative snapshot to correct any local drift.
      socket.emit('board:join', { boardId });
    };

    socket.on('board:state', onState);
    socket.on('presence:update', onPresence);
    socket.on('cursor:update', onCursor);
    socket.on('cursor:remove', onCursorRemove);
    socket.on('object:created', onCreated);
    socket.on('object:updated', onUpdated);
    socket.on('object:deleted', onDeleted);
    socket.on('object:batch:created', onBatch);
    socket.on('server:error', onServerError);

    socket.emit('board:join', { boardId });

    return () => {
      socket.emit('board:leave', { boardId });
      socket.off('board:state', onState);
      socket.off('presence:update', onPresence);
      socket.off('cursor:update', onCursor);
      socket.off('cursor:remove', onCursorRemove);
      socket.off('object:created', onCreated);
      socket.off('object:updated', onUpdated);
      socket.off('object:deleted', onDeleted);
      socket.off('object:batch:created', onBatch);
      socket.off('server:error', onServerError);
    };
  }, [
    boardId,
    initBoard,
    setPresence,
    setCursor,
    removeCursor,
    applyRemoteCreated,
    applyRemoteUpdated,
    applyRemoteDeleted,
    applyRemoteBatchCreated,
    setError,
  ]);
}

export function emitCursorMove(boardId: string, x: number, y: number): void {
  getSocket().emit('cursor:move', { boardId, x, y });
}
