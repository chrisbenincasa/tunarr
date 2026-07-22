import type { ExternalIdType } from '@tunarr/types/schemas';

export function extractPlexGuid(
  identifiers: readonly { type: ExternalIdType; id: string }[] | undefined,
): string | undefined {
  if (!identifiers) {
    return undefined;
  }
  const guid = identifiers.find((id) => id.type === 'plex-guid');
  return guid?.id?.trim() || undefined;
}

export function isSyntheticLocalPlexGuid(guid: string): boolean {
  return guid.startsWith('local://');
}
