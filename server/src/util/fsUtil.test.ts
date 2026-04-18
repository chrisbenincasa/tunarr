import fs from 'node:fs/promises';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { changeFileExtension, deleteUploadedFile } from './fsUtil.ts';

vi.mock('node:fs/promises', () => ({
  default: {
    unlink: vi.fn(),
  },
}));

describe('fsUtil', () => {
  describe('changeFileExtension', () => {
    test('changes extension on path', () => {
      const inPath = '/a/b/c/d.txt';
      const outPath = changeFileExtension(inPath, 'nfo');
      expect(outPath).toBe('/a/b/c/d.nfo');
    });

    test('handles extensions starting with dot', () => {
      const inPath = '/a/b/c/d.txt';
      const outPath = changeFileExtension(inPath, '.nfo');
      expect(outPath).toBe('/a/b/c/d.nfo');
    });
  });

  describe('deleteUploadedFile', () => {
    beforeEach(() => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
    });

    test('deletes the file at the given path', async () => {
      await deleteUploadedFile('/data/tunarr/images/uploads/icon.png');
      expect(fs.unlink).toHaveBeenCalledWith(
        '/data/tunarr/images/uploads/icon.png',
      );
    });

    test('propagates errors from fs.unlink', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('EACCES: permission denied'));
      await expect(
        deleteUploadedFile('/data/tunarr/images/uploads/icon.png'),
      ).rejects.toThrow('EACCES: permission denied');
    });
  });
});
