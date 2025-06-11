import {
  type CondensedChannelProgram,
  type ContentProgram,
} from '@tunarr/types';
import { chain, isNil, isUndefined } from 'lodash-es';
import { useCallback } from 'react';
import type { UIChannelProgramWithOffset } from '../types/index.ts';
import { type UIIndex } from '../types/index.ts';
import useStore, { type State } from './index.ts';

export const materializeProgramList = (
  lineup: (CondensedChannelProgram & UIIndex)[],
  programLookup: Record<string, ContentProgram>,
): UIChannelProgramWithOffset[] => {
  // TODO: Use the offsets from the network call
  let offset = 0;
  return chain(lineup)
    .map((p) => {
      let content: UIChannelProgramWithOffset | null = null;
      if (p.type === 'content') {
        if (!isUndefined(p.id) && !isNil(programLookup[p.id])) {
          content = {
            ...p,
            ...programLookup[p.id],
            startTimeOffset: offset,
          };
        }
      } else if (p.type === 'custom') {
        if (!isNil(programLookup[p.id])) {
          content = {
            ...p,
            program: {
              ...programLookup[p.id],
            },
            startTimeOffset: offset,
          };
        }
      } else {
        content = {
          ...p,
          startTimeOffset: offset,
        };
      }

      if (content) {
        offset += content.duration;
      }

      return content;
    })
    .compact()
    .value();
};

export const materializedProgramListSelector = ({
  channelEditor: { programList, programLookup },
}: State): UIChannelProgramWithOffset[] => {
  return materializeProgramList(programList, programLookup);
};

// Selects the channel editor but also materializes the program list array
export const useChannelEditor = () => {
  return useStore((s) => {
    const editor = s.channelEditor;
    return {
      ...editor,
      programList: materializeProgramList(
        editor.programList,
        editor.programLookup,
      ),
      originalProgramList: materializeProgramList(
        editor.originalProgramList,
        editor.programLookup,
      ),
    };
  });
};

export const useChannelEditorLazy = () => {
  const channelEditor = useStore((s) => s.channelEditor);
  const materializeLineup = useCallback(
    (
      lineup: (CondensedChannelProgram & UIIndex)[],
      programLookup: Record<string, ContentProgram>,
    ) => {
      return materializeProgramList(lineup, programLookup);
    },
    [],
  );

  const materializeNewLineup = useCallback(
    () =>
      materializeLineup(channelEditor.programList, channelEditor.programLookup),
    [channelEditor.programList, channelEditor.programLookup, materializeLineup],
  );

  const materializeOriginalLineup = useCallback(
    () =>
      materializeLineup(
        channelEditor.originalProgramList,
        channelEditor.programLookup,
      ),
    [
      channelEditor.originalProgramList,
      channelEditor.programLookup,
      materializeLineup,
    ],
  );

  return {
    channelEditor,
    materializeNewProgramList: materializeNewLineup,
    materializeOriginalProgramList: materializeOriginalLineup,
  };
};

export const useCustomShowEditor = () => {
  return useStore((s) => {
    const editor = s.customShowEditor;
    return {
      ...editor,
      programList: editor.programList,
      originalProgramList: editor.originalProgramList,
    };
  });
};

export const useFillerListEditor = () => {
  return useStore((s) => {
    const editor = s.fillerListEditor;
    return {
      ...editor,
      programList: editor.programList,
      originalProgramList: editor.originalProgramList,
    };
  });
};

export const useStoreProgramLookup = () =>
  useStore((s) => s.channelEditor.programLookup);
