import type { ContentProgram, CustomProgram, FlexProgram, RedirectProgram } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import type { UIChannelProgram } from '../../types/index';
import { removeDuplicatePrograms } from './useRemoveDuplicates';

const createContentProgram = (
  id: string,
  overrides: Partial<ContentProgram> = {},
): UIChannelProgram<ContentProgram> => ({
  type: 'content',
  id,
  persisted: true,
  subtype: 'movie',
  title: `Movie ${id}`,
  duration: 3600000,
  externalIds: [],
  uiIndex: 0,
  originalIndex: 0,
  ...overrides,
});

const createFlexProgram = (): UIChannelProgram<FlexProgram> => ({
  type: 'flex',
  duration: 60000,
  persisted: false,
  uiIndex: 0,
  originalIndex: 0,
});

const createRedirectProgram = (channel: string): UIChannelProgram<RedirectProgram> => ({
  type: 'redirect',
  channel,
  duration: 3600000,
  persisted: false,
  uiIndex: 0,
  originalIndex: 0,
});

const createCustomProgram = (
  customShowId: string,
  id: string,
): UIChannelProgram<CustomProgram> => ({
  type: 'custom',
  customShowId,
  id,
  duration: 3600000,
  persisted: false,
  uiIndex: 0,
  originalIndex: 0,
});

describe('removeDuplicatePrograms', () => {
  test('removes all flex programs', () => {
    const programs: UIChannelProgram[] = [
      createContentProgram('1'),
      createFlexProgram(),
      createContentProgram('2'),
      createFlexProgram(),
    ];

    const result = removeDuplicatePrograms(programs);

    expect(result).toHaveLength(2);
    expect(result.every((p) => p.type !== 'flex')).toBe(true);
  });

  test('deduplicates by persisted id (database ID)', () => {
    const programs: UIChannelProgram[] = [
      createContentProgram('db-id-1'),
      createContentProgram('db-id-2'),
      createContentProgram('db-id-1'), // Duplicate
      createContentProgram('db-id-3'),
      createContentProgram('db-id-2'), // Duplicate
    ];

    const result = removeDuplicatePrograms(programs);

    expect(result).toHaveLength(3);
    expect(result.map((p) => (p as ContentProgram).id)).toEqual([
      'db-id-1',
      'db-id-2',
      'db-id-3',
    ]);
  });

  test('deduplicates by external ID (Plex/Jellyfin)', () => {
    const programWithExternalId = (
      internalId: string,
      externalId: string,
    ): UIChannelProgram<ContentProgram> =>
      createContentProgram(internalId, {
        persisted: false,
        externalIds: [
          {
            type: 'multi',
            source: 'plex',
            sourceId: 'server-1',
            id: externalId,
          },
        ],
      });

    const programs: UIChannelProgram[] = [
      programWithExternalId('a', 'plex-123'),
      programWithExternalId('b', 'plex-456'),
      programWithExternalId('c', 'plex-123'), // Duplicate external ID
    ];

    const result = removeDuplicatePrograms(programs);

    expect(result).toHaveLength(2);
  });

  test('keeps first occurrence of redirect programs (by channel)', () => {
    const programs: UIChannelProgram[] = [
      createRedirectProgram('channel-a'),
      createRedirectProgram('channel-b'),
      createRedirectProgram('channel-a'), // Duplicate channel
      createRedirectProgram('channel-c'),
    ];

    const result = removeDuplicatePrograms(programs);

    expect(result).toHaveLength(3);
    expect(result.map((p) => (p as RedirectProgram).channel)).toEqual([
      'channel-a',
      'channel-b',
      'channel-c',
    ]);
  });

  test('keeps first occurrence of custom programs (by customShowId + id)', () => {
    const programs: UIChannelProgram[] = [
      createCustomProgram('show-1', 'prog-a'),
      createCustomProgram('show-1', 'prog-b'),
      createCustomProgram('show-1', 'prog-a'), // Duplicate
      createCustomProgram('show-2', 'prog-a'), // Different show, same prog id - not duplicate
    ];

    const result = removeDuplicatePrograms(programs);

    expect(result).toHaveLength(3);
  });

  test('handles mixed program types correctly', () => {
    const programs: UIChannelProgram[] = [
      createContentProgram('content-1'),
      createFlexProgram(),
      createRedirectProgram('channel-1'),
      createContentProgram('content-1'), // Duplicate content
      createCustomProgram('show-1', 'custom-1'),
      createFlexProgram(), // Flex always removed
      createRedirectProgram('channel-1'), // Duplicate redirect
      createCustomProgram('show-1', 'custom-1'), // Duplicate custom
    ];

    const result = removeDuplicatePrograms(programs);

    // content-1 (1), channel-1 redirect (1), custom show-1/custom-1 (1)
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.type)).toEqual(['content', 'redirect', 'custom']);
  });

  test('handles empty array', () => {
    const result = removeDuplicatePrograms([]);
    expect(result).toEqual([]);
  });

  test('preserves order of first occurrences', () => {
    const programs: UIChannelProgram[] = [
      createContentProgram('3'),
      createContentProgram('1'),
      createContentProgram('2'),
      createContentProgram('1'), // Duplicate
    ];

    const result = removeDuplicatePrograms(programs);

    expect(result.map((p) => (p as ContentProgram).id)).toEqual(['3', '1', '2']);
  });
});
