import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@collabboard/shared';
import { env } from '../config/env.js';
import { socketAuthMiddleware } from './socketAuth.js';
import { registerBoardHandlers } from './boardHandlers.js';

export function createSocketServer(httpServer: HttpServer): Server<ClientToServerEvents, ServerToClientEvents> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    registerBoardHandlers(io, socket);
  });

  return io;
}
