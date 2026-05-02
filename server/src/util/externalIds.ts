import { programExternalIdTypeFromExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { isError, trimEnd } from 'lodash-es';
import { attemptSync } from './index.js';
import { LoggerFactory } from './logging/LoggerFactory.ts';

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

    LoggerFactory.root.debug(
      'Parsed Plex GUID ID type is unrecognized: %s',
      idType,
    );
    return null;
  } else {
    LoggerFactory.root.warn(parsed, 'Error while parsing Plex GUID');
    return null;
  }
};
