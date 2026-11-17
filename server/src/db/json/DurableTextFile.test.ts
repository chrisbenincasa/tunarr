import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DurableTextFile, DurableTextFileSync } from './DurableTextFile.ts';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-durable-text-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('DurableTextFile', () => {
  test('reads a missing file as null', async () => {
    const file = new DurableTextFile(path.join(dir, 'missing.json'));

    await expect(file.read()).resolves.toBeNull();
  });

  test('reads the contents of an existing file', async () => {
    const filePath = path.join(dir, 'settings.json');
    await fs.writeFile(filePath, '{"a":1}');

    await expect(new DurableTextFile(filePath).read()).resolves.toBe('{"a":1}');
  });

  test('throws when the path is not a readable file', async () => {
    await expect(new DurableTextFile(dir).read()).rejects.toMatchObject({
      code: 'EISDIR',
    });
  });

  test('writes contents that read back', async () => {
    const file = new DurableTextFile(path.join(dir, 'settings.json'));

    await file.write('{"b":2}');

    await expect(file.read()).resolves.toBe('{"b":2}');
  });
});

describe('DurableTextFileSync', () => {
  test('reads a missing file as null', () => {
    const file = new DurableTextFileSync(path.join(dir, 'missing.json'));

    expect(file.read()).toBeNull();
  });

  test('throws when the path is not a readable file', () => {
    expect(() => new DurableTextFileSync(dir).read()).toThrow(
      expect.objectContaining({ code: 'EISDIR' }),
    );
  });

  test('writes contents that read back', () => {
    const file = new DurableTextFileSync(path.join(dir, 'settings.json'));

    file.write('{"c":3}');

    expect(file.read()).toBe('{"c":3}');
  });
});
