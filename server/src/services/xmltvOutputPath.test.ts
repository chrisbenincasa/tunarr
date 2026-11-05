import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  canWriteXmlTvOutputPath,
  resolveXmlTvOutputPath,
} from './xmltvOutputPath.ts';

const isRoot = process.getuid?.() === 0;

describe('canWriteXmlTvOutputPath', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-xmltv-'));
  });

  afterEach(async () => {
    await fs.chmod(tmpDir, 0o755).catch(() => void 0);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('accepts a path whose file does not exist yet', async () => {
    const outputPath = path.join(tmpDir, 'xmltv.xml');

    await expect(canWriteXmlTvOutputPath(outputPath)).resolves.toBe(true);
  });

  test('accepts an existing writable file', async () => {
    const outputPath = path.join(tmpDir, 'xmltv.xml');
    await fs.writeFile(outputPath, '<tv/>');

    await expect(canWriteXmlTvOutputPath(outputPath)).resolves.toBe(true);
  });

  test('rejects a missing directory without creating it', async () => {
    const outputPath = path.join(tmpDir, 'unmounted', 'xmltv.xml');

    await expect(canWriteXmlTvOutputPath(outputPath)).resolves.toBe(false);

    await expect(fs.stat(path.dirname(outputPath))).rejects.toThrow();
  });

  test('rejects an empty path', async () => {
    await expect(canWriteXmlTvOutputPath('')).resolves.toBe(false);
    await expect(canWriteXmlTvOutputPath('   ')).resolves.toBe(false);
  });

  test('rejects a path with a trailing separator', async () => {
    const outputPath = path.join(tmpDir, 'xmltv.xml') + '/';

    await expect(canWriteXmlTvOutputPath(outputPath)).resolves.toBe(false);
  });

  test('rejects a path that is a directory', async () => {
    const outputPath = path.join(tmpDir, 'xmltv.xml');
    await fs.mkdir(outputPath);

    await expect(canWriteXmlTvOutputPath(outputPath)).resolves.toBe(false);
  });

  test('rejects a path whose parent is a file', async () => {
    const parent = path.join(tmpDir, 'not-a-dir');
    await fs.writeFile(parent, '');

    await expect(
      canWriteXmlTvOutputPath(path.join(parent, 'xmltv.xml')),
    ).resolves.toBe(false);
  });

  test.skipIf(isRoot)('rejects a read-only directory', async () => {
    await fs.chmod(tmpDir, 0o555);

    await expect(
      canWriteXmlTvOutputPath(path.join(tmpDir, 'xmltv.xml')),
    ).resolves.toBe(false);
  });
});

describe('resolveXmlTvOutputPath', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-xmltv-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('uses the configured path when it is writable', async () => {
    const configured = path.join(tmpDir, 'custom', 'xmltv.xml');
    const fallback = path.join(tmpDir, 'xmltv.xml');
    await fs.mkdir(path.dirname(configured));

    await expect(resolveXmlTvOutputPath(configured, fallback)).resolves.toBe(
      configured,
    );
  });

  test('uses the fallback when the configured path is not writable', async () => {
    const blocker = path.join(tmpDir, 'not-a-dir');
    await fs.writeFile(blocker, '');
    const configured = path.join(blocker, 'xmltv.xml');
    const fallback = path.join(tmpDir, 'xmltv.xml');

    await expect(resolveXmlTvOutputPath(configured, fallback)).resolves.toBe(
      fallback,
    );
  });

  test('returns to the configured path once it becomes writable', async () => {
    const mount = path.join(tmpDir, 'mount');
    const configured = path.join(mount, 'xmltv.xml');
    const fallback = path.join(tmpDir, 'xmltv.xml');

    await expect(resolveXmlTvOutputPath(configured, fallback)).resolves.toBe(
      fallback,
    );

    await fs.mkdir(mount);

    await expect(resolveXmlTvOutputPath(configured, fallback)).resolves.toBe(
      configured,
    );
  });
});
