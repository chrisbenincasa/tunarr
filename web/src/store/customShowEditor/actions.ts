import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import { ContentProgram, CustomProgram } from '@tunarr/types';
import { map, merge } from 'lodash-es';
import { forAddedMediaType, zipWithIndex } from '../../helpers/util.ts';
import { AddedMedia } from '../../types/index.ts';
import {
  jellyfinItemToContentProgram,
  plexMediaToContentProgram,
} from '../channelEditor/actions';
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
          jellyfin: ({ media }) => jellyfinItemToContentProgram(media),
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

export const updateCurrentCustomShow = (show: Partial<CustomShow>) =>
  useStore.setState(({ customShowEditor }) => {
    customShowEditor.currentEntity = merge(
      {},
      customShowEditor.currentEntity,
      show,
    );
  });

export const clearCurrentCustomShow = () =>
  useStore.setState((state) => {
    state.customShowEditor = emptyEntityEditor();
  });
