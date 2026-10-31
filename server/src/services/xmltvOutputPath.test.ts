import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  prepareXmlTvOutputPath,
  resolveXmlTvOutputPath,
} from './xmltvOutputPath.ts';

const isRoot = process.getuid?.() === 0;

describe('prepareXmlTvOutputPath', () => {
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

    await expect(prepareXmlTvOutputPath(outputPath)).resolves.toBe(true);
  });

  test('accepts an existing writable file', async () => {
    const outputPath = path.join(tmpDir, 'xmltv.xml');
    await fs.writeFile(outputPath, '<tv/>');

    await expect(prepareXmlTvOutputPath(outputPath)).resolves.toBe(true);
  });

  test('creates missing parent directories', async () => {
    const outputPath = path.join(tmpDir, 'a', 'b', 'c', 'xmltv.xml');

    await expect(prepareXmlTvOutputPath(outputPath)).resolves.toBe(true);

    const stat = await fs.stat(path.dirname(outputPath));
    expect(stat.isDirectory()).toBe(true);
  });

  test('rejects a path that is a directory', async () => {
    const outputPath = path.join(tmpDir, 'xmltv.xml');
    await fs.mkdir(outputPath);

    await expect(prepareXmlTvOutputPath(outputPath)).resolves.toBe(false);
  });

  test('rejects a path whose parent is a file', async () => {
    const parent = path.join(tmpDir, 'not-a-dir');
    await fs.writeFile(parent, '');

    await expect(
      prepareXmlTvOutputPath(path.join(parent, 'xmltv.xml')),
    ).resolves.toBe(false);
  });

  test.skipIf(isRoot)('rejects a read-only directory', async () => {
    await fs.chmod(tmpDir, 0o555);

    await expect(
      prepareXmlTvOutputPath(path.join(tmpDir, 'xmltv.xml')),
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
    const blocker = path.join(tmpDir, 'mount');
    await fs.writeFile(blocker, '');
    const configured = path.join(blocker, 'xmltv.xml');
    const fallback = path.join(tmpDir, 'xmltv.xml');

    await expect(resolveXmlTvOutputPath(configured, fallback)).resolves.toBe(
      fallback,
    );

    await fs.rm(blocker);

    await expect(resolveXmlTvOutputPath(configured, fallback)).resolves.toBe(
      configured,
    );
  });
});
