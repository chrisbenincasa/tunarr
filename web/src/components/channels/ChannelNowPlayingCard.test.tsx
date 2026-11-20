import { act, fireEvent, renderWithProviders, screen } from '@/test/utils';
import { makeContentProgram, makeMovie } from '@/test/programFixtures.ts';
import { QueryClient } from '@tanstack/react-query';
import type { TvGuideProgram } from '@tunarr/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ChannelNowPlayingCard } from './ChannelNowPlayingCard.tsx';
import { makeStoryChannel } from './channelStoryFixtures.ts';

const FlexPicture = 'http://host/images/flex.png';

// A real wall-clock time, so a timestamp passed as a delay would show up.
const Base = Date.UTC(2026, 10, 9);

const nowPlaying = vi.hoisted(() => ({
  program: undefined as TvGuideProgram | undefined,
  updatedAt: 0,
  errorUpdatedAt: 0,
}));

vi.mock('../../hooks/useChannels.ts', () => ({
  useChannelSuspense: () => ({
    data: makeStoryChannel({ offline: { mode: 'pic', picture: FlexPicture } }),
  }),
}));

vi.mock('../../hooks/useTvGuide.ts', () => ({
  useChannelNowPlaying: () => ({
    data: nowPlaying.program,
    dataUpdatedAt: nowPlaying.updatedAt,
    errorUpdatedAt: nowPlaying.errorUpdatedAt,
  }),
}));

function movieAiring(uuid: string, start: number, stop: number) {
  return {
    ...makeContentProgram(makeMovie({ uuid, title: uuid }), stop - start),
    start,
    stop,
    isPaused: false,
  } satisfies TvGuideProgram;
}

function image(container: HTMLElement, srcSuffix: string) {
  return container.querySelector(`img[src$="${srcSuffix}"]`);
}

function visibleTitles(container: HTMLElement) {
  return [
    ...container.querySelectorAll('[aria-hidden="false"] .MuiTypography-h5'),
  ].map((el) => el.textContent);
}

describe('ChannelNowPlayingCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(Base + 10_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('falls back to the flex image when artwork fails to load', () => {
    nowPlaying.program = movieAiring('movie-a', Base, Base + 60_000);
    const { container } = renderWithProviders(
      <ChannelNowPlayingCard channelId="channel-1" />,
    );

    const artwork = image(
      container,
      '/api/programs/movie-a/artwork/banner?fallbackArtworkTypes=fanart,poster',
    );
    if (!artwork) {
      throw new Error('artwork did not render');
    }
    fireEvent.error(artwork);

    expect(
      image(
        container,
        '/api/programs/movie-a/artwork/banner?fallbackArtworkTypes=fanart,poster',
      ),
    ).toBeNull();
    expect(container.querySelector(`img[src="${FlexPicture}"]`)).not.toBeNull();
  });

  test('crossfades to the next program once its image loads', () => {
    nowPlaying.program = movieAiring('movie-a', Base, Base + 60_000);
    const { container, rerender } = renderWithProviders(
      <ChannelNowPlayingCard channelId="channel-1" />,
    );
    const first = image(
      container,
      '/movie-a/artwork/banner?fallbackArtworkTypes=fanart,poster',
    );
    if (!first) {
      throw new Error('first artwork did not render');
    }
    fireEvent.load(first);
    expect(visibleTitles(container)).toEqual(['movie-a']);

    nowPlaying.program = movieAiring('movie-b', Base + 60_000, Base + 120_000);
    nowPlaying.updatedAt = 1;
    rerender(<ChannelNowPlayingCard channelId="channel-1" />);

    // The old program stays on screen while the new image loads.
    expect(visibleTitles(container)).toEqual(['movie-a']);
    expect(screen.queryByText('movie-b')).not.toBeNull();

    const second = image(
      container,
      '/movie-b/artwork/banner?fallbackArtworkTypes=fanart,poster',
    );
    if (!second) {
      throw new Error('second artwork did not render');
    }
    fireEvent.load(second);
    expect(visibleTitles(container)).toEqual(['movie-b']);

    // The old layer unmounts after the fade.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByText('movie-a')).toBeNull();
  });

  test('refetches just after the program ends', () => {
    nowPlaying.program = movieAiring('movie-a', Base, Base + 60_000);
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue();
    renderWithProviders(<ChannelNowPlayingCard channelId="channel-1" />, {
      queryClient,
    });

    act(() => {
      vi.advanceTimersByTime(50_000);
    });
    expect(invalidate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  test('retries after a failed refetch', () => {
    nowPlaying.program = movieAiring('movie-a', Base, Base + 60_000);
    nowPlaying.errorUpdatedAt = 0;
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue();
    const { rerender } = renderWithProviders(
      <ChannelNowPlayingCard channelId="channel-1" />,
      { queryClient },
    );

    act(() => {
      vi.advanceTimersByTime(51_000);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);

    // The refetch fails, so only errorUpdatedAt moves.
    nowPlaying.errorUpdatedAt = Date.now();
    rerender(<ChannelNowPlayingCard channelId="channel-1" />);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
