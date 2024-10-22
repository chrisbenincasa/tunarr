import {
  forAddedMediaType,
  programMinter,
  typedProperty,
  unwrapNil,
} from '@/helpers/util.ts';
import { forProgramType } from '@tunarr/shared/util';
import {
  Channel,
  ChannelProgram,
  CondensedChannelProgram,
  CondensedChannelProgramming,
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
import { P, match } from 'ts-pattern';
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
      const allNewPrograms = map(programs, (item) =>
        match(item)
          .with({ type: 'plex', media: P.select() }, (plexItem) =>
            programMinter.mintProgram(
              { id: plexItem.serverId, name: plexItem.serverName },
              { program: plexItem, sourceType: 'plex' },
            ),
          )
          .with({ type: 'jellyfin', media: P.select() }, (jfItem) =>
            programMinter.mintProgram(
              { id: jfItem.serverId, name: jfItem.serverName },
              { program: jfItem, sourceType: 'jellyfin' },
            ),
          )
          .with(
            { type: 'custom-show', program: P.select() },
            (program) => program,
          )
          .exhaustive(),
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
