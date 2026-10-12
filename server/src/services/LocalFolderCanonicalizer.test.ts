import type { Dirent, Stats } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { FolderAndContents } from './LocalFolderCanonicalizer.ts';
import { LocalFolderCanonicalizer } from './LocalFolderCanonicalizer.ts';

function entry(name: string, mtimeMs: number) {
  return {
    dirent: { name } as Dirent,
    stats: { mtimeMs } as Stats,
  };
}

function folder(contents: FolderAndContents['contents']): FolderAndContents {
  return {
    folderName: '/library/folder',
    folderStats: { mtimeMs: 1000 } as Stats,
    contents,
  };
}

describe('LocalFolderCanonicalizer', () => {
  const canonicalizer = new LocalFolderCanonicalizer();

  test('ignores the order that entries are listed in', () => {
    const a = entry('a.mkv', 1);
    const b = entry('b.mkv', 2);

    expect(canonicalizer.getCanonicalId(folder([a, b]))).toEqual(
      canonicalizer.getCanonicalId(folder([b, a])),
    );
  });

  test('changes when a file mtime changes', () => {
    expect(
      canonicalizer.getCanonicalId(folder([entry('a.mkv', 1)])),
    ).not.toEqual(canonicalizer.getCanonicalId(folder([entry('a.mkv', 2)])));
  });
});
