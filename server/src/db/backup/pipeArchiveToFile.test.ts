import archiver from 'archiver';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeArchiveToFile } from './pipeArchiveToFile.ts';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-archive-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

test('rejects when the destination cannot be written', async () => {
  const archive = archiver('tar');
  // A directory is not a writable destination; the write stream errors.
  const written = pipeArchiveToFile(archive, dir);

  archive.append('some contents', { name: 'entry.txt' });
  await archive.finalize().catch(() => void 0);

  await expect(written).rejects.toThrow();
});

test('resolves only once the whole archive is on disk', async () => {
  const dest = path.join(dir, 'backup.tar');
  const archive = archiver('tar');
  const written = pipeArchiveToFile(archive, dest);

  // Large enough that the destination is still flushing when the archiver's
  // own 'end' fires -- resolving on that would report a truncated file.
  const payload = 'x'.repeat(8 * 1024 * 1024);
  archive.append(payload, { name: 'big.txt' });
  await archive.finalize();
  await written;

  const { size } = await fs.stat(dest);
  expect(size).toBeGreaterThanOrEqual(payload.length);
});

test('rejects when the archive itself fails', async () => {
  const dest = path.join(dir, 'backup.tar');
  const archive = archiver('tar');
  const written = pipeArchiveToFile(archive, dest);

  archive.emit('error', new Error('archive blew up'));

  await expect(written).rejects.toThrow('archive blew up');
});

// archiver reports a missing entry as a 'warning', not an 'error', so the entry
// is dropped and the archive still completes. Left unobserved that produces a
// backup that is reported as successful but is missing files.
test('reports entries it could not add instead of dropping them silently', async () => {
  const dest = path.join(dir, 'backup.tar');
  const archive = archiver('tar');
  const warnings: Error[] = [];
  const written = pipeArchiveToFile(archive, dest, (e) => warnings.push(e));

  archive.file('/does/not/exist/at/all.db', { name: 'db.db' });
  await archive.finalize();
  await written;

  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatchObject({ code: 'ENOENT' });
});
