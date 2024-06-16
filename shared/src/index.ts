import { ExternalId, SingleExternalId, MultiExternalId } from '@tunarr/types';
import { PlexMedia } from '@tunarr/types/plex';
import { type ExternalIdType } from '@tunarr/types/schemas';
export { scheduleRandomSlots } from './services/randomSlotsService.js';
export { scheduleTimeSlots } from './services/timeSlotService.js';
export { mod as dayjsMod } from './util/dayjsExtensions.js';

// TODO replace first arg with shared type
export function createExternalId(
  sourceType: ExternalIdType,
  sourceId: string,
  itemId: string,
): `${string}|${string}|${string}` {
  return `${sourceType}|${sourceId}|${itemId}`;
}

export function createExternalIdFromMulti(multi: MultiExternalId) {
  return createExternalId(multi.source, multi.sourceId, multi.id);
}

export function createExternalIdFromGlobal(global: SingleExternalId) {
  return createExternalId(global.source, '', global.id);
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
