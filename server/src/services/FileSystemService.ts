import { inject, injectable } from 'inversify';
import fs from 'node:fs/promises';
import path from 'path';
import type { GlobalOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import {
  CacheFolderName,
  ChannelLineupsFolderName,
  SearchSnapshotsFolderName,
  SubtitlesCacheFolderName,
} from '../util/constants.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';

@injectable()
export class FileSystemService {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.GlobalOptions) private globalOptions: GlobalOptions,
  ) {}

  getSubtitleCacheFolder() {
    return path.join(
      this.globalOptions.databaseDirectory,
      CacheFolderName,
      SubtitlesCacheFolderName,
    );
  }

  /**
   * Deletes the given files if they live inside the subtitle cache. Paths
   * outside it are skipped, because a sidecar path can point at a user's real
   * subtitle file on storage Tunarr shares with the media source.
   */
  async removeSubtitleCacheFiles(filePaths: string[]): Promise<void> {
    const cacheFolder = path.resolve(this.getSubtitleCacheFolder());

    for (const filePath of filePaths) {
      const resolved = path.resolve(filePath);
      const relative = path.relative(cacheFolder, resolved);
      if (
        relative === '' ||
        relative.startsWith('..') ||
        path.isAbsolute(relative)
      ) {
        continue;
      }

      try {
        await fs.rm(resolved, { force: true });
      } catch (e) {
        this.logger.warn(e, 'Unable to remove cached subtitle %s', resolved);
      }
    }
  }

  get backupPath(): string {
    return path.join(this.globalOptions.databaseDirectory, 'backups');
  }

  getChannelLineupPath(channelId: string): string {
    return path.join(
      this.globalOptions.databaseDirectory,
      ChannelLineupsFolderName,
      `${channelId}.json`,
    );
  }

  getMsSnapshotsPath() {
    return path.join(
      this.globalOptions.databaseDirectory,
      SearchSnapshotsFolderName,
    );
  }
}
