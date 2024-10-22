import { EnrichedJellyfinItem } from '@/hooks/jellyfin/jellyfinHookUtil.ts';
import { createExternalId } from '@tunarr/shared';
import { forProgramType, nullToUndefined } from '@tunarr/shared/util';
import {
  Channel,
  ChannelProgram,
  CondensedChannelProgram,
  CondensedChannelProgramming,
  ContentProgram,
} from '@tunarr/types';
import { Draft } from 'immer';
import {
  chain,
  extend,
  findIndex,
  first,
  identity,
  inRange,
  isNil,
  isUndefined,
  last,
  map,
  sumBy,
  tail,
} from 'lodash-es';
import {
  forAddedMediaType,
  isNonEmptyString,
  typedProperty,
  unwrapNil,
} from '../../helpers/util.ts';
import { EnrichedPlexMedia } from '../../hooks/plex/plexHookUtil.ts';
import { AddedMedia, UIChannelProgram, UIIndex } from '../../types/index.ts';
import useStore from '../index.ts';
import { ChannelEditorState, initialChannelEditorState } from './store.ts';

export const resetChannelEditorState = () =>
  useStore.setState((state) => {
    const newState = {
      ...state,
      ...initialChannelEditorState,
    };

    return newState;
  });

function addIndexesAndCalculateOffsets<T extends { duration: number }>(
  items: T[],
  firstOffset: number = 0,
  firstIndex: number = 0,
): (T & UIIndex & { startTimeOffset: number })[] {
  let runningOffset = firstOffset;
  return map(items, (item, index) => {
    const newItem = {
      ...item,
      originalIndex: firstIndex + index,
      startTimeOffset: runningOffset,
    };
    runningOffset += item.duration;
    return newItem;
  });
}

function updateProgramList(
  channelEditor: Draft<ChannelEditorState>,
  programming: CondensedChannelProgramming,
) {
  const programs = addIndexesAndCalculateOffsets(programming.lineup);
  channelEditor.programsLoaded = true;
  channelEditor.originalProgramList = [...programs];
  channelEditor.programList = [...programs];
  channelEditor.programLookup = { ...programming.programs };
  channelEditor.schedule = programming.schedule;
}

/**
 * Set the current channel, and optionally, programming,
 * regardless of the current state.
 */
export const setCurrentChannel = (
  channel: Omit<Channel, 'programs'>,
  programming?: CondensedChannelProgramming,
) =>
  useStore.setState(({ channelEditor }) => {
    channelEditor.currentEntity = channel;
    channelEditor.originalEntity = channel;
    if (programming) {
      updateProgramList(channelEditor, programming);
    }
  });

/**
 * Set the current channel, and optionally, programming, without clobbering
 * the existing state, if they point to the same underlying entity.
 */
export const safeSetCurrentChannel = (
  channel: Omit<Channel, 'programs'>,
  programming?: CondensedChannelProgramming,
) =>
  useStore.setState(({ channelEditor }) => {
    console.log('here', { ...channelEditor });
    if (channelEditor.currentEntity?.id !== channel.id) {
      channelEditor.currentEntity = channel;
      channelEditor.originalEntity = channel;
      if (programming) {
        updateProgramList(channelEditor, programming);
      }
    } else if (!channelEditor.programsLoaded && programming) {
      updateProgramList(channelEditor, programming);
    }
  });

export const setCurrentChannelProgramming = (
  programming: CondensedChannelProgramming,
) =>
  useStore.setState(({ channelEditor }) => {
    updateProgramList(channelEditor, programming);
  });

export const setCurrentLineup = (
  lineup: CondensedChannelProgram[],
  dirty?: boolean,
) =>
  useStore.setState((state) => {
    state.channelEditor.programList = addIndexesAndCalculateOffsets(lineup);
    state.channelEditor.programsLoaded = true;
    if (!isUndefined(dirty)) {
      state.channelEditor.dirty.programs = dirty;
    }
  });

export const resetCurrentLineup = (programming: CondensedChannelProgramming) =>
  useStore.setState((state) => {
    const zippedLineup = addIndexesAndCalculateOffsets(programming.lineup);
    state.channelEditor.programList = [...zippedLineup];
    state.channelEditor.originalProgramList = [...zippedLineup];
    state.channelEditor.programLookup = { ...programming.programs };
    state.channelEditor.dirty.programs = false;
    state.channelEditor.schedule = programming.schedule;
  });

