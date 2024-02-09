import { chain, isUndefined } from 'lodash-es';
import useStore, { State } from './index.ts';
import {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
} from '@tunarr/types';
import { UiIndex } from './channelEditor/store.ts';

const materializeProgramList = (
  programList: (CondensedChannelProgram & UiIndex)[],
  programLookup: Record<string, ContentProgram>,
) => {
  return chain(programList)
    .map((p) => {
      if (p.type === 'content' && !isUndefined(p.id) && programLookup[p.id]) {
        const content: ContentProgram & UiIndex = {
          ...p,
          ...programLookup[p.id],
        };
        return content;
      } else if (p.type !== 'content') {
        return p;
      }

      return null;
    })
    .compact()
    .value();
};

export const materializedProgramListSelector = ({
  channelEditor: { programList, programLookup },
}: State): (ChannelProgram & UiIndex)[] => {
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
