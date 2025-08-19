import { betterHumanize } from '@/helpers/dayjs';
import { isNonEmptyString } from '@/helpers/util';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { FillerList } from '@tunarr/types';
import { type ChannelProgram, type CustomShow } from '@tunarr/types';
import dayjs from 'dayjs';
import { isNil, join, negate, reject } from 'lodash-es';
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
        .with(
          { type: 'custom' },
          (p) =>
            `${customShows[p.customShowId]?.name ?? 'Custom Show'} - ${p.index
              .toString()
              .padStart(3, '0')} - `,
        )
        .with({ type: 'redirect' }, (p) => `Redirect to "${p.channelName}"`)
        .with({ type: 'flex' }, () => 'Flex')
        .with(
          { type: 'filler' },
          (p) => `${fillerLists[p.fillerListId]?.name ?? 'Filler List'} - `,
        )
        .with({ type: 'content' }, (p) => {
          switch (p.subtype) {
            case 'movie':
            case 'music_video':
            case 'other_video':
              return p.title;
            case 'episode': {
              // TODO: this makes some assumptions about number of seasons
              // and episodes... it may break
              const epPart =
                !isNil(p.parent?.index) && !isNil(p.index)
                  ? ` S${p.parent.index.toString().padStart(2, '0')}E${p.index
                      .toString()
                      .padStart(2, '0')}`
                  : '';
              return isNonEmptyString(p.grandparent?.title)
                ? `${p.grandparent.title}${epPart} - ${p.title}`
                : p.title;
            }
            case 'track': {
              return join(
                reject(
                  [p.grandparent?.title, p.parent?.title, p.title],
                  negate(isNonEmptyString),
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
      const dur = betterHumanize(
        dayjs.duration({ milliseconds: program.duration }),
        { exact: true },
      );

      return `${title} - (${dur})`;
    },
    [baseItemTitleFormatter],
  );
};
