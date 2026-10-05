import { seq } from '@tunarr/shared/util';
import {
  type CondensedChannelProgram,
  type ContentProgram,
} from '@tunarr/types';
import { isNil } from 'lodash-es';
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  UIChannelProgramWithOffset,
  UICondensedContentProgram,
  UIContentProgram,
} from '../types/index.ts';
import { type UIIndex } from '../types/index.ts';
import type { Maybe } from '../types/util.ts';
import type {
  ChannelEditorState,
  CustomShowEditor,
  FillerListEditor,
} from './channelEditor/store.ts';
import useStore, { type State } from './index.ts';

// Many components select the materialized list on every render. Caching by
// input identity keeps the result stable, so callers must not mutate it.
const materializeCache = new WeakMap<
  object,
  { programLookup: object; result: UIChannelProgramWithOffset[] }
>();

export const materializeProgramList = (
  lineup: (CondensedChannelProgram & UIIndex)[],
  programLookup: Record<string, ContentProgram>,
): UIChannelProgramWithOffset[] => {
  const cached = materializeCache.get(lineup);
  if (cached?.programLookup === programLookup) {
    return cached.result;
  }
  const result = buildProgramList(lineup, programLookup);
  materializeCache.set(lineup, { programLookup, result });
  return result;
};

const buildProgramList = (
  lineup: (CondensedChannelProgram & UIIndex)[],
  programLookup: Record<string, ContentProgram>,
): UIChannelProgramWithOffset[] => {
  // TODO: Use the offsets from the network call
  let offset = 0;
  return seq.collect(lineup, (p) => {
    let content: UIChannelProgramWithOffset | null = null;
    if (p.type === 'content') {
      const program = programLookup[p.id];
      if (program) {
        content = {
          ...program,
          ...p,
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

const channelEditorCache = new WeakMap<
  ChannelEditorState,
  ReturnType<typeof buildChannelEditor>
>();

function channelEditorSelector(s: State) {
  const editor = s.channelEditor;
  let result = channelEditorCache.get(editor);
  if (result === undefined) {
    result = buildChannelEditor(editor);
    channelEditorCache.set(editor, result);
  }
  return result;
}

function buildChannelEditor(editor: ChannelEditorState) {
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

export function condenseCustomShowEditorPrograms(
  programs: UIContentProgram[],
): UICondensedContentProgram[] {
  return programs.map(
    (program) =>
      ({
        duration: program.duration,
        id: program.id,
        originalIndex: program.originalIndex,
        startTimeOffset: program.startTimeOffset ?? 0,
        type: 'content',
        uiIndex: program.uiIndex,
        icon: program.icon,
        startOffsetMs: program.startOffsetMs,
      }) satisfies UICondensedContentProgram,
  );
}
