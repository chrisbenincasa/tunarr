import type { Tag } from '@tunarr/types';
import {
  tag,
  type ExternalId,
  type MultiExternalId,
  type SingleExternalId,
} from '@tunarr/types';
import {
  type ExternalIdType,
  type SingleExternalIdType,
} from '@tunarr/types/schemas';
export { ApiProgramMinter } from './services/ApiProgramMinter.js';
export { mod as dayjsMod } from './util/dayjsExtensions.js';

export type MediaSourceId = Tag<string, 'mediaSourceId'>;

// TODO replace first arg with shared type
export function createExternalId(
  sourceType: ExternalIdType, //StrictExclude<ExternalIdType, SingleExternalIdType>,
  sourceId: MediaSourceId,
  itemId: string,
): `${string}|${MediaSourceId}|${string}` {
  return `${sourceType}|${sourceId}|${itemId}`;
}

export function createGlobalExternalIdString(
  sourceType: SingleExternalIdType,
  id: string,
): `${string}|${string}` {
  return `${sourceType}|${id}`;
}

export function createExternalIdFromMulti(multi: MultiExternalId) {
  return createExternalId(multi.source, tag(multi.sourceId), multi.id);
}

export function createExternalIdFromGlobal(global: SingleExternalId) {
  return createGlobalExternalIdString(global.source, global.id);
}

// We could type this better if we reuse the other ExternalId
// types in createExternalId
export function containsMultiExternalId(
  ids: ExternalId[],
  targetId: `${string}|${MediaSourceId}|${string}`,
) {
  for (const id of ids) {
    if (id.type === 'single') {
      continue;
    }
    if (createExternalId(id.source, tag(id.sourceId), id.id) === targetId) {
      return id;
    }
  }
  return null;
}
