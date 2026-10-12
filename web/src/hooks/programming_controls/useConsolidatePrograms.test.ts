import type {
  ChannelProgram,
  FillerProgram,
  FlexProgram,
  RedirectProgram,
} from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { consolidatePrograms } from './useConcolidatePrograms';

const flex = (duration: number): FlexProgram => ({ type: 'flex', duration });

const filler = (id: string, duration: number): FillerProgram => ({
  type: 'filler',
  id,
  fillerListId: 'filler-list-1',
  duration,
});

const redirect = (channel: string, duration: number): RedirectProgram => ({
  type: 'redirect',
  channel,
  channelNumber: 1,
  channelName: 'Channel One',
  duration,
});

describe('consolidatePrograms', () => {
  test('merges adjacent flex', () => {
    expect(consolidatePrograms([flex(1000), flex(2000)])).toEqual([flex(3000)]);
  });

  test('keeps adjacent filler items separate', () => {
    const programs: ChannelProgram[] = [
      filler('a', 15_000),
      filler('b', 30_000),
    ];

    expect(consolidatePrograms(programs)).toEqual(programs);
  });

  test('merges redirects only when they target the same channel', () => {
    const programs: ChannelProgram[] = [
      redirect('one', 1000),
      redirect('one', 2000),
      redirect('two', 4000),
    ];

    expect(consolidatePrograms(programs)).toEqual([
      redirect('one', 3000),
      redirect('two', 4000),
    ]);
  });

  test('does not merge flex across a filler item', () => {
    const programs: ChannelProgram[] = [
      flex(1000),
      filler('a', 15_000),
      flex(2000),
    ];

    expect(consolidatePrograms(programs)).toEqual(programs);
  });
});
