import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeFileAtomic } from './fsUtil.ts';

// Deliberately kept out of fsUtil.test.ts: that file mocks node:fs/promises
// module-wide, and these tests need the real filesystem to say anything
// meaningful about atomicity.

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-atomic-write-'));
});

afterEach(async () => {
  await fs.chmod(dir, 0o700).catch(() => void 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test('writes the content to the destination', async () => {
  const dest = path.join(dir, 'lineup.json');

  await writeFileAtomic(dest, '{"items":[]}');

  await expect(fs.readFile(dest, 'utf-8')).resolves.toEqual('{"items":[]}');
});

test('replaces existing content', async () => {
  const dest = path.join(dir, 'lineup.json');
  await fs.writeFile(dest, '{"items":["old"]}');

  await writeFileAtomic(dest, '{"items":["new"]}');

  await expect(fs.readFile(dest, 'utf-8')).resolves.toEqual(
    '{"items":["new"]}',
  );
});

test('does not leave the scratch file behind', async () => {
  const dest = path.join(dir, 'lineup.json');

  await writeFileAtomic(dest, '{"items":[]}');

  await expect(fs.readdir(dir)).resolves.toEqual(['lineup.json']);
});

// A non-atomic write truncates the destination before writing, so a failure
// part-way through leaves a zero-length or partial file. Writing to a scratch
// file and renaming into place means a failed write cannot touch the
// destination at all. Read-only directory permissions discriminate the two:
// they block creating the scratch file, but not overwriting an existing file.
// Verified: with a plain fs.writeFile this test fails on both assertions.
test('leaves the previous contents intact when the write fails', async () => {
  if (process.getuid?.() === 0) {
    return; // root ignores the permission bits this relies on
  }

  const dest = path.join(dir, 'lineup.json');
  const original = '{"items":["original"]}';
  await fs.writeFile(dest, original);
  await fs.chmod(dir, 0o500);

  await expect(
    writeFileAtomic(dest, '{"items":["replacement"]}'),
  ).rejects.toThrow();

  await expect(fs.readFile(dest, 'utf-8')).resolves.toEqual(original);
});