export const resetLineup = () =>
  useStore.setState((state) => {
    if (
      state.channelEditor.originalEntity &&
      state.channelEditor.currentEntity
    ) {
      state.channelEditor.currentEntity.startTime =
        state.channelEditor.originalEntity.startTime;
    }
    state.channelEditor.programList = [
      ...state.channelEditor.originalProgramList,
    ];
    state.channelEditor.dirty.programs = false;
  });

export const updateCurrentChannel = (channel: Partial<Channel>) =>
  useStore.setState((state) => {
    if (state.channelEditor.currentEntity) {
      state.channelEditor.currentEntity = {
        ...state.channelEditor.currentEntity,
        ...channel,
      };
    }
  });

export const addProgramsToCurrentChannel = (programs: ChannelProgram[]) =>
  useStore.setState(({ channelEditor }) => {
    const lastItem = last(channelEditor.programList);
    const firstOffset = lastItem
      ? lastItem.startTimeOffset + lastItem.duration
      : 0;
    channelEditor.programList.push(
      ...addIndexesAndCalculateOffsets(
        programs,
        firstOffset,
        channelEditor.programList.length,
      ),
    );
    channelEditor.dirty.programs =
      channelEditor.dirty.programs || programs.length > 0;
  });

export const setProgramAtIndex = (program: UIChannelProgram, index: number) =>
  useStore.setState(({ channelEditor }) => {
    if (inRange(index, 0, channelEditor.programList.length)) {
      // Remove all items after the target index.
      const afterIndexItems = channelEditor.programList.splice(index);
      // Take the temporary last item (i.e. index - 1) and find
      // the offset that will become the initial offset for calculating the
      // new lineup
      const newLast = last(channelEditor.programList);
      const firstOffset = newLast
        ? newLast.startTimeOffset + newLast.duration
        : 0;
      // Repush the items, replacing the first item (i.e. at 'index')
      // with the updated program. This recalculates all start time
      // offsets using the new items duration. It's a little heavy
      // handed, since we really could just loop from index -> length
      // and add/subtract the difference between old/new program's duration
      // but we already have this loop written so no biggie.
      channelEditor.programList.push(
        ...addIndexesAndCalculateOffsets(
          [program, ...tail(afterIndexItems)],
          firstOffset,
          index,
        ),
      );
      // channelEditor.programList[index] = program;
      channelEditor.dirty.programs = true;
    }
  });

export const moveProgramInCurrentChannel = (
  originalIndex: number,
  toIndex: number,
) =>
  useStore.setState(({ channelEditor }) => {
    const programIdx = findIndex(channelEditor.programList, { originalIndex });
    if (inRange(toIndex, channelEditor.programList.length) && programIdx >= 0) {
      const fromItem = channelEditor.programList[programIdx];
      const toItem = channelEditor.programList[toIndex];
      channelEditor.programList[programIdx] = toItem;
      channelEditor.programList[toIndex] = fromItem;
      channelEditor.dirty.programs = true;
    }
  });

export const setChannelStartTime = (startTime: number) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity) {
      channelEditor.currentEntity.startTime = startTime;
      channelEditor.dirty.programs = true;
    }
  });

/**
 * Creates an non-persisted, ephemeral ContentProgram for the given
 * EnrichedPlexMedia. These are handed off to the server to persist
 * to the database (if they don't already exist). They are also useful
 * in order to deal with a common type for programming throughout other
 * parts of the UI
 */
export const plexMediaToContentProgram = (
  media: EnrichedPlexMedia,
): ContentProgram => {
  const uniqueId = createExternalId('plex', media.serverName, media.ratingKey);
  return {
    id: media.id ?? uniqueId,
    persisted: !isNil(media.id),
    originalProgram: { sourceType: 'plex', program: media },
    duration: media.duration,
    externalSourceName: media.serverName,
    externalSourceType: 'plex',
    externalKey: media.ratingKey,
    uniqueId,
    type: 'content',
    subtype: media.type,
    summary: media.summary,
    title:
      media.type === 'episode'
        ? media.grandparentTitle ?? media.title
        : media.title,
    episodeTitle: media.type === 'episode' ? media.title : undefined,
    episodeNumber: media.type === 'episode' ? media.index : undefined,
    seasonNumber: media.type === 'episode' ? media.parentIndex : undefined,
    artistName: media.type === 'track' ? media.grandparentTitle : undefined,
    albumName: media.type === 'track' ? media.parentTitle : undefined,
    showId:
      media.showId ??
      (media.type === 'episode' && isNonEmptyString(media.grandparentRatingKey)
        ? createExternalId('plex', media.serverName, media.grandparentRatingKey)
        : undefined),
    seasonId:
      media.seasonId ??
      (media.type === 'episode' && isNonEmptyString(media.parentRatingKey)
        ? createExternalId('plex', media.serverName, media.parentRatingKey)
        : undefined),
    externalIds: [
      {
        type: 'multi',
        source: 'plex',
        sourceId: media.serverName,
        id: media.ratingKey,
      },
    ],
  };
};

