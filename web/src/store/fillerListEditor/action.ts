import { zipWithIndex } from '@/helpers/util.ts';
import useStore from '@/store/index.ts';
import type { AddedMedia } from '@/types/index.ts';
import { ApiProgramMinter } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import type {
  ContentProgram,
  CustomProgram,
  FillerList,
  FillerListProgramming,
} from '@tunarr/types';
import { merge } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { Emby, Imported, Jellyfin, Plex } from '../../helpers/constants.ts';

export const addMediaToCurrentFillerList = (programs: AddedMedia[]) =>
  useStore.setState(({ fillerListEditor }) => {
    if (fillerListEditor.currentEntity && programs.length > 0) {
      fillerListEditor.dirty.programs = true;
      const allNewPrograms = seq.collect(programs, (item) => {
        const result = match(item)
          .returnType<ContentProgram | CustomProgram | null>()
          // There might be a way to consolidate these in a type-safe way, but I'm
          // not sure right now.
          .with(
            { type: P.union(Plex, Jellyfin, Emby), media: P.select() },
            (item) => ApiProgramMinter.mintProgram2(item),
          )
          .with(
            { type: 'custom-show', program: P.select() },
            (program) => program,
          )
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

      fillerListEditor.programList = fillerListEditor.programList.concat(
        zipWithIndex(allNewPrograms, fillerListEditor.programList.length),
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
    fillerListEditor.programsLoaded = true;
    const zippedPrograms = zipWithIndex(programs);
    fillerListEditor.originalProgramList = [...zippedPrograms];
    fillerListEditor.programList = [...zippedPrograms];
  });

export const setCurrentFillerListPrograms = (programs: FillerListProgramming) =>
  useStore.setState(({ fillerListEditor }) => {
    fillerListEditor.dirty.programs = false;
    fillerListEditor.programsLoaded = true;
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

export const resetFillerList = () =>
  useStore.setState((state) => {
    state.fillerListEditor.programList =
      state.fillerListEditor.originalProgramList;
    state.fillerListEditor.dirty.programs = false;
  });

export const clearCurrentFillerList = () =>
  useStore.setState((state) => {
    state.fillerListEditor.dirty.programs = true;
    state.fillerListEditor.programList = [];
  });
