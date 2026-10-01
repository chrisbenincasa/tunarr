import { isNil } from 'lodash-es';
import type { MediaSourceLibrary } from '../db/schema/MediaSourceLibrary.ts';

/**
 * The paths a local media source is configured with. Removing a path keeps its
 * library row, flagged `unavailableSince`, so that the programs it held can
 * still be recovered from the trash - but the path is no longer part of the
 * source, so it should not be listed (or saved back) again.
 */
export function localSourcePaths(libraries: MediaSourceLibrary[]): string[] {
  return libraries
    .filter((library) => isNil(library.unavailableSince))
    .map((library) => library.externalKey);
}
