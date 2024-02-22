import {
  Channel,
  ChannelProgram,
  CondensedChannelProgram,
  CondensedChannelProgramming,
  ContentProgram,
  CustomShow,
  CustomShowProgramming,
  FillerList,
  FillerListProgramming,
} from '@tunarr/types';
import { isPlexEpisode } from '@tunarr/types/plex';
import {
  extend,
  findIndex,
  groupBy,
  inRange,
  isNil,
  isUndefined,
  last,
  map,
  omitBy,
  sumBy,
} from 'lodash-es';
import { zipWithIndex } from '../../helpers/util.ts';
import { EnrichedPlexMedia } from '../../hooks/plexHooks.ts';
import useStore from '../index.ts';
import {
  ChannelEditorState,
  UIIndex,
  initialChannelEditorState,
} from './store.ts';
import { Draft } from 'immer';

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

export const resetCurrentLineup = (
  lineup: CondensedChannelProgram[],
  programs: Record<string, ContentProgram>,
) =>
  useStore.setState((state) => {
    const zippedLineup = addIndexesAndCalculateOffsets(lineup);
    state.channelEditor.programList = [...zippedLineup];
    state.channelEditor.originalProgramList = [...zippedLineup];
    state.channelEditor.programLookup = { ...programs };
    state.channelEditor.dirty.programs = false;
  });

export const resetLineup = () =>
  useStore.setState((state) => {
    state.channelEditor.programList = [
      ...state.channelEditor.originalProgramList,
    ];
    state.channelEditor.dirty.programs = false;
  });

export const deleteProgram = (idx: number) =>
  useStore.setState(({ channelEditor }) => {
    if (
      channelEditor.programList.length > 0 &&
      idx >= 0 &&
      idx < channelEditor.programList.length
    ) {
      channelEditor.programList.splice(idx, 1);
      channelEditor.dirty.programs = true;
    }
  });

export const removeCustomShowProgram = (idx: number) =>
  useStore.setState(({ customShowEditor }) => {
    if (
      customShowEditor.programList.length > 0 &&
      idx >= 0 &&
      idx < customShowEditor.programList.length
    ) {
      customShowEditor.programList.splice(idx, 1);
      customShowEditor.dirty.programs = true;
    }
  });

export const removeFillerListProgram = (idx: number) =>
  useStore.setState(({ fillerListEditor }) => {
    if (
      fillerListEditor.programList.length > 0 &&
      idx >= 0 &&
      idx < fillerListEditor.programList.length
    ) {
      fillerListEditor.programList.splice(idx, 1);
      fillerListEditor.dirty.programs = true;
    }
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

export const moveProgramInCurrentChannel = (
  originalIndex: number,
  toIndex: number,
) =>
  useStore.setState(({ channelEditor }) => {
    const programIdx = findIndex(channelEditor.programList, { originalIndex });
    if (inRange(toIndex, channelEditor.programList.length) && programIdx >= 0) {
      const item = channelEditor.programList.splice(programIdx, 1);
      channelEditor.programList.splice(toIndex, 0, ...item);
    }
  });

export const setChannelStartTime = (startTime: number) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity) {
      channelEditor.currentEntity.startTime = startTime;
      channelEditor.dirty.programs = true;
    }
  });

const generatePrograms = (programs: EnrichedPlexMedia[]): ContentProgram[] => {
  return programs.map((program) => {
    let ephemeralProgram: ContentProgram;
    if (isPlexEpisode(program)) {
      ephemeralProgram = {
        id: program.id ?? `plex|${program.serverName}|${program.key}`,
        persisted: !isNil(program.id),
        originalProgram: program,
        duration: program.duration,
        externalSourceName: program.serverName,
        externalSourceType: 'plex',
        externalKey: program.key,
        uniqueId: `plex|${program.serverName}|${program.key}`,
        type: 'content',
        subtype: 'episode',
        title: program.grandparentTitle,
        episodeTitle: program.title,
        episodeNumber: program.index,
        seasonNumber: program.parentIndex,
      };
    } else {
      ephemeralProgram = {
        id: program.id ?? `plex|${program.serverName}|${program.key}`,
        persisted: !isNil(program.id),
        originalProgram: program,
        duration: program.duration,
        externalSourceName: program.serverName,
        externalSourceType: 'plex',
        uniqueId: `plex|${program.serverName}|${program.key}`,
        type: 'content',
        subtype: 'movie',
        title: program.title,
      };
    }

    return ephemeralProgram;
  });
};

export const addPlexMediaToCurrentChannel = (programs: EnrichedPlexMedia[]) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity && programs.length > 0) {
      channelEditor.dirty.programs = true;
      const ephemeralPrograms = generatePrograms(programs);

      const oldDuration = channelEditor.currentEntity.duration;
      const newDuration =
        oldDuration + sumBy(ephemeralPrograms, (p) => p.duration);

      // Set the new channel duration based on the new program durations
      // const now = dayjs()
      channelEditor.currentEntity.duration = newDuration;

      // Add offset times to all incoming programs
      const lastItem = last(channelEditor.programList);
      const firstOffset = lastItem
        ? lastItem.startTimeOffset + lastItem.duration
        : 0;
      const programsWithOffset = addIndexesAndCalculateOffsets(
        ephemeralPrograms,
        firstOffset,
        channelEditor.programList.length,
      );

      // Add new programs to the end of the existing list
      channelEditor.programList.push(...programsWithOffset);

      // Add new lookups for these programs for when we materialize them in the selector
      extend(
        channelEditor.programLookup,
        omitBy(
          groupBy(ephemeralPrograms, (p) => p.id),
          isNil,
        ),
      );
    }
  });

export const setCurrentCustomShow = (
  show: CustomShow,
  programs: CustomShowProgramming,
) =>
  useStore.setState(({ customShowEditor }) => {
    customShowEditor.currentEntity = show;
    customShowEditor.originalEntity = show;
    customShowEditor.dirty.programs = false;
    const zippedPrograms = zipWithIndex(programs);
    customShowEditor.originalProgramList = [...zippedPrograms];
    customShowEditor.programList = [...zippedPrograms];
  });

export const addPlexMediaToCurrentCustomShow = (
  programs: EnrichedPlexMedia[],
) =>
  useStore.setState(({ customShowEditor }) => {
    if (customShowEditor.currentEntity && programs.length > 0) {
      customShowEditor.dirty.programs = true;
      const convertedPrograms = generatePrograms(programs);
      customShowEditor.programList = customShowEditor.programList.concat(
        zipWithIndex(convertedPrograms, customShowEditor.programList.length),
      );
    }
  });

export const setCurrentFillerList = (
  show: FillerList,
  programs: FillerListProgramming,
) =>
  useStore.setState(({ fillerListEditor }) => {
    fillerListEditor.currentEntity = show;
    fillerListEditor.originalEntity = show;
    fillerListEditor.dirty.programs = false;
    const zippedPrograms = zipWithIndex(programs);
    fillerListEditor.originalProgramList = [...zippedPrograms];
    fillerListEditor.programList = [...zippedPrograms];
  });

export const addPlexMediaToCurrentFillerList = (
  programs: EnrichedPlexMedia[],
) =>
  useStore.setState(({ fillerListEditor }) => {
    if (fillerListEditor.currentEntity && programs.length > 0) {
      fillerListEditor.dirty.programs = true;
      const convertedPrograms = generatePrograms(programs);
      fillerListEditor.programList = fillerListEditor.programList.concat(
        zipWithIndex(convertedPrograms, fillerListEditor.programList.length),
      );
    }
  });
