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
import { Emby, Imported, Jellyfin, Plex } from '../../helpers/constants.ts';
import { zipWithIndex } from '../../helpers/util.ts';
import { type AddedMedia } from '../../types/index.ts';
import useStore from '../index.ts';

export const addMediaToCurrentCustomShow = (programs: AddedMedia[]) =>
  useStore.setState(({ customShowEditor }) => {
    if (customShowEditor.currentEntity && programs.length > 0) {
      customShowEditor.dirty.programs = true;
      const allNewPrograms = seq.collect(programs, (item) => {
        const result = match(item)
          .returnType<ContentProgram | null>()
          // There might be a way to consolidate these in a type-safe way, but I'm
          // not sure right now.
          .with(
            { type: P.union(Plex, Jellyfin, Emby), media: P.select() },
            (item) => ApiProgramMinter.mintProgram2(item),
          )
          .with({ type: 'custom-show', program: P.select() }, () => null)
          .with(
            {
              type: Imported,
              media: P.select(),
            },
            (program) => program,
          )
          .exhaustive();

        if (!result) {
          console.warn(
            'Could not successfully convert item to API representation. This implies data was missing and the item was omitted to protect invariants. Please report this!',
            item,
          );
        }

        return result;
      });

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
