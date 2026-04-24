import { betterHumanize } from '@/helpers/dayjs';
import { isNonEmptyString } from '@/helpers/util';
import { t } from '@lingui/core/macro';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { FillerList } from '@tunarr/types';
import { type ChannelProgram, type CustomShow } from '@tunarr/types';
import dayjs from 'dayjs';
import { filter, isNil, join } from 'lodash-es';
import { useCallback } from 'react';
import { match } from 'ts-pattern';
import { useCustomShows } from './useCustomShows';
import { fillerListsQuery } from './useFillerLists.ts';

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
    (program: ChannelProgram) =>
      match(program)
        .with({ type: 'custom' }, (p) => {
          const showName = customShows[p.customShowId]?.name ?? t`Custom Show`;
          const idx = p.index.toString().padStart(3, '0');
          return `${showName} - ${idx} - `;
        })
        .with({ type: 'redirect' }, (p) => t`Redirect to "${p.channelName}"`)
        .with({ type: 'flex' }, () => t`Flex`)
        .with({ type: 'filler' }, () => '')
        .with({ type: 'content' }, ({ program }) => {
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
              const showTitle =
                program.show?.title ?? program.season?.show?.title;
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
        })
        .exhaustive(),
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

      let dur: string;
      if (program.type === 'content' && program.startOffsetMs) {
        dur = betterHumanize(
          dayjs.duration(program.duration - program.startOffsetMs),
          { exact: true },
        );
      } else {
        dur = betterHumanize(
          dayjs.duration({ milliseconds: program.duration }),
          { exact: true },
        );
      }

      return `${title} - (${dur})`;
    },
    [baseItemTitleFormatter],
  );
};
