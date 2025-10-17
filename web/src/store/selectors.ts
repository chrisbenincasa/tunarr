import { seq } from '@tunarr/shared/util';
import {
  type CondensedChannelProgram,
  type ContentProgram,
} from '@tunarr/types';
import { isNil, isUndefined } from 'lodash-es';
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { UIChannelProgramWithOffset } from '../types/index.ts';
import { type UIIndex } from '../types/index.ts';
import type { Maybe } from '../types/util.ts';
import type {
  ChannelEditorState,
  CustomShowEditor,
  FillerListEditor,
} from './channelEditor/store.ts';
import useStore, { type State } from './index.ts';

export const materializeProgramList = (
  lineup: (CondensedChannelProgram & UIIndex)[],
  programLookup: Record<string, ContentProgram>,
): UIChannelProgramWithOffset[] => {
  // TODO: Use the offsets from the network call
  let offset = 0;
  return seq.collect(lineup, (p) => {
    let content: UIChannelProgramWithOffset | null = null;
    if (p.type === 'content') {
      if (!isUndefined(p.id) && !isNil(programLookup[p.id])) {
        content = {
          ...p,
          ...programLookup[p.id],
          startTimeOffset: offset,
        };
      }
    } else if (p.type === 'custom' || p.type === 'filler') {
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
  });
};

export const materializedProgramListSelector = ({
  channelEditor: { programList },
  programLookup,
}: State): UIChannelProgramWithOffset[] => {
  return materializeProgramList(programList, programLookup);
};

function channelEditorSelector(s: State) {
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
}

// Selects the channel editor but also materializes the program list array
export const useChannelEditor = () => {
  return useStore(channelEditorSelector);
};

export const useChannelEditorLazy = () => {
  const channelEditor = useStore(useShallow((s) => s.channelEditor));
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

export const useCurrentEditorState = (): Maybe<
  ChannelEditorState | CustomShowEditor | FillerListEditor
> => {
  return useStore((s) => {
    if (!s.currentEntityType) {
      return;
    }
    switch (s.currentEntityType) {
      case 'custom-show':
        return s.customShowEditor;
      case 'channel':
        return s.channelEditor;
      case 'filler':
        return s.fillerListEditor;
    }
  });
};
