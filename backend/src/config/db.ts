import mongoose from 'mongoose';
import { env } from './env';

/**
 * Database connection strategy for the desktop app.
 *
 * The bundled mongod is preferred so the shop keeps working with no internet.
 * It is started as a single-node replica set by the Electron shell, which is
 * what makes multi-document transactions (checkout, returns, wastage) legal —
 * a standalone mongod rejects them outright.
 *
 * The cloud database is a synchronisation target, not a hard dependency, so a
 * connection failure here must never take the process down: the previous
 * `process.exit(1)` turned a brief internet outage into a dead app.
 */

export type DbMode = 'local' | 'cloud' | 'none';

let dbMode: DbMode = 'none';
let retryTimer: NodeJS.Timeout | null = null;

export const getDbMode = (): DbMode => dbMode;
export const isDatabaseReady = (): boolean => mongoose.connection.readyState === 1;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function portOf(uri: string): number {
  const match = /:(\d+)(\/|$|\?)/.exec(uri.replace(/^mongodb(\+srv)?:\/\//, '://'));
  return match ? parseInt(match[1], 10) : 27017;
}

/**
 * Brings a freshly created data directory up to a usable replica set.
 * A second launch finds it already initialised, which is not an error.
 */
async function ensureReplicaSet(port: number): Promise<void> {
  const adminUri = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;
  const adminConn = mongoose.createConnection(adminUri, { serverSelectionTimeoutMS: 8000 });

  try {
    await adminConn.asPromise();
    const admin = adminConn.db!.admin();

    try {
      await admin.command({
        replSetInitiate: {
          _id: 'rs0',
          members: [{ _id: 0, host: `127.0.0.1:${port}` }],
        },
      });
      console.log(`🔧 Initialised the local replica set (rs0) for transactions.`);
    } catch (error: any) {
      const code = error?.code ?? error?.codeName;
      if (code !== 23 && code !== 'AlreadyInitialized') throw error;
    }

    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const hello = await admin.command({ hello: 1 });
        if (hello?.isWritablePrimary) return;
      } catch {
        /* the node is still electing itself */
      }
      await sleep(500);
    }

    throw new Error('the local MongoDB node did not become primary in time');
  } finally {
    await adminConn.close().catch(() => undefined);
  }
}

/** Candidate URIs in priority order: bundled mongod first, then the cloud. */
function candidateUris(): { uri: string; mode: DbMode }[] {
  const seen = new Set<string>();
  const candidates: { uri: string; mode: DbMode }[] = [];

  const push = (uri: string | undefined, mode: DbMode) => {
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    candidates.push({ uri, mode });
  };

  push(env.LOCAL_MONGODB_URI, 'local');
  push(env.CLOUD_MONGODB_URI, 'cloud');
  push(env.MONGODB_URI, env.MONGODB_URI?.includes('127.0.0.1') || env.MONGODB_URI?.includes('localhost') ? 'local' : 'cloud');

  return candidates;
}

async function tryConnect(uri: string, mode: DbMode): Promise<boolean> {
  try {
    if (mode === 'local') {
      await ensureReplicaSet(portOf(uri));
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    dbMode = mode;
    console.log(
      mode === 'local'
        ? `🗄️  Connected to the on-device database (${mongoose.connection.host}) — offline mode available.`
        : `☁️  Connected to the cloud database (${mongoose.connection.host}).`
    );
    return true;
  } catch (error: any) {
    console.warn(`Database unavailable (${mode}): ${error?.message || error}`);
    await mongoose.disconnect().catch(() => undefined);
    return false;
  }
}

/**
 * Connects, and keeps retrying in the background if nothing is reachable —
 * an offline shop should come back to life on its own once the database or the
 * internet returns.
 */
export const connectDB = async (): Promise<void> => {
  const candidates = candidateUris();

  if (candidates.length === 0) {
    console.error('No database is configured (LOCAL_MONGODB_URI / MONGODB_URI are both empty).');
    return;
  }

  for (const candidate of candidates) {
    if (await tryConnect(candidate.uri, candidate.mode)) return;
  }

  console.error('⚠️  No database is reachable right now. Retrying every 15 seconds…');
  scheduleRetry(candidates);
};

function scheduleRetry(candidates: { uri: string; mode: DbMode }[]): void {
  if (retryTimer) return;

  retryTimer = setInterval(async () => {
    for (const candidate of candidates) {
      if (await tryConnect(candidate.uri, candidate.mode)) {
        clearInterval(retryTimer!);
        retryTimer = null;
        return;
      }
    }
  }, 15000);

  retryTimer.unref?.();
}

mongoose.connection.on('disconnected', () => {
  console.warn('Database disconnected. Retrying in the background…');
});

mongoose.connection.on('error', (err) => {
  console.error('Database error event:', err);
});
