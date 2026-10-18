import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { serverOptions } from '../../globals.ts';
import { EtvNextDossierFolderName } from '../../util/constants.ts';
import { redactMediaServerSecrets } from '../../util/redactSecrets.ts';

/**
 * How many dossiers a channel keeps.
 *
 * A channel that fails every item writes one per failure, so the directory is
 * unbounded without a cap. Five is enough to see whether a failure repeats and
 * small enough that the zip stays attachable to a bug report.
 */
export const DossierRetentionCount = 5;

export type Dossier = {
  /** The directory the worker wrote, `<channelNumber>_<timestamp>`. */
  name: string;
  capturedAt: Date;
  sizeBytes: number;
};

/** Where a channel's dossiers accumulate, across sessions. */
export function dossierDirectory(
  channelUuid: string,
  rootDirectory: string = path.join(
    serverOptions().databaseDirectory,
    EtvNextDossierFolderName,
  ),
): string {
  return path.join(rootDirectory, channelUuid);
}

/**
 * Lists a channel's dossiers, newest first.
 *
 * Ordered by write time rather than by name. The names carry a timestamp, but
 * nothing in the contract says it sorts.
 */
export async function listDossiers(directory: string): Promise<Dossier[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    // No directory means no failures yet, which is the common case.
    return [];
  }

  const dossiers = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const full = path.join(directory, entry.name);
        const stat = await fs.stat(full);
        return {
          name: entry.name,
          capturedAt: stat.mtime,
          sizeBytes: await directorySize(full),
        };
      }),
  );

  return dossiers.sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );
}

/**
 * Drops all but the newest `keep` dossiers.
 *
 * Run before a session spawns its worker rather than after each failure. The
 * worker writes these itself and tells Tunarr nothing, so there is no moment
 * to prune on, and the cap is about disk over time rather than during one
 * session.
 */
export async function pruneDossiers(
  directory: string,
  keep: number = DossierRetentionCount,
): Promise<void> {
  const dossiers = await listDossiers(directory);

  await Promise.all(
    dossiers.slice(keep).map((dossier) =>
      fs.rm(path.join(directory, dossier.name), {
        recursive: true,
        force: true,
      }),
    ),
  );
}

async function directorySize(directory: string): Promise<number> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return directorySize(full);
      }
      if (!entry.isFile()) {
        return 0;
      }
      return (await fs.stat(full)).size;
    }),
  );

  return sizes.reduce((total, size) => total + size, 0);
}

/** Lists every file in a dossier as a path relative to the dossier. */
export async function listDossierFiles(dossierPath: string): Promise<string[]> {
  const entries = await fs.readdir(dossierPath, {
    withFileTypes: true,
    recursive: true,
  });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(dossierPath, path.join(entry.parentPath, entry.name)),
    );
}

/**
 * Prepares one dossier file for the diagnostics zip.
 *
 * The ffmpeg report and the playout item quote HTTP source URLs and headers,
 * which carry media-server tokens, and users attach this zip to public bug
 * reports. Text is redacted. A file with a NUL byte is treated as binary and
 * passed through unchanged.
 */
export function redactDossierFile(content: Buffer): Buffer | string {
  if (content.includes(0)) {
    return content;
  }
  return redactMediaServerSecrets(content.toString('utf8'));
}
