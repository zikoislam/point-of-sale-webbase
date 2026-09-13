import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { User } from '../models/User';
import { TokenBlacklist } from '../models/TokenBlacklist';

let io: Server | null = null;

const ALERT_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER'];

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.substring(name.length + 1)) : undefined;
}

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  // Authenticate every socket connection with the same JWT used for the REST API
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth && (socket.handshake.auth.token as string)) ||
        parseCookie(socket.handshake.headers.cookie, 'pos_token');

      if (!token) return next(new Error('Authentication required'));

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      if (await TokenBlacklist.findOne({ tokenHash })) return next(new Error('Session invalidated'));

      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      const user = await User.findById(decoded.userId).populate<{ roleId: any }>('roleId');
      if (!user || !user.isActive) return next(new Error('User inactive'));

      socket.data.user = {
        userId: user._id.toString(),
        role: user.roleId?.name || 'CASHIER',
      };
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { userId: string; role: string } | undefined;
    if (user) {
      socket.join(`role:${user.role}`);
      socket.join(`user:${user.userId}`);
    }

    socket.on('join:terminal', (terminalId: string) => {
      if (typeof terminalId === 'string') socket.join(`terminal:${terminalId}`);
    });

    socket.on('disconnect', () => {
      // no-op
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
};

// Send an event to manager/admin rooms only (alerts must not reach cashiers)
export const emitToRoles = (
  event: string,
  data: any,
  roles: string[] = ALERT_ROLES
): void => {
  if (!io) return;
  let emitter: any = null;
  for (const role of roles) {
    emitter = emitter ? emitter.to(`role:${role}`) : io.to(`role:${role}`);
  }
  if (emitter) emitter.emit(event, data);
};

export const emitEvent = (event: string, data: any, room?: string): void => {
  if (!io) return;
  if (room) io.to(room).emit(event, data);
  else io.emit(event, data);
};
