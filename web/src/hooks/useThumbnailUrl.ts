import { createExternalId } from '@tunarr/shared';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { Person, ProgramOrFolder } from '@tunarr/types';
import { isStructuralItemType, tag } from '@tunarr/types';
import type { MediaArtworkType } from '@tunarr/types/schemas';
import { groupBy, isEmpty } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import type { MarkOptional } from 'ts-essentials';
import type z from 'zod';
import { useSettings } from '../store/settings/selectors.ts';

export const useGetArtworkUrl = () => {
  const settings = useSettings();
  const actualBackendUri = useMemo(
    () =>
      isEmpty(settings.backendUri)
        ? window.location.origin
        : settings.backendUri,
    [settings.backendUri],
  );
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
        const matchingArt = artByType[type];
        if (!isEmpty(matchingArt)) {
          const persistedArt = matchingArt.find((art) =>
            isNonEmptyString(art.id),
          );
          if (persistedArt || item.sourceType === 'local') {
            return `${actualBackendUri}/api/programs/${item.uuid}/artwork/${type}`;
          }

          // TODO: Just return the right URLs in the artwork item itself!
          const url = new URL(`/api/metadata/external`, actualBackendUri);
          url.searchParams.append('asset', 'image');
          url.searchParams.append('imageType', 'poster');
          url.searchParams.append(
            'cache',
            import.meta.env.PROD ? 'true' : 'false',
          );
          url.searchParams.append('mode', 'proxy');
          url.searchParams.append(
            'id',
            createExternalId(
              item.sourceType,
              tag(item.mediaSourceId),
              item.externalId ?? '',
            ),
          );
          return url.toString();
        }
      }

      return null;
    },
    [actualBackendUri],
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
