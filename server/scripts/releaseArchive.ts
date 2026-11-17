import path from 'node:path';

export type ReleaseArchiveEntry = {
  source: string;
  name: string;
};

export type ReleaseArchiveFiles = {
  tunarr: string;
  meilisearch: string;
  etvNext: string;
  etvNextCompanions: string[];
};

/**
 * Places every file in one top-level folder named for the release. The folder
 * carries the version and the binaries inside do not, so a user's shortcut or
 * service path to `tunarr.exe` survives an upgrade.
 */
export function releaseArchiveEntries(
  folderName: string,
  isWindows: boolean,
  files: ReleaseArchiveFiles,
): ReleaseArchiveEntry[] {
  const exe = isWindows ? '.exe' : '';
  const inFolder = (name: string) => path.posix.join(folderName, name);

  return [
    { source: files.tunarr, name: inFolder(`tunarr${exe}`) },
    { source: files.meilisearch, name: inFolder(`meilisearch${exe}`) },
    { source: files.etvNext, name: inFolder(`ersatztv-channel${exe}`) },
    ...files.etvNextCompanions.map((source) => ({
      source,
      name: inFolder(path.basename(source)),
    })),
  ];
}
