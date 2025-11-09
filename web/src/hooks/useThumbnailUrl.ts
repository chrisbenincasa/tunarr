import type { ProgramOrFolder } from '@tunarr/types';
import { isStructuralItemType } from '@tunarr/types';
import type { MediaArtworkType } from '@tunarr/types/schemas';
import { groupBy } from 'lodash-es';
import { useCallback } from 'react';
import type z from 'zod';
import { useSettings } from '../store/settings/selectors.ts';

export const useThumbnailUrl = () => {
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
      console.log(item.artwork);
      for (const type of artworkCheckOrder) {
        if (artByType[type]) {
          return `${settings.backendUri}/api/programs/${item.uuid}/artwork/${type}`;
        }
      }

      return null;

      // if (item.sourceType === 'local') {
      //   // HACK
      // }
      // const idToUse = item.externalId;

      // if (!idToUse) {
      //   return null;
      // }

      // const query = new URLSearchParams({
      //   mode: 'proxy',
      //   asset: 'image',
      //   id: createExternalId(item.sourceType, tag(item.mediaSourceId), idToUse),
      //   // Commenting this out for now as temporary solution for image loading issue
      //   // thumbOptions: JSON.stringify({ width: 480, height: 720 }),
      //   cache: import.meta.env.PROD ? 'true' : 'false',
      // });

      // return `${settings.backendUri}/api/metadata/external?${query.toString()}`;
    },
    [settings.backendUri],
  );
};
