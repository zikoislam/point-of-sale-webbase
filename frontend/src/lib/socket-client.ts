import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
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
