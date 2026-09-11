import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional().default(false),
});

export const unlockTerminalSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UnlockTerminalInput = z.infer<typeof unlockTerminalSchema>;
