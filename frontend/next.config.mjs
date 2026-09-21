/**
 * The API normally lives on a different host from the site. That makes the auth
 * cookie a *third-party* cookie, and browsers — iOS Safari by default, Chrome
 * increasingly — refuse to store those, so the session dies the moment you
 * navigate. Proxying the API through this domain keeps every request
 * same-origin, which makes `pos_token` a first-party cookie that always sticks.
 *
 * Requests go to /api/v1/... on this domain and are forwarded to the API host.
 * On the desktop the API runs on localhost, and the Electron shell passes its
 * port in through NEXT_PUBLIC_API_URL at server start.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  async rewrites() {
    const API_ORIGIN =
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ||
      'http://localhost:5000';

    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
      { source: '/socket.io/:path*', destination: `${API_ORIGIN}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
