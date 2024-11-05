import { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { useChannelEditor } from '@/store/selectors';
import { isUICustomProgram, isUIRedirectProgram } from '@/types';
import { CustomShow, isContentProgram } from '@tunarr/types';
import { chain, filter, isEmpty, isUndefined, some } from 'lodash-es';
import { useMemo } from 'react';
import { useCustomShows } from '../useCustomShows';

export const useSlotProgramOptions = () => {
  const { programList: newLineup } = useChannelEditor();
  const { data: customShows } = useCustomShows();

  const customShowsById = useMemo(() => {
    const byId: Record<string, CustomShow> = {};
    for (const show of customShows) {
      byId[show.id] = show;
    }
    return byId;
  }, [customShows]);

  return useMemo<ProgramOption[]>(() => {
    const contentPrograms = filter(newLineup, isContentProgram);
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
        .value();
      opts.push(...showOptions);
    }

    opts.push(
      ...chain(newLineup)
        .filter(isUICustomProgram)
        .reject((p) => isUndefined(customShowsById[p.customShowId]))
        .uniqBy((p) => p.customShowId)
        .map(
          (p) =>
            ({
              description: customShowsById[p.customShowId].name,
              value: `custom-show.${p.customShowId}`,
              id: p.customShowId,
              type: 'custom-show',
            }) satisfies ProgramOption,
        )
        .value(),
    );

    opts.push(
      ...chain(newLineup)
        .filter(isUIRedirectProgram)
        .uniqBy((p) => p.channel)
        .map(
          (p) =>
            ({
              description: `Redirect to "${p.channelName}"`,
              value: `redirect.${p.channel}`,
              type: 'redirect',
              channelId: p.channel,
            }) satisfies ProgramOption,
        )
        .value(),
    );

    return opts;
  }, [newLineup, customShowsById]);
};
