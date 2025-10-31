import { find } from 'lodash-es';
import { useCallback } from 'react';
import type { CommonSlotViewModel } from '../../model/CommonSlotModels.ts';
import { useSlotProgramOptionsContext } from '../programming_controls/useSlotProgramOptions.ts';

export const useSlotName = () => {
  const programOptions = useSlotProgramOptionsContext();
  return useCallback(
    (slot: CommonSlotViewModel) => {
      switch (slot.type) {
        case 'movie':
          return 'Movie';
        case 'show':
          return (
            slot.show?.title ??
            find(programOptions, { showId: slot.showId })?.description
          );
        case 'flex':
          return 'Flex';
        case 'redirect':
          return find(programOptions, { channelId: slot.channelId })
            ?.description;
        case 'custom-show': {
          const showName = find(programOptions, {
            customShowId: slot.customShowId,
          })?.description;
          return `Custom Show - ${showName}`;
        }
        case 'filler': {
          const showName = find(programOptions, {
            fillerListId: slot.fillerListId,
          })?.description;
          return `Filler - ${showName}`;
        }
        case 'smart-collection': {
          const collectionName = find(programOptions, {
            collectionId: slot.smartCollectionId,
          })?.description;
          return `Smart Collection - ${collectionName}`;
        }
      }
    },
    [programOptions],
  );
};
