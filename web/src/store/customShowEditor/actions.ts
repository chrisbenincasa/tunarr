import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import { ApiProgramMinter } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import {
  type ContentProgram,
  type CustomProgram,
  type CustomShow,
} from '@tunarr/types';
import { findIndex, forEach, inRange, merge } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { zipWithIndex } from '../../helpers/util.ts';
import { type AddedMedia } from '../../types/index.ts';
import useStore from '../index.ts';

export const addMediaToCurrentCustomShow = (programs: AddedMedia[]) =>
  useStore.setState(({ customShowEditor }) => {
    if (customShowEditor.currentEntity && programs.length > 0) {
      customShowEditor.dirty.programs = true;
      const allNewPrograms = seq.collect(programs, (item) =>
        match(item)
          .with({ type: 'plex', media: P.select() }, (plexItem) =>
            ApiProgramMinter.mintProgram(
              { id: plexItem.serverId, name: plexItem.serverName },
              { program: plexItem, sourceType: 'plex' },
            ),
          )
          .with({ type: 'jellyfin', media: P.select() }, (jfItem) =>
            ApiProgramMinter.mintProgram(
              { id: jfItem.serverId, name: jfItem.serverName },
              { program: jfItem, sourceType: 'jellyfin' },
            ),
          )
          .otherwise(() => null),
      );

      customShowEditor.programList = customShowEditor.programList.concat(
        zipWithIndex(allNewPrograms, customShowEditor.programList.length),
      );
    }
  });

export const setCurrentCustomShow = (
  show: CustomShow,
  programs: CustomProgram[],
) =>
  useStore.setState((state) => {
    state.customShowEditor.currentEntity = show;
    state.customShowEditor.originalEntity = show;
    state.customShowEditor.dirty.programs = false;
    state.customShowEditor.programsLoaded = true;
    // These come in order; unwrap to get the content programs underneath
    // The frontend manages the order from here on out.
    const unwrappedPrograms = seq.collect(programs, ({ program }) => program);
    const zippedPrograms = zipWithIndex(unwrappedPrograms);
    state.customShowEditor.originalProgramList = [...zippedPrograms];
    state.customShowEditor.programList = [...zippedPrograms];
    for (const { program } of programs) {
      if (!program || !program.id) {
        continue;
      }
      state.programLookup[program.id] = program;
    }
  });

export const setCurrentCustomShowProgramming = (
  programming: ContentProgram[],
) =>
  useStore.setState(({ customShowEditor }) => {
    const programs = zipWithIndex(programming);
    customShowEditor.dirty.programs = true;
    customShowEditor.programList = [...programs];
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
        program.uiIndex = i;
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

export const resetCustomShowProgramming = () =>
  useStore.setState(({ customShowEditor }) => {
    customShowEditor.programList = customShowEditor.originalProgramList;
    customShowEditor.dirty.programs = false;
  });
