// PM2 process file for a self-hosted (VPS) deployment.
//
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup
//
// Build first (see docs/VPS-SELFHOST-BN.md):
//   cd backend  && npm ci && npm run build
//   cd frontend && npm ci && npm run build
//   + copy frontend/.next/static and frontend/public into frontend/.next/standalone

module.exports = {
  apps: [
    {
      name: 'pos-api',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
    {
      name: 'pos-web',
      cwd: './frontend/.next/standalone',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },
    },
  ],
};
