import { Channel } from 'dizquetv-types';
import { PlexMedia, isPlexEpisode } from 'dizquetv-types/plex';
import useStore from '..';
import {
  EphemeralProgram,
  WorkingProgram,
  initialChannelEditorState,
} from './store.ts';

// export const resetChannelEditorState = useStore.setState((state) => {
//   const newState = {
//     ...state,
//     channelEditor: initialChannelEditorState,
//   };

//   return newState;
// });

export const setCurrentChannel = (channel: Channel) =>
  useStore.setState((state) => {
    state.channelEditor.currentChannel = channel;
  });

export const addProgramsToCurrentChannel = (programs: WorkingProgram[]) =>
  useStore.setState((state) => {
    console.log({ ...state.channelEditor });
    state.channelEditor.programList.push(...programs);
  });

export const addPlexMediaToCurrentChannel = (programs: PlexMedia[]) =>
  useStore.setState((state) => {
    if (state.channelEditor.currentChannel) {
      const ephemeralPrograms: EphemeralProgram[] = programs.map((program) => {
        if (isPlexEpisode(program)) {
          return {
            persisted: false,
            originalProgram: program,
          };
        } else {
          return {
            persisted: false,
            originalProgram: program,
          };
        }
      });

      state.channelEditor.programList.push(...ephemeralPrograms);
    }
  });
