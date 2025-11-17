import { changeFileExtension } from './fsUtil.ts';

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
});
