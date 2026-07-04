import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';

export interface SocketData {
  userId: string;
  email: string;
}

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Missing authentication token'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    (socket.data as SocketData).userId = payload.sub;
    (socket.data as SocketData).email = payload.email;
    next();
  } catch {
    next(new Error('Invalid or expired authentication token'));
  }
}
