import { ExternalId, MultiExternalId, SingleExternalId } from '@tunarr/types';
import { PlexMedia } from '@tunarr/types/plex';
import {
  SingleExternalIdType,
  type ExternalIdType,
} from '@tunarr/types/schemas';
export { ProgramMinter } from './services/ProgramMinter.js';
export { scheduleRandomSlots } from './services/RandomSlotsService.js';
export { scheduleTimeSlots } from './services/TimeSlotService.js';
export { mod as dayjsMod } from './util/dayjsExtensions.js';

// TODO replace first arg with shared type
export function createExternalId(
  sourceType: ExternalIdType, //StrictExclude<ExternalIdType, SingleExternalIdType>,
  sourceId: string,
  itemId: string,
): `${string}|${string}|${string}` {
  return `${sourceType}|${sourceId}|${itemId}`;
}

export function createGlobalExternalIdString(
  sourceType: SingleExternalIdType,
  id: string,
): `${string}|${string}` {
  return `${sourceType}|${id}`;
}

export function createExternalIdFromMulti(multi: MultiExternalId) {
  return createExternalId(multi.source, multi.sourceId, multi.id);
}

export function createExternalIdFromGlobal(global: SingleExternalId) {
  return createGlobalExternalIdString(global.source, global.id);
}

// We could type this better if we reuse the other ExternalId
// types in createExternalId
export function containsMultiExternalId(
  ids: ExternalId[],
  targetId: `${string}|${string}|${string}`,
) {
  for (const id of ids) {
    if (id.type === 'single') {
      continue;
    }
    if (createExternalId(id.source, id.sourceId, id.id) === targetId) {
      return id;
    }
  }
  return null;
}

export function createExternalPlexMediaId(
  serverName: string,
  m: PlexMedia,
): MultiExternalId {
  return {
    type: 'multi',
    source: 'plex',
    sourceId: serverName,
    id: m.ratingKey,
  };
}
