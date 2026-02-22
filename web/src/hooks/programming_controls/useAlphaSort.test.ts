import type { ChannelProgram, ContentProgram } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { sortPrograms } from './useAlphaSort';

const createContentProgram = (
  title: string,
  overrides: Partial<ContentProgram> = {},
): ContentProgram => ({
  type: 'content',
  id: `id-${title}`,
  persisted: true,
  subtype: 'movie',
  title,
  duration: 3600000,
  externalIds: [],
  ...overrides,
});

const createFlexProgram = (): ChannelProgram => ({
  type: 'flex',
  duration: 60000,
  persisted: false,
});

const createRedirectProgram = (channel: string): ChannelProgram => ({
  type: 'redirect',
  channel,
  duration: 3600000,
  persisted: false,
});

describe('sortPrograms', () => {
  test('sorts content programs alphabetically in ascending order', () => {
    const programs: ChannelProgram[] = [
      createContentProgram('Charlie'),
      createContentProgram('Alpha'),
      createContentProgram('Bravo'),
    ];

    const { newProgramSort } = sortPrograms(programs, 'asc');

    expect(newProgramSort.map((p) => (p as ContentProgram).title)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  test('sorts content programs alphabetically in descending order', () => {
    const programs: ChannelProgram[] = [
      createContentProgram('Alpha'),
      createContentProgram('Charlie'),
      createContentProgram('Bravo'),
    ];

    const { newProgramSort } = sortPrograms(programs, 'desc');

    expect(newProgramSort.map((p) => (p as ContentProgram).title)).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
  });

  test('content programs appear before non-content programs (flex, redirect)', () => {
    const programs: ChannelProgram[] = [
      createFlexProgram(),
      createContentProgram('Zebra'),
      createRedirectProgram('channel-1'),
      createContentProgram('Apple'),
    ];

    const { newProgramSort } = sortPrograms(programs, 'asc');

    // Content programs should come first, sorted alphabetically
    expect(newProgramSort[0].type).toBe('content');
    expect((newProgramSort[0] as ContentProgram).title).toBe('Apple');
    expect(newProgramSort[1].type).toBe('content');
    expect((newProgramSort[1] as ContentProgram).title).toBe('Zebra');
    // Non-content programs come after
    expect(newProgramSort[2].type).not.toBe('content');
    expect(newProgramSort[3].type).not.toBe('content');
  });

  test('handles empty array', () => {
    const programs: ChannelProgram[] = [];

    const { newProgramSort } = sortPrograms(programs, 'asc');

    expect(newProgramSort).toEqual([]);
  });

  test('handles array with single program', () => {
    const programs: ChannelProgram[] = [createContentProgram('Only One')];

    const { newProgramSort } = sortPrograms(programs, 'asc');

    expect(newProgramSort).toHaveLength(1);
    expect((newProgramSort[0] as ContentProgram).title).toBe('Only One');
  });

  test('handles programs with identical titles', () => {
    const programs: ChannelProgram[] = [
      createContentProgram('Same', { id: 'id-1' }),
      createContentProgram('Same', { id: 'id-2' }),
      createContentProgram('Same', { id: 'id-3' }),
    ];

    const { newProgramSort } = sortPrograms(programs, 'asc');

    expect(newProgramSort).toHaveLength(3);
    expect(newProgramSort.every((p) => (p as ContentProgram).title === 'Same')).toBe(true);
  });
});
