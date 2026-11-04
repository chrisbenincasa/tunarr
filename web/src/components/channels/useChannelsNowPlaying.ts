import { useAllTvGuides } from '@/hooks/useTvGuide.ts';
import { useSettings } from '@/store/settings/selectors.ts';
import { keepPreviousData } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import {
  currentPrograms,
  guideRefreshDelay,
  type NowPlayingSummary,
  summarizeNowPlaying,
} from './channelSummary.ts';

const progressTickMs = 30_000;

// What each channel is airing now, keyed by channel id. Reads the server's
// guide cache in one call, refetches when the first current program ends, and
// recomputes progress every 30 seconds. The previous guide stays on screen
// while a refetch runs.
export const useChannelsNowPlaying = (): ReadonlyMap<
  string,
  NowPlayingSummary
> => {
  const { backendUri } = useSettings();
  const [anchor, setAnchor] = useState(() => dayjs());
  const [now, setNow] = useState(() => Date.now());
  const {
    data: lineups,
    isError,
    isPlaceholderData,
  } = useAllTvGuides(
    { from: anchor, to: anchor },
    { placeholderData: keepPreviousData },
  );

  const current = useMemo(
    () => currentPrograms(lineups ?? [], anchor.valueOf()),
    [lineups, anchor],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), progressTickMs);
    return () => clearInterval(id);
  }, []);

  // Placeholder data holds programs that already ended. Scheduling from them
  // would refetch again at once.
  useEffect(() => {
    if (isPlaceholderData) {
      return;
    }
    const stops = [...current.values()].map((p) => p.stop);
    const wait = guideRefreshDelay(stops, Date.now(), isError);
    if (wait === undefined) {
      return;
    }
    const id = setTimeout(() => setAnchor(dayjs()), wait);
    return () => clearTimeout(id);
  }, [current, isError, isPlaceholderData]);

  return useMemo(() => {
    const summaries = new Map<string, NowPlayingSummary>();
    for (const [channelId, program] of current) {
      summaries.set(channelId, summarizeNowPlaying(program, now, backendUri));
    }
    return summaries;
  }, [current, now, backendUri]);
};
