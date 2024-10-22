import { programMinter, zipWithIndex } from '@/helpers/util.ts';
import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import useStore from '@/store/index.ts';
import { AddedMedia } from '@/types/index.ts';
import { FillerList, FillerListProgramming } from '@tunarr/types';
import { map, merge } from 'lodash-es';
import { P, match } from 'ts-pattern';

export const addMediaToCurrentFillerList = (programs: AddedMedia[]) =>
  useStore.setState(({ fillerListEditor }) => {
    if (fillerListEditor.currentEntity && programs.length > 0) {
      fillerListEditor.dirty.programs = true;
      const convertedPrograms = map(programs, (item) =>
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
