import type { TvGuideProgram } from '@tunarr/types';
import { describe, expect, it } from 'vitest';
import { channelFlexImageUrl, nowPlayingImageUrl } from './nowPlayingImage.ts';

const BACKEND = 'http://backend';
const FLEX_PICTURE = 'http://host/images/my-flex.png';

const times = { start: 0, stop: 60_000, duration: 60_000, isPaused: false };

const episode = {
  type: 'episode',
  uuid: 'ep-1',
  show: { uuid: 'show-1', title: 'Show' },
};

describe('channelFlexImageUrl', () => {
  it('uses the channel flex picture when one is set', () => {
    expect(channelFlexImageUrl(FLEX_PICTURE, BACKEND)).toBe(FLEX_PICTURE);
  });

  it.each([undefined, ''])(
    'falls back to the generic offline screen for %j',
    (picture) => {
      expect(channelFlexImageUrl(picture, BACKEND)).toBe(
        'http://backend/images/generic-offline-screen.png',
      );
    },
  );
});

describe('nowPlayingImageUrl', () => {
  it('uses show artwork for an episode', () => {
    const program = {
      ...times,
      type: 'content',
      id: 'ep-1',
      program: episode,
    } as TvGuideProgram;

    expect(nowPlayingImageUrl(program, FLEX_PICTURE, BACKEND)).toBe(
      'http://backend/api/programs/show-1/artwork/fanart?fallbackArtworkTypes=poster',
    );
  });

  it('uses the wrapped program artwork for a custom show item', () => {
    const program = {
      ...times,
      type: 'custom',
      id: 'ep-1',
      customShowId: 'cs-1',
      index: 0,
      program: { type: 'content', id: 'ep-1', program: episode },
    } as TvGuideProgram;

    expect(nowPlayingImageUrl(program, FLEX_PICTURE, BACKEND)).toBe(
      'http://backend/api/programs/show-1/artwork/fanart?fallbackArtworkTypes=poster',
    );
  });

  it.each<[string, TvGuideProgram]>([
    ['flex', { ...times, type: 'flex', title: 'Flex' } as TvGuideProgram],
    [
      'a redirect',
      {
        ...times,
        type: 'redirect',
        channel: 'ch-2',
        channelNumber: 2,
        channelName: 'Other',
      } as TvGuideProgram,
    ],
    [
      'a custom item without its program',
      {
        ...times,
        type: 'custom',
        id: 'ep-1',
        customShowId: 'cs-1',
        index: 0,
      } as TvGuideProgram,
    ],
  ])('uses the channel flex image for %s', (_, program) => {
    expect(nowPlayingImageUrl(program, FLEX_PICTURE, BACKEND)).toBe(
      FLEX_PICTURE,
    );
  });
});
