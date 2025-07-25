import type { ExternalId } from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { trimEnd } from 'lodash-es';

export const parsePlexGuid = (guid: string): ExternalId | null => {
  if (!URL.canParse(guid)) {
    return null;
  }

  const parsed = new URL(guid);
  const idType = trimEnd(parsed.protocol, ':');
  if (!isValidSingleExternalIdType(idType)) {
    return null;
  }

  return {
    type: 'single',
    source: idType,
    id: parsed.hostname,
  };
};
