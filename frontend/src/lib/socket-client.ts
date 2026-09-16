import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Fall back to this very origin so the socket handshake and its auth cookie
    // stay first-party (a cross-domain handshake gets its cookie blocked on iOS).
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
      auth: (cb) => {
        const token = typeof window !== 'undefined' ? sessionStorage.getItem('pos_token') : null;
        cb({ token });
      },
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Real-time Socket.io Server');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from Real-time Socket.io Server');
    });
  }

  return socket;
};
