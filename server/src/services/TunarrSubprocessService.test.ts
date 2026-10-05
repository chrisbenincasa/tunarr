import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { workerEntryUrl } from './TunarrSubprocessService.ts';

/**
 * The Windows cases here run on any platform.
 *
 * `new URL()` parsing is defined by the WHATWG URL spec, not by the host OS, so
 * a Windows-shaped path misparses identically on Linux. That makes the bug this
 * guards against reproducible in CI without a Windows runner.
 */
describe('workerEntryUrl', () => {
  test('produces a file: URL for a POSIX absolute path', () => {
    const url = workerEntryUrl('/opt/tunarr/dist/bundle.cjs');

    expect(url.protocol).toBe('file:');
    expect(url.href).toBe('file:///opt/tunarr/dist/bundle.cjs');
  });

  test('round-trips a real absolute path back to the same path', () => {
    const entry = path.resolve(process.cwd(), 'dist', 'bundle.cjs');

    expect(workerEntryUrl(entry).protocol).toBe('file:');
  });

  describe('the resolution that used to be here', () => {
    // Regression guard. Restoring `new URL(entryPath, import.meta.url)` would
    // reintroduce a bug that only ever showed up in the packaged Windows build,
    // where process.argv[1] is a drive-letter path.
    const base = 'file:///opt/tunarr/dist/bundle.cjs';

    test.each([
      ['backslashes', 'C:\\Program Files\\Tunarr\\bundle.cjs'],
      ['forward slashes', 'C:/Program Files/Tunarr/bundle.cjs'],
    ])(
      'new URL() parses a Windows path with %s as a "c:" scheme, not a file URL',
      (_label, windowsPath) => {
        const wrong = new URL(windowsPath, base);

        // The drive letter is taken as the URL scheme, so the base is ignored
        // entirely and Worker is handed something it will not accept.
        expect(wrong.protocol).toBe('c:');
        expect(wrong.protocol).not.toBe('file:');
      },
    );

    test('a POSIX path is why this went unnoticed — it resolves fine', () => {
      expect(new URL('/opt/tunarr/dist/bundle.cjs', base).protocol).toBe(
        'file:',
      );
    });
  });
});
