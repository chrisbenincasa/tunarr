import type { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { isNonEmptyString } from '@/helpers/util';
import useStore from '@/store';
import { useQuery } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import { map, reject, some } from 'lodash-es';
import { useContext, useMemo } from 'react';
import { SlotProgrammingOptionsContext } from '../../components/slot_scheduler/SlotProgrammingOptionsContext.ts';
import { postApiProgramsFacetsByFacetNameOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { useMediaSources } from '../settingsHooks.ts';
import { useSmartCollections } from '../smartCollectionHooks.ts';
import { useChannelsSuspense } from '../useChannels.ts';
import { useCustomShows } from '../useCustomShows.ts';
import { useFillerLists } from '../useFillerLists.ts';

type ProgramOptions = {
  dropdownOpts: ProgramOption[];
  nameById: Record<string, string>;
};

function useCustomShowOptions() {
  const { data: customShows } = useCustomShows();
  return useMemo(() => {
    return map(
      customShows,
      (show) =>
        ({
          description: show.name,
          value: `custom-show.${show.id}`,
          customShowId: show.id,
          type: 'custom-show',
          programCount: show.contentCount,
        }) satisfies ProgramOption,
    );
  }, [customShows]);
}

function useSyncedProgrammingOptions() {
  const { data: mediaSources } = useMediaSources();
  const hasSyncedLibraries = mediaSources.some((ms) => {
    if (ms.type === 'local') {
      return ms.libraries.some((lib) => !!lib.lastScannedAt);
    } else {
      return ms.libraries
        .filter((lib) => lib.enabled)
        .some((lib) => !!lib.lastScannedAt);
    }
  });

  // TODO: Handle error
  const facetQuery = useQuery({
    ...postApiProgramsFacetsByFacetNameOptions({
      path: { facetName: 'type' },
      body: {},
    }),
    enabled: hasSyncedLibraries,
  });

  return useMemo(() => {
    const showCount = facetQuery.data?.facetValues['show'] ?? 0;
    const opts: ProgramOption[] = [];
    if (showCount > 0) {
      opts.push({
        type: 'show',
        description: 'Shows',
        value: '',
        showId: '',
      });
    }
    return opts;
  }, [facetQuery]);
}

function useSmartCollectionProgrammingOptions() {
  const { data: smartCollections } = useSmartCollections();
  return useMemo(() => {
    const opts: ProgramOption[] = [];
    for (const coll of smartCollections) {
      opts.push({
        type: 'smart-collection',
        collectionId: coll.uuid,
        description: coll.name,
        value: '',
      });
    }
    return opts;
  }, [smartCollections]);
}

export const useSlotProgramOptions = (channelId?: string) => {
  const { originalProgramList: newLineup } = useStore((s) => s.channelEditor);
  const { programLookup } = useStore();
  const syncedOptions = useSyncedProgrammingOptions();
  const customShowOpts = useCustomShowOptions();
  const smartCollectionOpts = useSmartCollectionProgrammingOptions();
  const { data: fillerLists } = useFillerLists();
  const { data: channels } = useChannelsSuspense({
    select: (channels) =>
      reject(channels, (channel) => channel.id === channelId),
  });

  return useMemo<ProgramOptions>(() => {
    const contentPrograms = seq.collect(newLineup, (program) => {
      if (program.type === 'content' && isNonEmptyString(program.id)) {
        return programLookup[program.id];
      }
    });

    const opts: ProgramOption[] = [
      { value: 'flex', description: 'Flex', type: 'flex' },
      ...syncedOptions,
    ];
    const nameById: Record<string, string> = {
      flex: 'Flex',
      movie: 'Movies',
    };

    if (contentPrograms.length) {
      if (some(contentPrograms, (p) => p.subtype === 'movie')) {
        opts.push({ description: 'Movies', value: 'movie', type: 'movie' });
      }
    }

    for (const opt of customShowOpts) {
      nameById[opt.value] = opt.description;
    }

    opts.push(...customShowOpts);

    for (const opt of smartCollectionOpts) {
      nameById[opt.value] = opt.description;
    }

    opts.push(...smartCollectionOpts);

    const fillerOpts = map(
      fillerLists,
      (list) =>
        ({
          type: 'filler',
          description: list.name,
          fillerListId: list.id,
          value: `filler.${list.id}`,
          programCount: list.contentCount,
        }) satisfies ProgramOption,
    );

    for (const opt of fillerOpts) {
      nameById[opt.value] = opt.description;
    }

    opts.push(...fillerOpts);

    const redirectOpts = channels.map(
      (p) =>
        ({
          description: `Redirect to "${p.name}"`,
          value: `redirect.${p.id}`,
          type: 'redirect',
          channelId: p.id,
          channelName: p.name,
        }) satisfies ProgramOption,
    );
    for (const opt of redirectOpts) {
      nameById[opt.value] = opt.description;
    }
    opts.push(...redirectOpts);

    return {
      dropdownOpts: opts,
      nameById,
    };
  }, [
    newLineup,
    syncedOptions,
    customShowOpts,
    smartCollectionOpts,
    fillerLists,
    channels,
    programLookup,
  ]);
};

export const useSlotProgramOptionsContext = () =>
  useContext(SlotProgrammingOptionsContext);
