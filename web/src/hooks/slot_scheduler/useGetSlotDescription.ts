import type { BaseSlot } from '@tunarr/types/api';
import { find } from 'lodash-es';
import { useCallback } from 'react';
import { useSlotProgramOptions } from '../programming_controls/useSlotProgramOptions.ts';

export const useGetSlotDescription = () => {
  const { dropdownOpts: programOptions } = useSlotProgramOptions();
  return useCallback(
    (value: BaseSlot) => {
      switch (value.type) {
        case 'movie':
          return 'Movie';
        case 'show':
          return find(programOptions, { showId: value.showId })?.description;
        case 'flex':
          return 'Flex';
        case 'redirect':
          return find(programOptions, { channelId: value.channelId })
            ?.description;
        case 'custom-show': {
          const showName = find(programOptions, {
            customShowId: value.customShowId,
          })?.description;
          return `Custom Show - ${showName}`;
        }
        case 'filler': {
          const showName = find(programOptions, {
            fillerListId: value.fillerListId,
          })?.description;
          return `Filler - ${showName}`;
        }
      }
    },
    [programOptions],
  );
};
