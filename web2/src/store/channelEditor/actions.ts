import { Channel, EphemeralProgram } from 'dizquetv-types';
import { isPlexEpisode } from 'dizquetv-types/plex';
import { sumBy } from 'lodash-es';
import useStore from '..';
import { PlexMediaWithServerName } from '../../hooks/plexHooks.ts';
import { WorkingProgram, initialChannelEditorState } from './store.ts';

export const resetChannelEditorState = () =>
  useStore.setState((state) => {
    const newState = {
      ...state,
      ...initialChannelEditorState,
    };

    return newState;
  });

export const setCurrentChannel = (channel: Channel, lineup: WorkingProgram[]) =>
  useStore.setState((state) => {
    state.channelEditor.currentChannel = channel;
    state.channelEditor.programList = [...lineup];
  });

export const updateCurrentChannel = (channel: Partial<Channel>) =>
  useStore.setState((state) => {
    if (state.channelEditor.currentChannel) {
      state.channelEditor.currentChannel = {
        ...state.channelEditor.currentChannel,
        ...channel,
      };
    }
  });

export const addProgramsToCurrentChannel = (programs: WorkingProgram[]) =>
  useStore.setState((state) => {
    state.channelEditor.programList.push(...programs);
  });

export const setChannelStartTime = (
  startTime: number, // Epoch seconds...for now
) =>
  useStore.setState((state) => {
    if (state.channelEditor.currentChannel) {
      state.channelEditor.currentChannel.startTime = startTime;
      state.channelEditor.dirty.programs = true;
      let lastStartTime = startTime * 1000; // These durations deal in millis...annoying. Will fix
      for (const program of state.channelEditor.programList) {
        const endTime = lastStartTime + program.programDuration;
        program.start = lastStartTime;
        program.stop = endTime;
        lastStartTime = endTime;
      }
    }
  });

export const addPlexMediaToCurrentChannel = (
  programs: PlexMediaWithServerName[],
) =>
  useStore.setState((state) => {
    if (state.channelEditor.currentChannel && programs.length > 0) {
      state.channelEditor.dirty.programs = true;
      const ephemeralPrograms: Omit<EphemeralProgram, 'start' | 'stop'>[] =
        programs.map((program) => {
          let ephemeralProgram: Omit<EphemeralProgram, 'start' | 'stop'>;
          if (isPlexEpisode(program)) {
            ephemeralProgram = {
              persisted: false,
              originalProgram: program,
              programDuration: program.duration,
              externalSourceName: program.serverName,
            };
          } else {
            ephemeralProgram = {
              persisted: false,
              originalProgram: program,
              programDuration: program.duration,
              externalSourceName: program.serverName,
            };
          }

          return ephemeralProgram;
        });

      const oldDuration = state.channelEditor.currentChannel.duration;
      const newDuration =
        oldDuration + sumBy(ephemeralPrograms, (p) => p.programDuration);

      // Set the new channel duration based on the new program durations
      state.channelEditor.currentChannel.duration = newDuration;

      // Set the new channel start time to "now". We can play with this later
      // if we don't want to interrupt current programming when updating the lineup
      let lastStartTime = new Date().getTime();

      // Update the start time for all existing programs
      for (const program of state.channelEditor.programList) {
        const endTime = lastStartTime + program.programDuration;
        program.start = lastStartTime;
        program.stop = endTime;
        lastStartTime = endTime;
      }

      // Add start/end times for all incoming programs
      const programsWithStart: EphemeralProgram[] = [];
      for (const program of ephemeralPrograms) {
        const endTime = lastStartTime + program.programDuration;
        programsWithStart.push({
          ...program,
          start: lastStartTime,
          stop: endTime,
        });
        lastStartTime = endTime;
      }

      state.channelEditor.programList.push(...programsWithStart);
    }
  });
