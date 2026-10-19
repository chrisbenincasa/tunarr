import { describe, expect, test } from 'vitest';
import { selectEnabledLibraries } from './useMediaSourceLibraries.ts';

describe('selectEnabledLibraries', () => {
  test('drops libraries that are not enabled', () => {
    const libraries = [
      { id: 'movies', enabled: true },
      { id: 'shows', enabled: false },
      { id: 'music', enabled: true },
    ];

    expect(selectEnabledLibraries(libraries).map((lib) => lib.id)).toEqual([
      'movies',
      'music',
    ]);
  });
});
