import type { MediaSourceSettings } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { defaultLibrarySearchFilter } from './programUtil.ts';

const typeValue = (filter: ReturnType<typeof defaultLibrarySearchFilter>) =>
  filter?.type === 'value' ? filter.fieldSpec.value : undefined;

describe('defaultLibrarySearchFilter', () => {
  test('limits a TV library to shows', () => {
    expect(
      typeValue(defaultLibrarySearchFilter(undefined, { mediaType: 'shows' })),
    ).toEqual(['show']);
  });

  test('limits a music library to artists', () => {
    expect(
      typeValue(defaultLibrarySearchFilter(undefined, { mediaType: 'tracks' })),
    ).toEqual(['artist']);
  });

  test('uses the media type of a local source when there is no library', () => {
    const source = {
      type: 'local',
      mediaType: 'movies',
    } as MediaSourceSettings;

    expect(typeValue(defaultLibrarySearchFilter(source, undefined))).toEqual([
      'movie',
    ]);
  });

  test('returns null when neither a library nor a local source gives a type', () => {
    const source = { type: 'plex' } as MediaSourceSettings;

    expect(defaultLibrarySearchFilter(source, undefined)).toBeNull();
  });
});
