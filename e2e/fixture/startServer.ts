import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DB_DIR, REPO_ROOT, SEARCH_PORT, SERVER_PORT, WEB_URL } from './env.ts';
import { ensureMedia } from './media.ts';

// Every run starts from an empty database. The seed step builds the fixture
// through the API once the server is up.

rmSync(DB_DIR, { recursive: true, force: true });
mkdirSync(DB_DIR, { recursive: true });
ensureMedia();

const serverDir = path.join(REPO_ROOT, 'server');

const child = spawn(
  'pnpm',
  [
    'exec',
    'tsx',
    '--tsconfig',
    './tsconfig.build.json',
    'src/index.ts',
    '--database',
    DB_DIR,
    'server',
    '--port',
    String(SERVER_PORT),
  ],
  {
    cwd: serverDir,
    stdio: 'inherit',
    env: {
      ...process.env,

      // Matches `pnpm dev`. Outside dev mode the server starts a worker pool
      // whose threads cannot resolve the `@/` alias under tsx.
      NODE_ENV: 'development',
      TUNARR_SERVER_PORT: String(SERVER_PORT),
      TUNARR_SEARCH_PORT: String(SEARCH_PORT),
      TUNARR_CORS_ORIGINS: WEB_URL,
    },
  },
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code) => process.exit(code ?? 0));