export const jellyfinItemToContentProgram = (
  media: EnrichedJellyfinItem,
): ContentProgram => {
  const uniqueId = createExternalId('jellyfin', media.serverName, media.Id);
  return {
    id: media.id ?? uniqueId,
    persisted: !isNil(media.id),
    originalProgram: { sourceType: 'jellyfin', program: media },
    duration: (media.RunTimeTicks ?? 0) / 10_000,
    externalSourceName: media.serverName,
    externalSourceType: 'jellyfin',
    externalKey: media.Id,
    uniqueId,
    type: 'content',
    subtype:
      media.Type === 'Movie' || media.Type === 'Trailer'
        ? 'movie'
        : media.Type === 'Episode' ||
          media.Type === 'Video' ||
          media.Type === 'MusicVideo'
        ? 'episode'
        : 'track',
    title: (media.Type === 'Episode' ? media.SeriesName : media.Name) ?? '',
    episodeTitle:
      media.Type === 'Episode' ? nullToUndefined(media.Name) : undefined,
    episodeNumber:
      media.Type === 'Episode'
        ? nullToUndefined(media.EpisodeCount)
        : undefined,
    seasonNumber:
      media.Type === 'Episode'
        ? nullToUndefined(media.ParentIndexNumber)
        : undefined,
    artistName:
      media.Type === 'Audio' ? nullToUndefined(media.AlbumArtist) : undefined,
    albumName:
      media.Type === 'Audio' ? nullToUndefined(media.Album) : undefined,
    showId:
      media.showId ??
      (media.Type === 'Episode' && isNonEmptyString(media.SeriesId)
        ? createExternalId('jellyfin', media.serverName, media.SeriesId)
        : undefined),
    seasonId:
      media.seasonId ??
      (media.Type === 'Episode' && isNonEmptyString(media.SeasonId)
        ? createExternalId('plex', media.serverName, media.SeasonId)
        : undefined),
    externalIds: [
      {
        type: 'multi',
        source: 'jellyfin',
        sourceId: media.serverName,
        id: media.Id,
      },
    ],
  };
};

export const addMediaToCurrentChannel = (programs: AddedMedia[]) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity && programs.length > 0) {
      channelEditor.dirty.programs = true;
      const addedDuration = sumBy(
        programs,
        forAddedMediaType({
          plex: ({ media }) => media.duration,
          jellyfin: ({ media }) => (media.RunTimeTicks ?? 0) / 10_000,
          'custom-show': ({ program }) => program.duration,
        }),
      );

      // Convert any external program types to our internal representation
      const allNewPrograms = map(
        programs,
        forAddedMediaType<ChannelProgram>({
          plex: ({ media }) => plexMediaToContentProgram(media),
          jellyfin: ({ media }) => jellyfinItemToContentProgram(media),
          'custom-show': ({ program }) => program,
        }),
      );

      const oldDuration = channelEditor.currentEntity.duration;
      const newDuration = oldDuration + addedDuration;

      // Set the new channel duration based on the new program durations
      // const now = dayjs()
      channelEditor.currentEntity.duration = newDuration;

      // Add offset times to all incoming programs
      const lastItem = last(channelEditor.programList);
      const firstOffset = lastItem
        ? lastItem.startTimeOffset + lastItem.duration
        : 0;
      const programsWithOffset = addIndexesAndCalculateOffsets(
        allNewPrograms,
        firstOffset,
        channelEditor.programList.length,
      );

      // Add new programs to the end of the existing list
      channelEditor.programList.push(...programsWithOffset);

      // Add new lookups for these programs for when we materialize them in the selector
      // Extract the underlying content program from any custom programs
      const contentProgramsById = chain(allNewPrograms)
        .map(
          forProgramType({
            content: identity,
            custom: ({ program }) => program,
          }),
        )
        .compact()
        .groupBy(typedProperty('id'))
        .omitBy(isNil)
        .mapValues(unwrapNil(first))
        .value();

      extend(channelEditor.programLookup, contentProgramsById);
    }
  });
