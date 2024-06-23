import { ContentProgram, CustomProgram } from '@tunarr/types';
import { map } from 'lodash-es';
import { forAddedMediaType, zipWithIndex } from '../../helpers/util.ts';
import { AddedMedia } from '../../types/index.ts';
import { plexMediaToContentProgram } from '../channelEditor/actions';
import useStore from '../index.ts';

import { FillerList, FillerListProgramming } from '@tunarr/types';

export const addMediaToCurrentFillerList = (programs: AddedMedia[]) =>
  useStore.setState(({ fillerListEditor }) => {
    if (fillerListEditor.currentEntity && programs.length > 0) {
      fillerListEditor.dirty.programs = true;
      const convertedPrograms = map(
        programs,
        forAddedMediaType<ContentProgram | CustomProgram>({
          plex: ({ media }) => plexMediaToContentProgram(media),
          'custom-show': ({ program }) => program,
        }),
      );
      console.log(
        programs,
        convertedPrograms,
        zipWithIndex(convertedPrograms, fillerListEditor.programList.length),
      );

      fillerListEditor.programList = fillerListEditor.programList.concat(
        zipWithIndex(convertedPrograms, fillerListEditor.programList.length),
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
