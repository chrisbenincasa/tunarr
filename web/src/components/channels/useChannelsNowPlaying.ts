import { useAllTvGuides } from '@/hooks/useTvGuide.ts';
import { useSettings } from '@/store/settings/selectors.ts';
import type { TvGuideProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import {
  type NowPlayingSummary,
  summarizeNowPlaying,
} from './channelSummary.ts';

const progressTickMs = 30_000;

// What each channel is airing now, keyed by channel id. Reads the server's
// guide cache in one call, refetches when the first current program ends, and
// recomputes progress every 30 seconds.
export const useChannelsNowPlaying = (): ReadonlyMap<
  string,
  NowPlayingSummary
> => {
  const { backendUri } = useSettings();
  const [anchor, setAnchor] = useState(() => dayjs());
  const [now, setNow] = useState(() => Date.now());
  const { data: lineups } = useAllTvGuides({ from: anchor, to: anchor });

  const current = useMemo(() => {
    const at = anchor.valueOf();
    const programs = new Map<string, TvGuideProgram>();
    for (const lineup of lineups ?? []) {
      const program =
        lineup.programs.find((p) => p.start <= at && p.stop > at) ??
        lineup.programs[0];
      if (program) {
        programs.set(lineup.id, program);
      }
    }
    return programs;
  }, [lineups, anchor]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), progressTickMs);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const stops = [...current.values()].map((p) => p.stop);
    if (stops.length === 0) {
      return;
    }
    const wait = Math.max(Math.min(...stops) - Date.now(), 0) + 1_000;
    const id = setTimeout(() => setAnchor(dayjs()), wait);
    return () => clearTimeout(id);
  }, [current]);

  return useMemo(() => {
    const summaries = new Map<string, NowPlayingSummary>();
    for (const [channelId, program] of current) {
      summaries.set(channelId, summarizeNowPlaying(program, now, backendUri));
    }
    return summaries;
  }, [current, now, backendUri]);
};
