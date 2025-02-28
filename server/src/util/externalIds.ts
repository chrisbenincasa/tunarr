import { programExternalIdTypeFromExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { NewSingleOrMultiExternalId } from '@/db/schema/ProgramExternalId.js';
import type { Nullable } from '@/types/util.js';
import type { MultiExternalId } from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isError, trimEnd, trimStart } from 'lodash-es';
import { v4 } from 'uuid';
import { attemptSync } from './index.js';
import { LoggerFactory } from './logging/LoggerFactory.ts';

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
  programId: string,
): Nullable<NewSingleOrMultiExternalId> => {
  const parsed = parsePlexGuid(guid);
  if (parsed) {
    return {
      type: 'single',
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      sourceType: parsed.sourceType,
      externalKey: parsed.externalKey,
      programUuid: programId,
    };
  }

  return null;
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
