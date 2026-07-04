import type { PresenceUser } from '@collabboard/shared';

interface BoardPresence {
  bySocketId: Map<string, PresenceUser>;
}

const boards = new Map<string, BoardPresence>();

function boardEntry(boardId: string): BoardPresence {
  let entry = boards.get(boardId);
  if (!entry) {
    entry = { bySocketId: new Map() };
    boards.set(boardId, entry);
  }
  return entry;
}

export function addPresence(boardId: string, socketId: string, user: PresenceUser): PresenceUser[] {
  const entry = boardEntry(boardId);
  entry.bySocketId.set(socketId, user);
  return Array.from(entry.bySocketId.values());
}

export function removePresence(boardId: string, socketId: string): PresenceUser[] {
  const entry = boards.get(boardId);
  if (!entry) return [];
  entry.bySocketId.delete(socketId);
  if (entry.bySocketId.size === 0) {
    boards.delete(boardId);
  }
  return Array.from(entry.bySocketId.values());
}

export function listPresence(boardId: string): PresenceUser[] {
  return Array.from(boards.get(boardId)?.bySocketId.values() ?? []);
}
