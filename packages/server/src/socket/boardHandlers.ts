import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PresenceUser,
} from '@collabboard/shared';
import { prisma } from '../db/prisma.js';
import * as boardService from '../services/board.service.js';
import * as boardObjectService from '../services/boardObject.service.js';
import { addPresence, removePresence, listPresence } from './presence.js';
import { logger } from '../utils/logger.js';
import type { SocketData } from './socketAuth.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function roomName(boardId: string): string {
  return `board:${boardId}`;
}

async function buildPresenceUser(userId: string, boardId: string): Promise<PresenceUser | null> {
  const membership = await boardService.assertMembership(userId, boardId).catch(() => null);
  if (!membership) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return { userId: user.id, name: user.name, color: user.color, role: membership.role as PresenceUser['role'] };
}

export function registerBoardHandlers(io: IOServer, socket: IOSocket): void {
  const { userId } = socket.data as SocketData;
  const joinedBoards = new Set<string>();

  socket.on('board:join', async ({ boardId }) => {
    try {
      const presenceUser = await buildPresenceUser(userId, boardId);
      if (!presenceUser) {
        socket.emit('server:error', { message: 'You do not have access to this board' });
        return;
      }

      await socket.join(roomName(boardId));
      joinedBoards.add(boardId);

      const objects = await boardObjectService.listObjects(boardId);
      const members = addPresence(boardId, socket.id, presenceUser);

      socket.emit('board:state', { objects, members });
      io.to(roomName(boardId)).emit('presence:update', { users: members });
    } catch (error) {
      logger.error('board:join failed', { error: (error as Error).message });
      socket.emit('server:error', { message: 'Failed to join board' });
    }
  });

  socket.on('board:leave', ({ boardId }) => {
    void socket.leave(roomName(boardId));
    joinedBoards.delete(boardId);
    const members = removePresence(boardId, socket.id);
    io.to(roomName(boardId)).emit('presence:update', { users: members });
    io.to(roomName(boardId)).emit('cursor:remove', { userId });
  });

  socket.on('object:create', async ({ boardId, object, clientOpId }) => {
    try {
      const membership = await boardService.assertMembership(userId, boardId, 'EDITOR');
      void membership;
      const created = await boardObjectService.createObject(boardId, userId, object);
      io.to(roomName(boardId)).emit('object:created', { object: created, userId, clientOpId });
    } catch (error) {
      socket.emit('server:error', { message: (error as Error).message || 'Failed to create object' });
    }
  });

  socket.on('object:update', async ({ boardId, id, changes, clientOpId }) => {
    try {
      await boardService.assertMembership(userId, boardId, 'EDITOR');
      const updated = await boardObjectService.updateObject(boardId, id, changes);
      io.to(roomName(boardId)).emit('object:updated', {
        id: updated.id,
        changes: updated,
        userId,
        clientOpId,
      });
    } catch (error) {
      socket.emit('server:error', { message: (error as Error).message || 'Failed to update object' });
    }
  });

  socket.on('object:delete', async ({ boardId, id, clientOpId }) => {
    try {
      await boardService.assertMembership(userId, boardId, 'EDITOR');
      await boardObjectService.deleteObject(boardId, id);
      io.to(roomName(boardId)).emit('object:deleted', { id, userId, clientOpId });
    } catch (error) {
      socket.emit('server:error', { message: (error as Error).message || 'Failed to delete object' });
    }
  });

  socket.on('object:batch', async ({ boardId, objects, clientOpId }) => {
    try {
      await boardService.assertMembership(userId, boardId, 'EDITOR');
      const created = await boardObjectService.createObjectsBatch(boardId, userId, objects);
      io.to(roomName(boardId)).emit('object:batch:created', { objects: created, userId, clientOpId });
    } catch (error) {
      socket.emit('server:error', { message: (error as Error).message || 'Failed to create objects' });
    }
  });

  socket.on('cursor:move', ({ boardId, x, y }) => {
    const members = listPresence(boardId);
    const self = members.find((m) => m.userId === userId);
    if (!self) return;
    socket.to(roomName(boardId)).emit('cursor:update', { userId, name: self.name, color: self.color, x, y });
  });

  socket.on('disconnect', () => {
    for (const boardId of joinedBoards) {
      const members = removePresence(boardId, socket.id);
      io.to(roomName(boardId)).emit('presence:update', { users: members });
      io.to(roomName(boardId)).emit('cursor:remove', { userId });
    }
  });
}
