import { MultiExternalId } from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { isError, trimEnd, trimStart } from 'lodash-es';
import { programExternalIdTypeFromExternalIdType } from '../dao/custom_types/ProgramExternalIdType.js';
import { ProgramExternalId } from '../dao/entities/ProgramExternalId.js';
import { Try } from '../types/util.js';
import { attemptSync } from './index.js';

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
export const mintExternalIdForPlexGuid = (
  guid: string,
): Try<ProgramExternalId> => {
  const parsed = parsePlexGuid(guid);
  if (!isError(parsed)) {
    const eid = new ProgramExternalId();
    eid.sourceType = parsed.sourceType;
    eid.externalKey = parsed.externalKey;
    return eid;
  } else {
    return parsed;
  }
};

export const parsePlexGuid = (guid: string) => {
  const parsed = attemptSync(() => new URL(guid));
  if (!isError(parsed)) {
    const idType = trimEnd(parsed.protocol, ':');
    if (isValidSingleExternalIdType(idType)) {
      return {
        sourceType: programExternalIdTypeFromExternalIdType(idType),
        externalKey: parsed.hostname,
      };
    }

    return new Error(`Parsed ID type is invalid: ${idType}`);
  }
  {
    return parsed;
  }
};
