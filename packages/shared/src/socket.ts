import type { BoardObject, BoardRole } from './board.js';

export interface PresenceUser {
  userId: string;
  name: string;
  color: string;
  role: BoardRole;
}

export interface CursorPayload {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface ClientToServerEvents {
  'board:join': (payload: { boardId: string }) => void;
  'board:leave': (payload: { boardId: string }) => void;
  'object:create': (payload: { boardId: string; object: BoardObject; clientOpId: string }) => void;
  'object:update': (payload: {
    boardId: string;
    id: string;
    changes: Partial<BoardObject>;
    clientOpId: string;
  }) => void;
  'object:delete': (payload: { boardId: string; id: string; clientOpId: string }) => void;
  'object:batch': (payload: { boardId: string; objects: BoardObject[]; clientOpId: string }) => void;
  'cursor:move': (payload: { boardId: string; x: number; y: number }) => void;
}

export interface ServerToClientEvents {
  'board:state': (payload: { objects: BoardObject[]; members: PresenceUser[] }) => void;
  'object:created': (payload: { object: BoardObject; userId: string; clientOpId: string }) => void;
  'object:updated': (payload: {
    id: string;
    changes: Partial<BoardObject>;
    userId: string;
    clientOpId: string;
  }) => void;
  'object:deleted': (payload: { id: string; userId: string; clientOpId: string }) => void;
  'object:batch:created': (payload: { objects: BoardObject[]; userId: string; clientOpId: string }) => void;
  'presence:update': (payload: { users: PresenceUser[] }) => void;
  'cursor:update': (payload: CursorPayload) => void;
  'cursor:remove': (payload: { userId: string }) => void;
  'server:error': (payload: { message: string }) => void;
}
