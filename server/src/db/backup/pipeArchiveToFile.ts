import type { Archiver } from 'archiver';
import { createWriteStream } from 'node:fs';

/**
 * Pipes an archive to a file and resolves once the bytes are on disk.
 *
 * Two things this exists to get right. `archive.pipe(out)` does not forward the
 * destination's errors back to the archiver, so a failing write stream emits
 * 'error' with no listener and takes the process down instead of failing the
 * backup. And the archiver's own 'end' fires when its readable side drains, not
 * when the destination has flushed -- settling on that would report a backup as
 * written before it is.
 */
export function pipeArchiveToFile(
  archive: Archiver,
  destinationPath: string,
  onWarning?: (error: Error) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const outStream = createWriteStream(destinationPath);

    outStream.on('error', reject);
    outStream.on('close', () => resolve());
    archive.on('error', reject);
    // An entry archiver could not add (a missing directory, say) is a warning,
    // not an error: the archive still completes, just without that entry. The
    // caller needs to know the backup is short.
    archive.on('warning', (error) => onWarning?.(error));

    archive.pipe(outStream);
  });
}
