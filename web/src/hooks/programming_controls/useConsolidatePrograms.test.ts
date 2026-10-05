import type {
  ChannelProgram,
  FillerProgram,
  FlexProgram,
  RedirectProgram,
} from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { consolidatePrograms } from './useConcolidatePrograms';

const flex = (
  duration: number,
  fillerConfig?: FlexProgram['fillerConfig'],
): FlexProgram => ({
  type: 'flex',
  duration,
  fillerConfig,
});

const redirect = (channel: string, duration: number): RedirectProgram => ({
  type: 'redirect',
  channel,
  channelNumber: 1,
  channelName: 'Channel',
  duration,
});

const filler = (id: string, duration: number): FillerProgram => ({
  type: 'filler',
  id,
  fillerListId: 'filler-list',
  duration,
});

describe('consolidatePrograms', () => {
  test('merges adjacent flex blocks', () => {
    const result = consolidatePrograms<ChannelProgram>([
      flex(1000),
      flex(2000),
      flex(3000),
    ]);

    expect(result).toEqual([flex(6000)]);
  });

  test('does not merge flex blocks with different filler configs', () => {
    const programs = [
      flex(1000, { fillerListIds: ['a'] }),
      flex(2000, { fillerListIds: ['b'] }),
    ];

    expect(consolidatePrograms<ChannelProgram>(programs)).toEqual(programs);
  });

  test('merges adjacent redirects only to the same channel', () => {
    const result = consolidatePrograms<ChannelProgram>([
      redirect('a', 1000),
      redirect('a', 2000),
      redirect('b', 3000),
    ]);

    expect(result).toEqual([redirect('a', 3000), redirect('b', 3000)]);
  });

  test('never merges filler items', () => {
    // Merging filler would stretch the first clip over the whole run, and
    // playback would seek past the end of that clip.
    const programs = [filler('1', 7000), filler('2', 15000), filler('3', 9000)];

    expect(consolidatePrograms<ChannelProgram>(programs)).toEqual(programs);
  });
});
