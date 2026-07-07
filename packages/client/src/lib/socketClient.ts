import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@collabboard/shared';
import { getAccessToken, tryRefresh } from './apiClient';

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

    // The access token (15min lifetime) can easily expire while a tab stays
    // open. If a (re)connect attempt is rejected for auth, refresh the token
    // over REST and retry -- otherwise the socket would keep failing forever
    // with the same stale token.
    socket.on('connect_error', () => {
      void tryRefresh().then((refreshed) => {
        if (refreshed) socket?.connect();
      });
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
