import type { Person, ProgramOrFolder } from '@tunarr/types';
import { isStructuralItemType } from '@tunarr/types';
import type { MediaArtworkType } from '@tunarr/types/schemas';
import { groupBy } from 'lodash-es';
import { useCallback } from 'react';
import type { MarkOptional } from 'ts-essentials';
import type z from 'zod';
import { useSettings } from '../store/settings/selectors.ts';

export const useGetArtworkUrl = () => {
  const settings = useSettings();
  return useCallback(
    (
      item: ProgramOrFolder,
      artworkCheckOrder: z.infer<typeof MediaArtworkType>[] = [
        'poster',
        'thumbnail',
      ],
    ) => {
      if (isStructuralItemType(item)) {
        return null;
      }

      const artByType = groupBy(item.artwork, (art) => art.type);
      for (const type of artworkCheckOrder) {
        if (artByType[type]) {
          return `${settings.backendUri}/api/programs/${item.uuid}/artwork/${type}`;
        }
      }

      return null;
    },
    [settings.backendUri],
  );
};

export const useGetPersonArtwork = () => {
  const settings = useSettings();
  return useCallback(
    (
      item: MarkOptional<Person, 'type'>,
      type: z.infer<typeof MediaArtworkType>,
    ) => {
      if (!item.uuid) {
        return null;
      }
      // Try anything for now.
      return `${settings.backendUri}/api/credits/${item.uuid}/artwork/${type}`;
    },
    [settings.backendUri],
  );
};
