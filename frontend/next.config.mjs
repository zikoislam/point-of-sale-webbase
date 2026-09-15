/**
 * The API lives on a different domain (Railway) from the site (Vercel). That
 * makes the auth cookie a *third-party* cookie, and browsers — iOS Safari by
 * default, Chrome increasingly — refuse to store those, so the session dies the
 * moment you navigate. Proxying the API through this domain keeps every request
 * same-origin, which makes `pos_token` a first-party cookie that always sticks.
 *
 * Requests go to /api/v1/... on this domain and are forwarded to the API host.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET || 'https://pos-api-production-f0f5.up.railway.app';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
      // Socket.io needs its handshake proxied too, otherwise its auth cookie is
      // third-party as well and real-time alerts silently never connect.
      { source: '/socket.io/:path*', destination: `${API_ORIGIN}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
