import type { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { isNonEmptyString } from '@/helpers/util';
import useStore from '@/store';
import { seq } from '@tunarr/shared/util';
import type { CustomShow } from '@tunarr/types';
import { chain, isEmpty, reject, some } from 'lodash-es';
import { useMemo } from 'react';
import { useChannelsSuspense } from '../useChannels.ts';
import { useCustomShows } from '../useCustomShows.ts';

type ProgramOptions = {
  dropdownOpts: ProgramOption[];
  nameById: Record<string, string>;
};

export const useSlotProgramOptions = (channelId?: string) => {
  const { originalProgramList: newLineup } = useStore((s) => s.channelEditor);
  const { programLookup } = useStore();
  const { data: customShows } = useCustomShows();
  const { data: channels } = useChannelsSuspense({
    select: (channels) =>
      reject(channels, (channel) => channel.id === channelId),
  });

  const customShowsById = useMemo(() => {
    const byId: Record<string, CustomShow> = {};
    for (const show of customShows) {
      byId[show.id] = show;
    }
    return byId;
  }, [customShows]);

  return useMemo<ProgramOptions>(() => {
    const contentPrograms = seq.collect(newLineup, (program) => {
      if (program.type === 'content' && isNonEmptyString(program.id)) {
        return programLookup[program.id];
      }
    });

    const opts: ProgramOption[] = [
      { value: 'flex', description: 'Flex', type: 'flex' },
    ];
    const nameById: Record<string, string> = {
      flex: 'Flex',
      movie: 'Movies',
    };

    if (contentPrograms.length) {
      if (some(contentPrograms, (p) => p.subtype === 'movie')) {
        opts.push({ description: 'Movies', value: 'movie', type: 'movie' });
      }

      const showOptions = chain(contentPrograms)
        .filter((p) => p.subtype === 'episode')
        .reject((p) => isEmpty(p.showId))
        .uniqBy((p) => p.showId)
        .map(
          (show) =>
            ({
              description: show.grandparent?.title ?? 'Missing Show Title',
              value: `show.${show.showId}`,
              type: 'show',
              showId: show.showId!,
            }) satisfies ProgramOption,
        )
        .sortBy((opt) => opt.description)
        .tap((opts) => {
          for (const opt of opts) {
            nameById[opt.value] = opt.description;
          }
        })
        .value();
      opts.push(...showOptions);
    }

    console.log(customShowsById);

    opts.push(
      ...chain(customShowsById)
        // .filter(isUICondensedCustomProgram)
        // .reject((p) => isUndefined(customShowsById[p.customShowId]))
        // .uniqBy((p) => p.customShowId)
        .map(
          (show) =>
            ({
              description: show.name,
              value: `custom-show.${show.id}`,
              customShowId: show.id,
              type: 'custom-show',
            }) satisfies ProgramOption,
        )
        .tap((opts) => {
          for (const opt of opts) {
            nameById[opt.value] = opt.description;
          }
        })
        .value(),
    );

    opts.push(
      ...chain(channels)
        .map(
          (p) =>
            ({
              description: `Redirect to "${p.name}"`,
              value: `redirect.${p.id}`,
              type: 'redirect',
              channelId: p.id,
              channelName: p.name,
            }) satisfies ProgramOption,
        )
        .tap((opts) => {
          for (const opt of opts) {
            nameById[opt.value] = opt.description;
          }
        })
        .value(),
    );

    return {
      dropdownOpts: opts,
      nameById,
    };
  }, [newLineup, channels, programLookup, customShowsById]);
};
