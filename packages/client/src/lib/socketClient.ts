import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@collabboard/shared';
import { getAccessToken } from './apiClient';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

type CollabSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: CollabSocket | null = null;

export function getSocket(): CollabSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: getAccessToken() }),
      withCredentials: true,
    });
  }
  return socket;
}

export function connectSocket(): CollabSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
