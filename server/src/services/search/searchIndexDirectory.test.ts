import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { prepareSearchIndexDirectory } from './searchIndexDirectory.ts';

const logger = {
  warn: vi.fn(),
} as unknown as Logger;

describe('prepareSearchIndexDirectory', () => {
  let root: string;
  let dbPath: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-search-index-'));
    dbPath = path.join(root, 'data.ms');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test('reports a missing directory without touching anything', async () => {
    await expect(prepareSearchIndexDirectory(dbPath, logger)).resolves.toEqual({
      type: 'missing',
    });
    expect(await fs.readdir(root)).toEqual([]);
  });

  test('leaves a directory with a VERSION file alone', async () => {
    await fs.mkdir(path.join(dbPath, 'tasks'), { recursive: true });
    await fs.writeFile(path.join(dbPath, 'VERSION'), '1.30.0');
    await fs.writeFile(path.join(dbPath, 'tasks', 'data.mdb'), 'x');

    await expect(prepareSearchIndexDirectory(dbPath, logger)).resolves.toEqual({
      type: 'ok',
    });
    expect(await fs.readFile(path.join(dbPath, 'VERSION'), 'utf-8')).toBe(
      '1.30.0',
    );
  });

  test('removes a directory tree that contains no files', async () => {
    // The shape left behind when macOS cleans old files out of $TMPDIR.
    await fs.mkdir(path.join(dbPath, 'indexes', 'some-uuid'), {
      recursive: true,
    });
    await fs.mkdir(path.join(dbPath, 'tasks'));
    await fs.mkdir(path.join(dbPath, 'auth'));

    await expect(prepareSearchIndexDirectory(dbPath, logger)).resolves.toEqual({
      type: 'removed_empty',
      reason: 'missing_version',
    });
    expect(await fs.readdir(root)).toEqual([]);
  });

  test('moves aside a directory with data but no VERSION file', async () => {
    await fs.mkdir(path.join(dbPath, 'indexes', 'some-uuid'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(dbPath, 'indexes', 'some-uuid', 'data.mdb'),
      'index data',
    );

    const result = await prepareSearchIndexDirectory(dbPath, logger, () => 123);

    const movedTo = `${dbPath}.broken-123`;
    expect(result).toEqual({
      type: 'moved_aside',
      reason: 'missing_version',
      movedTo,
    });
    expect(await fs.readdir(root)).toEqual(['data.ms.broken-123']);
    expect(
      await fs.readFile(
        path.join(movedTo, 'indexes', 'some-uuid', 'data.mdb'),
        'utf-8',
      ),
    ).toBe('index data');
  });

  test.each(['1.30.0', '1.30.0\n'])(
    'accepts VERSION contents %j',
    async (contents) => {
      await fs.mkdir(dbPath);
      await fs.writeFile(path.join(dbPath, 'VERSION'), contents);
      await fs.writeFile(path.join(dbPath, 'data.mdb'), 'x');

      await expect(
        prepareSearchIndexDirectory(dbPath, logger),
      ).resolves.toEqual({ type: 'ok' });
      expect(await fs.readdir(root)).toEqual(['data.ms']);
    },
  );

  // An empty VERSION is what a crash right after Meilisearch rewrites it
  // leaves behind.
  test.each(['', 'garbage', '1.30'])(
    'moves aside a directory with data and VERSION contents %j',
    async (contents) => {
      await fs.mkdir(path.join(dbPath, 'tasks'), { recursive: true });
      await fs.writeFile(path.join(dbPath, 'VERSION'), contents);
      await fs.writeFile(path.join(dbPath, 'tasks', 'data.mdb'), 'index data');

      const result = await prepareSearchIndexDirectory(
        dbPath,
        logger,
        () => 123,
      );

      const movedTo = `${dbPath}.broken-123`;
      expect(result).toEqual({
        type: 'moved_aside',
        reason: 'invalid_version',
        movedTo,
      });
      expect(await fs.readdir(root)).toEqual(['data.ms.broken-123']);
      expect(
        await fs.readFile(path.join(movedTo, 'tasks', 'data.mdb'), 'utf-8'),
      ).toBe('index data');
      expect(await fs.readFile(path.join(movedTo, 'VERSION'), 'utf-8')).toBe(
        contents,
      );
    },
  );

  test('removes a directory whose only file is an invalid VERSION', async () => {
    await fs.mkdir(path.join(dbPath, 'indexes'), { recursive: true });
    await fs.writeFile(path.join(dbPath, 'VERSION'), '');

    await expect(prepareSearchIndexDirectory(dbPath, logger)).resolves.toEqual({
      type: 'removed_empty',
      reason: 'invalid_version',
    });
    expect(await fs.readdir(root)).toEqual([]);
  });

  test('says the VERSION file was invalid, not missing', async () => {
    const warn = vi.fn();
    await fs.mkdir(dbPath);
    await fs.writeFile(path.join(dbPath, 'VERSION'), '');
    await fs.writeFile(path.join(dbPath, 'data.mdb'), 'x');

    await prepareSearchIndexDirectory(dbPath, { warn } as unknown as Logger);

    expect(warn).toHaveBeenCalledWith(
      expect.any(String),
      dbPath,
      'has an invalid VERSION file',
      expect.any(String),
    );
  });
});
