import { CookieOptions } from 'express';
import { env } from '../config/env';

// In production the frontend (Vercel) and the API (Railway/Render) live on
// different domains, so the auth cookie is a cross-site cookie. Browsers only
// send cross-site cookies when SameSite=None, and SameSite=None is only
// accepted together with Secure — hence HTTPS is mandatory in production.
// Locally both run on localhost, so 'lax' over plain HTTP is correct there.
export const authCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
});
