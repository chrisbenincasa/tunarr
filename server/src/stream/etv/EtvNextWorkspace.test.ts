import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  DefaultStalenessMs,
  EtvNextNotReadyError,
  EtvNextWorkspace,
  HeartbeatTimeoutMs,
  PlayoutVersion,
} from './EtvNextWorkspace.ts';
import type { PlayoutItem } from './generated/playout.ts';

let base: string;
let workspace: EtvNextWorkspace;

const channelUuid = 'abc-123';

const item = (id: string): PlayoutItem => ({
  id,
  start: '2026-02-23T20:00:00.000-05:00',
  finish: '2026-02-23T20:30:00.000-05:00',
  source: { source_type: 'local', path: '/media/a.mkv' },
});

beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-workspace-'));
  workspace = new EtvNextWorkspace(base, channelUuid);
  await workspace.initialize();
});

afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

describe('layout', () => {
  test('roots everything under a per-channel directory', () => {
    expect(workspace.root).toBe(path.join(base, `etv_${channelUuid}`));
    expect(workspace.channelConfigPath).toBe(
      path.join(workspace.root, 'channel.json'),
    );
    expect(workspace.playoutDirectory).toBe(
      path.join(workspace.root, 'playout'),
    );
    expect(workspace.outputDirectory).toBe(path.join(workspace.root, 'out'));
  });

  test('puts the signal files and playlist where the worker writes them', () => {
    expect(workspace.readyFilePath).toBe(
      path.join(workspace.outputDirectory, '.ready'),
    );
    expect(workspace.heartbeatFilePath).toBe(
      path.join(workspace.outputDirectory, '.heartbeat'),
    );
    expect(workspace.mediaPlaylistPath).toBe(
      path.join(workspace.outputDirectory, 'live.m3u8'),
    );
  });

  test('initialize clears a directory left behind by an earlier session', async () => {
    const stale = path.join(workspace.outputDirectory, 'live000000.ts');
    await fs.writeFile(stale, 'old');

    await workspace.initialize();

    expect(await fs.readdir(workspace.outputDirectory)).toEqual([]);
  });

  test('cleanup removes the whole channel directory', async () => {
    await workspace.cleanup();

    await expect(fs.stat(workspace.root)).rejects.toThrow();
  });
});

describe('playout windows', () => {
  test('names the file by its epoch millisecond bounds', async () => {
    const written = await workspace.writePlayoutWindow(1000, 2000, [item('1')]);

    expect(path.basename(written)).toBe('1000_2000.json');
  });

  test('writes the version upstream parses against', async () => {
    await workspace.writePlayoutWindow(1000, 2000, [item('1')]);
    const parsed = JSON.parse(
      await fs.readFile(
        path.join(workspace.playoutDirectory, '1000_2000.json'),
        'utf-8',
      ),
    );

    expect(parsed.version).toBe(PlayoutVersion);
    expect(parsed.items).toHaveLength(1);
  });

  // Upstream picks the window by first match over readdir, which is filesystem
  // order. Two windows on disk would be chosen between nondeterministically.
  test('keeps exactly one window, deleting the one it supersedes', async () => {
    await workspace.writePlayoutWindow(1000, 2000, [item('1')]);
    await workspace.writePlayoutWindow(2000, 3000, [item('2')]);

    expect(await fs.readdir(workspace.playoutDirectory)).toEqual([
      '2000_3000.json',
    ]);
  });

  test('leaves no temp file behind for the worker to trip over', async () => {
    await workspace.writePlayoutWindow(1000, 2000, [item('1')]);

    const names = await fs.readdir(workspace.playoutDirectory);
    expect(names.some((n) => n.endsWith('.tmp'))).toBe(false);
  });
});

describe('the ready protocol', () => {
  test('returns as soon as the worker publishes the file', async () => {
    setTimeout(() => {
      void fs.writeFile(workspace.readyFilePath, '');
    }, 150);

    await expect(
      workspace.waitForReady(() => true, 5000),
    ).resolves.toBeUndefined();
  });

  test('gives up at the deadline', async () => {
    await expect(workspace.waitForReady(() => true, 400)).rejects.toThrow(
      EtvNextNotReadyError,
    );
  });

  test('gives up early when the worker dies before signalling', async () => {
    const start = Date.now();

    await expect(workspace.waitForReady(() => false, 10_000)).rejects.toThrow(
      EtvNextNotReadyError,
    );

    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('the heartbeat protocol', () => {
  test('creates the file when the worker has not yet written it', async () => {
    await workspace.recordHeartbeat();

    await expect(fs.stat(workspace.heartbeatFilePath)).resolves.toBeDefined();
  });

  test('moves the mtime forward on an existing file', async () => {
    await fs.writeFile(workspace.heartbeatFilePath, '');
    const old = new Date(Date.now() - 60_000);
    await fs.utimes(workspace.heartbeatFilePath, old, old);

    await workspace.recordHeartbeat();

    const { mtimeMs } = await fs.stat(workspace.heartbeatFilePath);
    expect(Date.now() - mtimeMs).toBeLessThan(5000);
  });

  // Tunarr's connection tracker has to give up first, or the worker reaps
  // itself while Tunarr still believes the session is live. Tunarr's global
  // default is 120s, which is on the wrong side of this.
  test('the session staleness window closes before the worker reaps itself', () => {
    expect(HeartbeatTimeoutMs).toBe(90_000);
    expect(DefaultStalenessMs).toBeLessThan(HeartbeatTimeoutMs);
    expect(DefaultStalenessMs).toBeLessThan(120_000);
  });
});
