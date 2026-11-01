import { describe, expect, test } from 'vitest';

// PR CI never compiles the catalogs, so a bad merge only fails the release bundle.

const catalogs = import.meta.glob<string>('./*/messages.po', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const conflictMarker = /<<<<<<<|=======|>>>>>>>/;

describe('lingui catalogs', () => {
  test('every locale has a catalog', () => {
    expect(Object.keys(catalogs).sort()).toEqual([
      './en/messages.po',
      './es/messages.po',
      './pseudo-LOCALE/messages.po',
      './zh-CN/messages.po',
    ]);
  });

  test.each(Object.entries(catalogs))(
    '%s has no merge conflict markers',
    (_path, contents) => {
      const marked = contents
        .split('\n')
        .filter((line) => conflictMarker.test(line));
      expect(marked).toEqual([]);
    },
  );
});
