import { ContentProgram, CustomProgram } from '@tunarr/types';
import { map } from 'lodash-es';
import { forAddedMediaType, zipWithIndex } from '../../helpers/util.ts';
import { AddedMedia } from '../../types/index.ts';
import { plexMediaToContentProgram } from '../channelEditor/actions';
import useStore from '../index.ts';

import { CustomShow, CustomShowProgramming } from '@tunarr/types';

export const addMediaToCurrentCustomShow = (programs: AddedMedia[]) =>
  useStore.setState(({ customShowEditor }) => {
    if (customShowEditor.currentEntity && programs.length > 0) {
      customShowEditor.dirty.programs = true;
      const allNewPrograms = map(
        programs,
        forAddedMediaType<ContentProgram | CustomProgram>({
          plex: ({ media }) => plexMediaToContentProgram(media),
          'custom-show': ({ program }) => program,
        }),
      );

      customShowEditor.programList = customShowEditor.programList.concat(
        zipWithIndex(allNewPrograms, customShowEditor.programList.length),
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
