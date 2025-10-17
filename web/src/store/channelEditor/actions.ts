import { unwrapNil } from '@/helpers/util.ts';
import { ApiProgramMinter } from '@tunarr/shared';
import { forProgramType, seq } from '@tunarr/shared/util';
import {
  type Channel,
  type ChannelProgram,
  type CondensedChannelProgram,
  type CondensedChannelProgramming,
} from '@tunarr/types';
import { type Draft } from 'immer';
import {
  extend,
  findIndex,
  first,
  groupBy,
  identity,
  inRange,
  isNil,
  isUndefined,
  last,
  map,
  mapValues,
  omitBy,
  sumBy,
  tail,
} from 'lodash-es';
import { P, match } from 'ts-pattern';
import { Emby, Imported, Jellyfin, Plex } from '../../helpers/constants.ts';
import {
  type AddedMedia,
  type UIChannelProgram,
  type UIIndex,
} from '../../types/index.ts';
import type { State } from '../index.ts';
import useStore from '../index.ts';
import { initialChannelEditorState } from './store.ts';

export const setCurrentEntityType = (
  t?: 'channel' | 'custom-show' | 'filler',
) =>
  useStore.setState((state) => {
    state.currentEntityType = t;
  });

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
      uiIndex: firstIndex + index,
      startTimeOffset: runningOffset,
    };
    runningOffset += item.duration;
    return newItem;
  });
}

function updateProgramList(
  state: Draft<State>,
  programming: CondensedChannelProgramming,
) {
  const programs = addIndexesAndCalculateOffsets(programming.lineup);
  state.channelEditor.programsLoaded = true;
  state.channelEditor.originalProgramList = [...programs];
  state.channelEditor.programList = [...programs];
  state.channelEditor.programLookup = { ...programming.programs };
  state.channelEditor.schedule = programming.schedule;
  state.programLookup = {
    ...state.programLookup,
    ...programming.programs,
  };
}

/**
 * Set the current channel, and optionally, programming,
 * regardless of the current state.
 */
export const setCurrentChannel = (
  channel: Omit<Channel, 'programs'>,
  programming?: CondensedChannelProgramming,
) =>
  useStore.setState((state) => {
    state.channelEditor.currentEntity = channel;
    state.channelEditor.originalEntity = channel;
    if (programming) {
      updateProgramList(state, programming);
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
  useStore.setState((state) => {
    const channelEditor = state.channelEditor;
    if (channelEditor.currentEntity?.id !== channel.id) {
      channelEditor.currentEntity = channel;
      channelEditor.originalEntity = channel;
      channelEditor.programsLoaded = false;
      channelEditor.dirty.programs = false;
      channelEditor.programList = [];
      channelEditor.originalProgramList = [];
      channelEditor.schedule = undefined;
      channelEditor.programLookup = {};
      if (programming) {
        updateProgramList(state, programming);
      }
    } else if (!channelEditor.programsLoaded && programming) {
      updateProgramList(state, programming);
    }
  });

export const setCurrentChannelProgramming = (
  programming: CondensedChannelProgramming,
  setDirty?: boolean,
) =>
  useStore.setState((state) => {
    updateProgramList(state, programming);
    if (!isUndefined(setDirty)) {
      state.channelEditor.dirty.programs = setDirty;
    }
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

export const appendToCurrentLineup = (
  newItems: CondensedChannelProgram[],
  dirty?: boolean,
) =>
  useStore.setState((state) => {
    if (state.channelEditor.programList.length === 0) {
      state.channelEditor.programList = addIndexesAndCalculateOffsets(newItems);
    } else {
      const lastItem = last(state.channelEditor.programList)!;
      const nextOffset = lastItem.startTimeOffset + lastItem.duration;
      state.channelEditor.programList.push(
        ...addIndexesAndCalculateOffsets(
          newItems,
          nextOffset,
          state.channelEditor.programList.length,
        ),
      );
    }
    state.channelEditor.programsLoaded = true;
    if (!isUndefined(dirty)) {
      state.channelEditor.dirty.programs = dirty;
    }
  });

export const resetCurrentLineup = (programming: CondensedChannelProgramming) =>
  useStore.setState((state) => {
    updateProgramList(state, programming);
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
  useStore.setState((state) => {
    const lastItem = last(state.channelEditor.programList);
    const firstOffset = lastItem
      ? lastItem.startTimeOffset + lastItem.duration
      : 0;
    state.channelEditor.programList.push(
      ...addIndexesAndCalculateOffsets(
        programs,
        firstOffset,
        state.channelEditor.programList.length,
      ),
    );
    state.channelEditor.dirty.programs =
      state.channelEditor.dirty.programs || programs.length > 0;
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
  useStore.setState(({ channelEditor, programLookup }) => {
    if (channelEditor.currentEntity && programs.length > 0) {
      channelEditor.dirty.programs = true;
      const addedDuration = sumBy(programs, (program) =>
        match(program)
          .with(
            { type: P.union(Plex, Jellyfin, Emby) },
            ({ media }) => media.duration ?? 0,
          )
          .with({ type: 'custom-show' }, ({ program }) => program.duration ?? 0)
          .with({ type: 'imported' }, ({ media }) => media.duration)
          .exhaustive(),
      );

      // Convert any external program types to our internal representation
      const allNewPrograms = seq.collect(programs, (item) => {
        const result = match(item)
          // There might be a way to consolidate these in a type-safe way, but I'm
          // not sure right now.
          .with(
            { type: P.union(Plex, Jellyfin, Emby), media: P.select() },
            (item) => ApiProgramMinter.mintProgram2(item),
          )
          .with(
            { type: 'custom-show', program: P.select() },
            (program) => program,
          )
          .with(
            {
              type: Imported,
              media: P.select(),
            },
            (program) => program,
          )
          .exhaustive();

        if (!result) {
          console.warn(
            'Could not successfully convert item to API representation. This implies data was missing and the item was omitted to protect invariants. Please report this!',
            item,
          );
        }

        return result;
      });

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
      const contentProgramsById = mapValues(
        omitBy(
          groupBy(
            seq.collect(
              allNewPrograms,
              forProgramType({
                content: identity,
                custom: ({ program }) => program,
              }),
            ),
            (p) => p.id ?? p.uniqueId,
          ),
          isNil,
        ),
        unwrapNil(first),
      );

      extend(channelEditor.programLookup, contentProgramsById);
      extend(programLookup, contentProgramsById);
    }
  });
