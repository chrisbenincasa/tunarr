import { inject, injectable } from 'inversify';
import path from 'path';
import { GlobalOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import {
  CacheFolderName,
  ChannelLineupsFolderName,
  SearchSnapshotsFolderName,
  SubtitlesCacheFolderName,
} from '../util/constants.ts';

@injectable()
export class FileSystemService {
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
