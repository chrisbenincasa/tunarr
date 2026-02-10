import type { ProgramOrFolder } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { getChildSearchFilter } from './useProgramSearch';

const createProgram = (
  type: ProgramOrFolder['type'],
  uuid = 'test-uuid',
): ProgramOrFolder =>
  ({
    type,
    uuid,
    title: 'Test Program',
    libraryId: 'lib-1',
  }) as ProgramOrFolder;

describe('getChildSearchFilter', () => {
  describe('leaf types return null', () => {
    test('returns null for episode', () => {
      const result = getChildSearchFilter(createProgram('episode'));
      expect(result).toBeNull();
    });

    test('returns null for movie', () => {
      const result = getChildSearchFilter(createProgram('movie'));
      expect(result).toBeNull();
    });

    test('returns null for track', () => {
      const result = getChildSearchFilter(createProgram('track'));
      expect(result).toBeNull();
    });

    test('returns null for music_video', () => {
      const result = getChildSearchFilter(createProgram('music_video'));
      expect(result).toBeNull();
    });

    test('returns null for other_video', () => {
      const result = getChildSearchFilter(createProgram('other_video'));
      expect(result).toBeNull();
    });

    test('returns null for collection', () => {
      const result = getChildSearchFilter(createProgram('collection'));
      expect(result).toBeNull();
    });

    test('returns null for folder', () => {
      const result = getChildSearchFilter(createProgram('folder'));
      expect(result).toBeNull();
    });

    test('returns null for playlist', () => {
      const result = getChildSearchFilter(createProgram('playlist'));
      expect(result).toBeNull();
    });
  });

  describe('parent types return filters for children', () => {
    test('returns season filter for show', () => {
      const show = createProgram('show', 'show-uuid-123');
      const result = getChildSearchFilter(show);

      expect(result).toEqual({
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              op: '=',
              type: 'string',
              value: ['season'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'parent.id',
              name: '',
              op: '=',
              type: 'string',
              value: ['show-uuid-123'],
            },
          },
        ],
      });
    });

    test('returns episode filter for season', () => {
      const season = createProgram('season', 'season-uuid-456');
      const result = getChildSearchFilter(season);

      expect(result).toEqual({
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              op: '=',
              type: 'string',
              value: ['episode'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'parent.id',
              name: '',
              op: '=',
              type: 'string',
              value: ['season-uuid-456'],
            },
          },
        ],
      });
    });

    test('returns album filter for artist', () => {
      const artist = createProgram('artist', 'artist-uuid-789');
      const result = getChildSearchFilter(artist);

      expect(result).toEqual({
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              op: '=',
              type: 'string',
              value: ['album'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'parent.id',
              name: '',
              op: '=',
              type: 'string',
              value: ['artist-uuid-789'],
            },
          },
        ],
      });
    });

    test('returns track filter for album', () => {
      const album = createProgram('album', 'album-uuid-012');
      const result = getChildSearchFilter(album);

      expect(result).toEqual({
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              op: '=',
              type: 'string',
              value: ['track'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'parent.id',
              name: '',
              op: '=',
              type: 'string',
              value: ['album-uuid-012'],
            },
          },
        ],
      });
    });
  });
});
