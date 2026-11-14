import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import serverPackage from '../../../package.json' with { type: 'json' };
import { buildMeilisearchArgs } from './meilisearchArgs.ts';

const baseOpts = {
  port: 7700,
  dbPath: '/data/data.ms',
  snapshotDir: '/data/ms-snapshots',
  snapshotIntervalSeconds: 14400,
};

describe('buildMeilisearchArgs', () => {
  test('builds the minimal command line', () => {
    expect(buildMeilisearchArgs(baseOpts)).toEqual([
      '--http-addr',
      'localhost:7700',
      '--db-path',
      '/data/data.ms',
      '--no-analytics',
      '--upgrade-db',
      '--schedule-snapshot',
      '14400',
      '--snapshot-dir',
      '/data/ms-snapshots',
    ]);
  });

  test('adds optional flags when set', () => {
    const args = buildMeilisearchArgs({
      ...baseOpts,
      importSnapshotPath: '/data/ms-snapshots/data.ms.snapshot',
      maxIndexingMemory: '2Gb',
      maxIndexingThreads: 4,
      reduceIndexingMemoryUsage: true,
    });

    expect(args).toEqual(
      expect.arrayContaining([
        '--import-snapshot',
        '/data/ms-snapshots/data.ms.snapshot',
        '--max-indexing-memory',
        '2Gb',
        '--max-indexing-threads',
        '4',
        '--experimental-reduce-indexing-memory-usage',
      ]),
    );
  });

  test('rounds the snapshot interval to whole seconds', () => {
    const args = buildMeilisearchArgs({
      ...baseOpts,
      snapshotIntervalSeconds: 5400.4,
    });
    expect(args[args.indexOf('--schedule-snapshot') + 1]).toEqual('5400');
  });
});

// The download script writes the binary to server/bin/meilisearch. Run it only
// when that binary is the pinned version, so a stale download can't pass.
const binaryPath = path.resolve(
  import.meta.dirname,
  '../../../bin',
  os.platform() === 'win32' ? 'meilisearch.exe' : 'meilisearch',
);

function pinnedBinaryAvailable() {
  if (!existsSync(binaryPath)) {
    return false;
  }
  try {
    const out = execFileSync(binaryPath, ['--version'], { encoding: 'utf-8' });
    return out.includes(serverPackage.meilisearch.version);
  } catch {
    return false;
  }
}

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('No port assigned')),
      );
    });
  });
}

describe.skipIf(!pinnedBinaryAvailable())('pinned Meilisearch binary', () => {
  test('starts with every flag Tunarr passes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-ms-args-'));
    const port = await freePort();
    const args = buildMeilisearchArgs({
      port,
      dbPath: path.join(root, 'data.ms'),
      snapshotDir: path.join(root, 'ms-snapshots'),
      snapshotIntervalSeconds: 3600,
      maxIndexingMemory: '256Mb',
      maxIndexingThreads: 1,
      reduceIndexingMemoryUsage: os.platform() !== 'win32',
    });

    const proc = spawn(binaryPath, args, { cwd: root });
    let output = '';
    proc.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    proc.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const exited = new Promise<number | null>((resolve) =>
      proc.on('exit', resolve),
    );

    try {
      const deadline = Date.now() + 15_000;
      let healthy = false;
      while (!healthy && Date.now() < deadline && proc.exitCode === null) {
        healthy = await fetch(`http://localhost:${port}/health`)
          .then((res) => res.ok)
          .catch(() => false);
        if (!healthy) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      expect(healthy, output).toBe(true);
    } finally {
      proc.kill();
      await exited;
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 20_000);
});
