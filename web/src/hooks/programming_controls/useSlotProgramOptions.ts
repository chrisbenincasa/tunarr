import { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { isNonEmptyString } from '@/helpers/util';
import useStore from '@/store';
import { isUICondensedCustomProgram } from '@/types';
import { seq } from '@tunarr/shared/util';
import { CustomShow } from '@tunarr/types';
import { chain, isEmpty, isUndefined, reject, some } from 'lodash-es';
import { useMemo } from 'react';
import { useChannelsSuspense } from '../useChannels.ts';
import { useCustomShows } from '../useCustomShows.ts';

export const useSlotProgramOptions = (channelId?: string) => {
  const { originalProgramList: newLineup, programLookup } = useStore(
    (s) => s.channelEditor,
  );
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

  return useMemo<ProgramOption[]>(() => {
    const contentPrograms = seq.collect(newLineup, (program) => {
      if (program.type === 'content' && isNonEmptyString(program.id)) {
        return programLookup[program.id];
      }
    });

    const opts: ProgramOption[] = [
      { value: 'flex', description: 'Flex', type: 'flex' },
    ];

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
              description: show.title,
              value: `show.${show.showId}`,
              type: 'show',
              showId: show.showId!,
            }) satisfies ProgramOption,
        )
        .sortBy((opt) => opt.description)
        .value();
      opts.push(...showOptions);
    }

    opts.push(
      ...chain(newLineup)
        .filter(isUICondensedCustomProgram)
        .reject((p) => isUndefined(customShowsById[p.customShowId]))
        .uniqBy((p) => p.customShowId)
        .map(
          (p) =>
            ({
              description: customShowsById[p.customShowId].name,
              value: `custom-show.${p.customShowId}`,
              customShowId: p.customShowId,
              type: 'custom-show',
            }) satisfies ProgramOption,
        )
        .value(),
    );

    opts.push(
      ...chain(channels)
        // .filter(isUICondensedRedirectProgram)
        // .uniqBy((p) => p.channel)
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
        .value(),
    );

    return opts;
  }, [newLineup, channels, programLookup, customShowsById]);
};
