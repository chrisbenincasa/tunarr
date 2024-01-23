import {
  Channel,
  ChannelProgram,
  ContentGuideProgram,
  ContentProgram,
  CustomShow,
  CustomShowProgramming,
} from 'dizquetv-types';
import { isPlexEpisode } from 'dizquetv-types/plex';
import { isUndefined, sumBy } from 'lodash-es';
import useStore from '..';
import { PlexMediaWithServerName } from '../../hooks/plexHooks.ts';
import { initialChannelEditorState } from './store.ts';

export const resetChannelEditorState = () =>
  useStore.setState((state) => {
    const newState = {
      ...state,
      ...initialChannelEditorState,
    };

    return newState;
  });

export const setCurrentChannel = (channel: Channel, lineup: ChannelProgram[]) =>
  useStore.setState(({ channelEditor }) => {
    channelEditor.currentEntity = channel;
    channelEditor.originalEntity = channel;
    channelEditor.originalProgramList = [...lineup];
    channelEditor.programList = [...lineup];
  });

export const setCurrentLineup = (lineup: ChannelProgram[], dirty?: boolean) =>
  useStore.setState((state) => {
    state.channelEditor.programList = [...lineup];
    if (!isUndefined(dirty)) {
      state.channelEditor.dirty.programs = dirty;
    }
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
    channelEditor.programList.push(...programs);
    channelEditor.dirty.programs =
      channelEditor.dirty.programs || programs.length > 0;
  });

export const setChannelStartTime = (startTime: number) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity) {
      channelEditor.currentEntity.startTime = startTime;
      channelEditor.dirty.programs = true;
    }
  });

const generatePrograms = (
  programs: PlexMediaWithServerName[],
): ContentProgram[] => {
  return programs.map((program) => {
    let ephemeralProgram: Omit<ContentGuideProgram, 'start' | 'stop'>;
    if (isPlexEpisode(program)) {
      const title = `${program.grandparentTitle} - ${program.parentTitle} - ${program.title}`;
      ephemeralProgram = {
        persisted: false,
        originalProgram: program,
        duration: program.duration,
        externalSourceName: program.serverName,
        externalSourceType: 'plex',
        type: 'content',
        subtype: 'episode',
        title: title,
      };
    } else {
      ephemeralProgram = {
        persisted: false,
        originalProgram: program,
        duration: program.duration,
        externalSourceName: program.serverName,
        externalSourceType: 'plex',
        type: 'content',
        subtype: 'movie',
        title: program.title,
      };
    }

    return ephemeralProgram;
  });
};

export const addPlexMediaToCurrentChannel = (
  programs: PlexMediaWithServerName[],
) =>
  useStore.setState(({ channelEditor }) => {
    if (channelEditor.currentEntity && programs.length > 0) {
      channelEditor.dirty.programs = true;
      const ephemeralPrograms = generatePrograms(programs);

      const oldDuration = channelEditor.currentEntity.duration;
      const newDuration =
        oldDuration + sumBy(ephemeralPrograms, (p) => p.duration);

      // Set the new channel duration based on the new program durations
      channelEditor.currentEntity.duration = newDuration;

      // Set the new channel start time to "now". We can play with this later
      // if we don't want to interrupt current programming when updating the lineup
      let lastStartTime = new Date().getTime();

      // Update the start time for all existing programs
      for (const program of channelEditor.programList) {
        const endTime = lastStartTime + program.duration;
        // program.start = lastStartTime;
        // program.stop = endTime;
        lastStartTime = endTime;
      }

      // Add start/end times for all incoming programs
      const programsWithStart: ContentGuideProgram[] = [];
      for (const program of ephemeralPrograms) {
        const endTime = lastStartTime + program.duration;
        programsWithStart.push({
          ...program,
          start: lastStartTime,
          stop: endTime,
        });
        lastStartTime = endTime;
      }

      channelEditor.programList.push(...programsWithStart);
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
    customShowEditor.originalProgramList = [...programs];
    customShowEditor.programList = [...programs];
  });

export const addPlexMediaToCurrentCustomShow = (
  programs: PlexMediaWithServerName[],
) =>
  useStore.setState(({ customShowEditor }) => {
    if (customShowEditor.currentEntity && programs.length > 0) {
      customShowEditor.dirty.programs = true;
      const convertedPrograms = generatePrograms(programs);
      customShowEditor.programList =
        customShowEditor.programList.concat(convertedPrograms);
    }
  });
