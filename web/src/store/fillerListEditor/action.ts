import { forAddedMediaType, zipWithIndex } from '@/helpers/util.ts';
import {
  jellyfinItemToContentProgram,
  plexMediaToContentProgram,
} from '@/store/channelEditor/actions';
import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import useStore from '@/store/index.ts';
import { AddedMedia } from '@/types/index.ts';
import {
  ContentProgram,
  CustomProgram,
  FillerList,
  FillerListProgramming,
} from '@tunarr/types';
import { map, merge } from 'lodash-es';

export const addMediaToCurrentFillerList = (
  programs: AddedMedia[],
  prepend: boolean = false,
) =>
  useStore.setState(({ fillerListEditor }) => {
    if (fillerListEditor.currentEntity && programs.length > 0) {
      fillerListEditor.dirty.programs = true;
      const convertedPrograms = map(
        programs,
        forAddedMediaType<ContentProgram | CustomProgram>({
          plex: ({ media }) => plexMediaToContentProgram(media),
          jellyfin: ({ media }) => jellyfinItemToContentProgram(media),
          'custom-show': ({ program }) => program,
        }),
      );

      if (prepend) {
        for (const program of fillerListEditor.programList) {
          program.originalIndex += convertedPrograms.length;
        }
        fillerListEditor.programList = zipWithIndex(convertedPrograms).concat(
          fillerListEditor.programList,
        );
      } else {
        fillerListEditor.programList = fillerListEditor.programList.concat(
          zipWithIndex(convertedPrograms, fillerListEditor.programList.length),
        );
      }
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

export const updateCurrentFillerList = (show: Partial<FillerList>) =>
  useStore.setState(({ fillerListEditor }) => {
    fillerListEditor.currentEntity = merge(
      {},
      fillerListEditor.currentEntity,
      show,
    );
  });

export const clearCurrentFillerList = () =>
  useStore.setState((state) => {
    state.fillerListEditor = emptyEntityEditor();
  });
