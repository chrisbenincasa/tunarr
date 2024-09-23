import { betterHumanize } from '@/helpers/dayjs';
import { isNonEmptyString } from '@/helpers/util';
import { forProgramType } from '@tunarr/shared/util';
import { ChannelProgram, CustomShow } from '@tunarr/types';
import dayjs from 'dayjs';
import { join, negate, reject } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { useCustomShows } from './useCustomShows';

export const useProgramTitleFormatter = () => {
  const { data: customShows } = useCustomShows({
    select: (data) => {
      const byId: Record<string, CustomShow> = {};
      for (const show of data) {
        byId[show.id] = show;
      }
      return byId;
    },
  });

  const baseItemTitleFormatter = useMemo(
    () =>
      forProgramType({
        custom: (p) =>
          `${customShows[p.customShowId]?.name ?? 'Custom Show'} - ${p.index
            .toString()
            .padStart(3, '0')} - `,
        redirect: (p) => `Redirect to "${p.channelName}"`,
        flex: 'Flex',
        content: (p) => {
          switch (p.subtype) {
            case 'movie':
              return p.title;
            case 'episode': {
              // TODO: this makes some assumptions about number of seasons
              // and episodes... it may break
              const epPart =
                p.seasonNumber && p.episodeNumber
                  ? ` S${p.seasonNumber
                      .toString()
                      .padStart(2, '0')}E${p.episodeNumber
                      .toString()
                      .padStart(2, '0')}`
                  : '';
              return p.episodeTitle
                ? `${p.title}${epPart} - ${p.episodeTitle}`
                : p.title;
            }
            case 'track': {
              return join(
                reject(
                  [p.artistName, p.albumName, p.title],
                  negate(isNonEmptyString),
                ),
                ' - ',
              );
            }
          }
        },
      }),
    [customShows],
  );

  return useCallback(
    (program: ChannelProgram) => {
      let title = baseItemTitleFormatter(program);

      if (program.type === 'custom' && program.program) {
        title += ` ${baseItemTitleFormatter(program.program)}`;
      }
      const dur = betterHumanize(
        dayjs.duration({ milliseconds: program.duration }),
        { exact: true },
      );

      return `${title} - (${dur})`;
    },
    [baseItemTitleFormatter],
  );
};
