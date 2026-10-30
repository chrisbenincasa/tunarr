import { isNil } from 'lodash-es';
import type { MediaSourceLibrary } from '../db/schema/MediaSourceLibrary.ts';

/**
 * The libraries a media source is currently using. Removing a local path keeps
 * its library row, flagged `unavailableSince`, so that the programs and
 * groupings it held can still be recovered from the trash - but it is no longer
 * configured: scans skip it and it is not one of the source's paths any more.
 */
export function configuredLibraries(
  libraries: MediaSourceLibrary[],
): MediaSourceLibrary[] {
  return libraries.filter((library) => isNil(library.unavailableSince));
}

/**
 * The paths a local media source is configured with, in library order. A path
 * the user removed keeps its library row, so it has to be filtered out here or
 * it would reappear in the settings dialog and be saved back.
 */
export function localSourcePaths(libraries: MediaSourceLibrary[]): string[] {
  return configuredLibraries(libraries).map((library) => library.externalKey);
}
