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

/** Origin of an *absolute* API url: "https://host/api/v1" → "https://host". A relative path (e.g. "/api/v1", which the browser resolves against this same domain) yields null. */
function apiOrigin(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return url.replace(/\/api\/v1\/?$/, '') || null;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  async rewrites() {
    // A relative NEXT_PUBLIC_API_URL means "same origin, proxy it" — it must not
    // be used as the proxy target itself. Never fall back to localhost in
    // production: the host (Vercel) refuses to proxy to a private hostname and
    // every API call 404s with DNS_HOSTNAME_RESOLVED_PRIVATE.
    const API_ORIGIN =
      process.env.API_PROXY_TARGET ||
      apiOrigin(process.env.NEXT_PUBLIC_API_URL) ||
      (process.env.NODE_ENV === 'production'
        ? 'https://pos-api-production-f0f5.up.railway.app'
        : 'http://localhost:5000');

    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
      { source: '/socket.io/:path*', destination: `${API_ORIGIN}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
