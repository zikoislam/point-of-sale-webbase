# Deployment Guide

This project is a monorepo with two independently deployed halves:

| Part | Folder | Host | Why |
|:---|:---|:---|:---|
| Frontend | `frontend/` | **Vercel** | Next.js 14 App Router — native Vercel support |
| Backend | `backend/` | **Railway** or **Render** | Needs a long-running process (Socket.io) + node-cron |
| Desktop app | `electron/` | **Windows installer (.exe)** | Runs the same frontend + backend on the shop's own PC, with a bundled MongoDB for offline use |

The desktop build, its bundled MongoDB, offline sync engine and hardware setup are documented
separately in [`DESKTOP-BN.md`](./DESKTOP-BN.md).

## Why the backend cannot run on Vercel

Vercel runs stateless serverless functions. Four things in this backend depend on a persistent process:

1. **Socket.io** (`src/sockets/index.ts`) — holds long-lived WebSocket connections for real-time alerts.
2. **node-cron** (`src/jobs/index.ts`) — daily summary, hourly cart cleanup, morning FEFO scan.
3. **File uploads** (`src/controllers/UploadController.ts`) — writes to `backend/uploads` via `fs.writeFileSync`; the serverless filesystem is read-only and ephemeral.
4. **`server.listen()`** (`src/index.ts`) — Vercel expects an exported request handler, not a listening server.

Railway and Render provide all four. The code therefore stays as-is.

## Production auth cookie

The frontend (Vercel) and API (Railway/Render) sit on different domains, so `pos_token` is a
cross-site cookie. `src/utils/cookie.ts` handles this: production uses
`SameSite=None; Secure`, development uses `SameSite=Lax`. `SameSite=None` requires HTTPS,
which both hosts provide. HTTPS is therefore mandatory in production.

`CLIENT_URL` accepts a comma-separated list, so production and preview deployments can both
be trusted:

```
CLIENT_URL=https://pos-shop.vercel.app,https://pos-shop-git-main-you.vercel.app
```

## Backend environment variables

| Variable | Value |
|:---|:---|
| `NODE_ENV` | `production` |
| `PORT` | Provided by the host — do not hardcode |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `8h` |
| `CLIENT_URL` | Comma-separated Vercel origin(s) |
| `BACKUP_DIR` | *(optional)* Folder for database snapshots. Defaults to `<uploads>/backups` in production — already on the persistent volume. |

## Deploy the backend (Railway)

1. **New Project → Deploy from GitHub repo**, select this repository.
2. **Settings → Root Directory** = `backend`.
3. **Networking → Generate Domain** to get a public HTTPS URL.
4. Add the environment variables listed above.
5. Add a **Volume** mounted at `/app/uploads` so logos and avatars survive redeploys.
   Database snapshots are written to `/app/uploads/backups` inside that same volume
   (set `BACKUP_DIR` to override), so they survive redeploys too. An automatic snapshot
   runs daily at 02:00 and the newest 7 are kept; take more from the **Backup** page.
6. `backend/railway.json` sets the build/start commands and health check automatically.

## Deploy the backend (Render — alternative)

1. **New → Blueprint**, select this repository; `render.yaml` at the repo root is detected.
2. Fill in the secret environment variables (`sync: false`) when prompted.
3. The `disk` block persists uploads but requires a paid instance type. On the free plan
   uploads are wiped on every deploy.

## Deploy the frontend (Vercel)

1. **Add New → Project**, import this repository.
2. **Root Directory** = `frontend`.
3. Framework preset: Next.js (auto-detected; `frontend/vercel.json` is also present).
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL=https://<backend-domain>/api/v1`
   - `NEXT_PUBLIC_SOCKET_URL=https://<backend-domain>`
5. Deploy, then copy the Vercel domain into the backend's `CLIENT_URL` and redeploy the backend.

## Order of operations

Deploy the backend first to obtain its URL, then the frontend, then set the Vercel domain as
the backend's `CLIENT_URL` and redeploy the backend. One backend redeploy is always required.

## Gotchas

- **MongoDB Atlas → Network Access** must allow `0.0.0.0/0`: Railway and Render use dynamic
  egress IPs, so a fixed allowlist will break connections.
- `backend/.env` is never read in production (the file does not exist there); platform
  environment variables take over. `dotenv.config()` on a missing file is a no-op.
- If a preview deployment should support login, add its URL to `CLIENT_URL` as well.
