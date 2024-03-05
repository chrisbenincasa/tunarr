import { CondensedChannelProgram, ContentProgram } from '@tunarr/types';
import { chain, isUndefined } from 'lodash-es';
import { UIChannelProgram, UIIndex } from '../types/index.ts';
import useStore, { State } from './index.ts';

const materializeProgramList = (
  programList: (CondensedChannelProgram & UIIndex)[],
  programLookup: Record<string, ContentProgram>,
): UIChannelProgram[] => {
  // TODO: Use the offsets from the network call
  let offset = 0;
  return chain(programList)
    .map((p) => {
      if (p.type === 'content' && !isUndefined(p.id) && programLookup[p.id]) {
        const content: UIChannelProgram = {
          ...p,
          ...programLookup[p.id],
          startTimeOffset: offset,
        };
        offset += content.duration;
        return content;
      } else if (p.type !== 'content') {
        const item: UIChannelProgram = {
          ...p,
          startTimeOffset: offset,
        };
        offset += item.duration;
        return item;
      }

      return null;
    })
    .compact()
    .value();
};

export const materializedProgramListSelector = ({
  channelEditor: { programList, programLookup },
}: State): UIChannelProgram[] => {
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
