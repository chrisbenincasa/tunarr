import { MultiExternalId } from '@tunarr/types';
import { isError, trimEnd, trimStart } from 'lodash-es';
import { ProgramExternalId } from '../dao/entities/ProgramExternalId.js';
import { attemptSync } from './index.js';
import { Try } from '../types/util.js';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { programExternalIdTypeFromExternalIdType } from '../dao/custom_types/ProgramExternalIdType.js';

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

/**
 * Parses a Plex Guid from a Media item and returns a partially filled {@link ProgramExternalId}
 * @param guid
 * @returns
 */
export const parsePlexExternalGuid = (guid: string): Try<ProgramExternalId> => {
  console.debug('parsing guid %s', guid);
  const parsed = attemptSync(() => new URL(guid));
  if (!isError(parsed)) {
    const idType = trimEnd(parsed.protocol, ':');
    if (isValidSingleExternalIdType(idType)) {
      const eid = new ProgramExternalId();
      eid.sourceType = programExternalIdTypeFromExternalIdType(idType);
      eid.externalKey = parsed.hostname;
      return eid;
    }
    return new Error(`Parsed ID type is invalid: ${idType}`);
  } else {
    return parsed;
  }
};
