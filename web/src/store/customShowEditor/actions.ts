import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import { findIndex, forEach, inRange, map, merge } from 'lodash-es';
import { programMinter, zipWithIndex } from '../../helpers/util.ts';
import { AddedMedia } from '../../types/index.ts';
import useStore from '../index.ts';

import { CustomShow, CustomShowProgramming } from '@tunarr/types';
import { P, match } from 'ts-pattern';

export const addMediaToCurrentCustomShow = (programs: AddedMedia[]) =>
  useStore.setState(({ customShowEditor }) => {
    if (customShowEditor.currentEntity && programs.length > 0) {
      customShowEditor.dirty.programs = true;
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

export const moveProgramInCustomShow = (
  originalIndex: number,
  toIndex: number,
) =>
  useStore.setState(({ customShowEditor }) => {
    const programIdx = findIndex(customShowEditor.programList, {
      originalIndex,
    });
    if (
      inRange(toIndex, customShowEditor.programList.length) &&
      programIdx >= 0
    ) {
      const item = customShowEditor.programList.splice(programIdx, 1);
      customShowEditor.programList.splice(toIndex, 0, ...item);
      forEach(customShowEditor.programList, (program, i) => {
        program.index = i;
      });
      customShowEditor.dirty.programs = true;
    }
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
