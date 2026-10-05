import type { Logger } from '../util/logging/LoggerFactory.ts';

/**
 * Derives the remote artwork URL for an item from its media source.
 *
 * Shared by `ArtworkService`, which derives on demand when an item has no
 * stored artwork row, and `BackfillProgramArtworkFixer`, which persists the
 * same paths ahead of time. The two must agree or a backfilled item would
 * resolve differently from one that has not been reached yet.
 */
export function buildArtworkSourcePath(
  mediaSourceUri: string,
  externalKey: string,
  sourceType: string,
  logger?: Logger,
): string | undefined {
  try {
    switch (sourceType) {
      case 'plex':
        return new URL(`/library/metadata/${externalKey}/thumb`, mediaSourceUri)
          .href;
      case 'jellyfin':
      case 'emby':
        return new URL(`/Items/${externalKey}/Images/Primary`, mediaSourceUri)
          .href;
      default:
        return undefined;
    }
  } catch {
    logger?.warn(
      'Failed to construct artwork URL for source type %s, key %s, uri %s',
      sourceType,
      externalKey,
      mediaSourceUri,
    );
    return undefined;
  }
}
