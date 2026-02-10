import type { ChannelProgram, ContentProgram, FlexProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { addBreaks, type AddBreaksConfig } from './useAddBreaks';

dayjs.extend(duration);

// Mock the random helper
vi.mock('../../helpers/random.ts', () => ({
  random: {
    integer: vi.fn((min: number, max: number) => min), // Always return min for deterministic tests
  },
}));

const createContentProgram = (
  durationMs: number,
  title = 'Test',
): ContentProgram => ({
  type: 'content',
  id: `id-${title}-${durationMs}`,
  persisted: true,
  subtype: 'movie',
  title,
  duration: durationMs,
  externalIds: [],
});

const createFlexProgram = (durationMs: number): FlexProgram => ({
  type: 'flex',
  duration: durationMs,
  persisted: false,
});

const createConfig = (
  afterMinutes: number,
  minMinutes: number,
  maxMinutes: number,
): AddBreaksConfig => ({
  afterDuration: dayjs.duration(afterMinutes, 'minutes'),
  minDuration: dayjs.duration(minMinutes, 'minutes'),
  maxDuration: dayjs.duration(maxMinutes, 'minutes'),
});

describe('addBreaks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('inserts flex break when cumulative duration exceeds threshold', () => {
    const programs: ChannelProgram[] = [
      createContentProgram(30 * 60 * 1000), // 30 min
      createContentProgram(20 * 60 * 1000), // 20 min - total 50 min
      createContentProgram(15 * 60 * 1000), // 15 min - total 65 min, exceeds 60
    ];

    // Break after 60 min, insert 5 min breaks
    const config = createConfig(60, 5, 10);
    const result = addBreaks(programs, config);

    // Should have: program1, program2, flex, program3
    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('content');
    expect(result[1].type).toBe('content');
    expect(result[2].type).toBe('flex');
    expect(result[3].type).toBe('content');
  });

  test('resets duration counter when flex is encountered', () => {
    const programs: ChannelProgram[] = [
      createContentProgram(40 * 60 * 1000), // 40 min
      createFlexProgram(5 * 60 * 1000), // Existing flex - resets counter
      createContentProgram(40 * 60 * 1000), // 40 min - counter is 40, not 80
      createContentProgram(25 * 60 * 1000), // 25 min - total 65, exceeds 60
    ];

    const config = createConfig(60, 5, 10);
    const result = addBreaks(programs, config);

    // Should have: program1, existing-flex, program2, new-flex, program3
    expect(result).toHaveLength(5);
    expect(result[0].type).toBe('content');
    expect(result[1].type).toBe('flex'); // Original flex
    expect(result[2].type).toBe('content');
    expect(result[3].type).toBe('flex'); // New flex inserted
    expect(result[4].type).toBe('content');
  });

  test('uses random duration between min and max (mocked to min)', async () => {
    const { random } = await import('../../helpers/random.ts');

    const programs: ChannelProgram[] = [
      createContentProgram(70 * 60 * 1000), // 70 min, exceeds 60 min threshold
    ];

    // min 5 min, max 10 min
    const config = createConfig(60, 5, 10);
    const result = addBreaks(programs, config);

    expect(random.integer).toHaveBeenCalledWith(
      5 * 60 * 1000, // min in ms
      10 * 60 * 1000, // max in ms
    );

    // Flex should be inserted with min duration (mocked)
    const flexProgram = result.find((p) => p.type === 'flex') as FlexProgram;
    expect(flexProgram.duration).toBe(5 * 60 * 1000);
  });

  test('no breaks inserted when programs are short', () => {
    const programs: ChannelProgram[] = [
      createContentProgram(10 * 60 * 1000), // 10 min
      createContentProgram(15 * 60 * 1000), // 15 min - total 25 min
      createContentProgram(20 * 60 * 1000), // 20 min - total 45 min
    ];

    // Break after 60 min
    const config = createConfig(60, 5, 10);
    const result = addBreaks(programs, config);

    // No flex should be inserted since total is 45 min < 60 min
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.type === 'content')).toBe(true);
  });

  test('handles empty program list', () => {
    const programs: ChannelProgram[] = [];
    const config = createConfig(60, 5, 10);

    const result = addBreaks(programs, config);

    expect(result).toEqual([]);
  });

  test('inserts multiple breaks for long lists', () => {
    const programs: ChannelProgram[] = [
      createContentProgram(40 * 60 * 1000), // 40 min
      createContentProgram(30 * 60 * 1000), // 30 min - total 70, break
      createContentProgram(40 * 60 * 1000), // 40 min - counter reset after break
      createContentProgram(30 * 60 * 1000), // 30 min - total 70, break again
    ];

    const config = createConfig(60, 5, 10);
    const result = addBreaks(programs, config);

    // Should have: p1, flex, p2, p3, flex, p4
    expect(result).toHaveLength(6);
    expect(result[0].type).toBe('content');
    expect(result[1].type).toBe('flex');
    expect(result[2].type).toBe('content');
    expect(result[3].type).toBe('content');
    expect(result[4].type).toBe('flex');
    expect(result[5].type).toBe('content');
  });

  test('break is inserted before the program that exceeds threshold', () => {
    const programs: ChannelProgram[] = [
      createContentProgram(50 * 60 * 1000, 'First'), // 50 min
      createContentProgram(20 * 60 * 1000, 'Second'), // Would make 70 min
    ];

    const config = createConfig(60, 5, 10);
    const result = addBreaks(programs, config);

    // Flex should be inserted before 'Second'
    expect(result).toHaveLength(3);
    expect((result[0] as ContentProgram).title).toBe('First');
    expect(result[1].type).toBe('flex');
    expect((result[2] as ContentProgram).title).toBe('Second');
  });
});
