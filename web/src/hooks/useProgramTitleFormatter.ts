import { betterHumanize } from '@/helpers/dayjs';
import { isNonEmptyString } from '@/helpers/util';
import { t } from '@lingui/core/macro';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { FillerList } from '@tunarr/types';
import {
  type ChannelProgram,
  type ContentProgram,
  type CustomShow,
} from '@tunarr/types';
import dayjs from 'dayjs';
import { filter, isNil, join } from 'lodash-es';
import { useCallback } from 'react';
import { useCustomShows } from './useCustomShows';
import { fillerListsQuery } from './useFillerLists.ts';

function formatContentTitle(program: ContentProgram['program']) {
  switch (program.type) {
    case 'movie':
    case 'music_video':
    case 'other_video':
      return program.title;
    case 'episode': {
      // TODO: this makes some assumptions about number of seasons
      // and episodes... it may break
      const epPart =
        !isNil(program.season?.index) && !isNil(program.episodeNumber)
          ? ` S${program.season?.index.toString().padStart(2, '0')}E${program.episodeNumber
              .toString()
              .padStart(2, '0')}`
          : '';
      const showTitle = program.show?.title ?? program.season?.show?.title;
      return isNonEmptyString(showTitle)
        ? `${showTitle}${epPart} - ${program.title}`
        : program.title;
    }
    case 'track': {
      return join(
        filter(
          [
            program.artist?.title ?? program.album?.artist?.title,
            program.album?.title,
            program.title,
          ],
          isNonEmptyString,
        ),
        ' - ',
      );
    }
  }
}

export const useProgramTitleFormatter = () => {
  const { data: customShows } = useCustomShows({
    select: (data) => {
      const byId: Record<string, CustomShow> = {};
      for (const show of data) {
        byId[show.id] = show;
      }
      return byId;
    },
    staleTime: 30_000,
  });

  const { data: fillerLists } = useSuspenseQuery({
    ...fillerListsQuery(),
    select: (data) => {
      const byId: Record<string, FillerList> = {};
      for (const show of data) {
        byId[show.id] = show;
      }
      return byId;
    },
    staleTime: 30_000,
  });

  const baseItemTitleFormatter = useCallback(
    (program: ChannelProgram) => {
      switch (program.type) {
        case 'custom': {
          const showName =
            customShows[program.customShowId]?.name ?? t`Playlist`;
          const idx = program.index.toString().padStart(3, '0');
          return `${showName} - ${idx} - `;
        }
        case 'redirect':
          return t`Redirect to "${program.channelName}"`;
        case 'flex':
          return t`Flex`;
        case 'filler':
          return '';
        case 'content':
          return formatContentTitle(program.program);
      }
    },
    [customShows, fillerLists],
  );

  return useCallback(
    (program: ChannelProgram) => {
      let title = baseItemTitleFormatter(program);

      if (
        (program.type === 'custom' || program.type === 'filler') &&
        program.program
      ) {
        title += ` ${baseItemTitleFormatter(program.program)}`;
      }

      // `duration` is the length of this lineup entry, not of the whole
      // program: a mid-roll segment carries the length of that segment and a
      // `startOffsetMs` saying where in the program it picks up. Subtracting
      // the offset here rendered every segment after the first as shorter than
      // it is -- the second 12 minute segment of a program showed as 0 minutes.
      const dur = betterHumanize(
        dayjs.duration({ milliseconds: program.duration }),
        { exact: true },
      );

      return `${title} - (${dur})`;
    },
    [baseItemTitleFormatter],
  );
};
