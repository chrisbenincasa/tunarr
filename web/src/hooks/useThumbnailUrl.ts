import { createExternalId } from '@tunarr/shared';
import type { MediaSourceSettings, ProgramOrFolder } from '@tunarr/types';
import { tag } from '@tunarr/types';
import { useCallback } from 'react';
import { useSettings } from '../store/settings/selectors.ts';

type MinDetails = {
  type: ProgramOrFolder['type'];
  sourceType: MediaSourceSettings['type'];
  externalId: string;
  mediaSourceId: string;
  uuid: string;
};

export const useThumbnailUrl = () => {
  const settings = useSettings();
  return useCallback(
    (item: MinDetails) => {
      if (item.type === 'folder' || item.type === 'playlist') {
        return '';
      }

      if (item.sourceType === 'local') {
        // HACK
        return `${
          settings.backendUri
        }/api/programs/${item.uuid}/artwork/${item.type === 'episode' ? 'thumbnail' : 'poster'}`;
      }
      const idToUse = item.externalId;

      if (!idToUse) {
        return null;
      }

      const query = new URLSearchParams({
        mode: 'proxy',
        asset: 'image',
        id: createExternalId(item.sourceType, tag(item.mediaSourceId), idToUse),
        // Commenting this out for now as temporary solution for image loading issue
        // thumbOptions: JSON.stringify({ width: 480, height: 720 }),
        cache: import.meta.env.PROD ? 'true' : 'false',
      });

      return `${settings.backendUri}/api/metadata/external?${query.toString()}`;
    },
    [settings.backendUri],
  );
};
