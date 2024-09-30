import { CondensedChannelProgram, ContentProgram } from '@tunarr/types';
import { chain, isNil, isUndefined } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { UIChannelProgram, UIIndex } from '../types/index.ts';
import useStore, { State } from './index.ts';

const materializeProgramList = (
  lineup: (CondensedChannelProgram & UIIndex)[],
  programLookup: Record<string, ContentProgram>,
): UIChannelProgram[] => {
  // TODO: Use the offsets from the network call
  let offset = 0;
  return chain(lineup)
    .map((p) => {
      let content: UIChannelProgram | null = null;
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
  channelEditor: { programList },
  programLookup,
}: State): UIChannelProgram[] => {
  return materializeProgramList(programList, programLookup);
};

// Selects the channel editor but also materializes the program list array
export const useChannelEditor = () => {
  return useStore((s) => {
    const editor = s.channelEditor;
    return {
      ...editor,
      programList: materializeProgramList(editor.programList, s.programLookup),
      originalProgramList: materializeProgramList(
        editor.originalProgramList,
        s.programLookup,
      ),
    };
  });
};

export const useCurrentChannel = () => {
  return useStore((s) => s.channelEditor.currentEntity);
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

export const useCurrentEditor = () => {
  return useStore((s) =>
    match(s.currentEditor)
      .with({ type: 'channel', id: P.select() }, (id) =>
        id ? s.channels[id] : null,
      )
      .with({ type: 'custom_show' }, () => s.customShowEditor)
      .with({ type: 'filler_list' }, () => s.fillerListEditor)
      .otherwise(() => null),
  );
};
