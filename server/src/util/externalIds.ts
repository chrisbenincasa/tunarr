import { MultiExternalId } from '@tunarr/types';
import { trimStart } from 'lodash-es';

export const createPlexExternalId = (
  serverName: string,
  ratingKey: string,
): MultiExternalId => {
  return {
    type: 'multi',
    source: 'plex',
    sourceId: serverName,
    id: trimStart(ratingKey, '/library/metadata'),
  };
};
