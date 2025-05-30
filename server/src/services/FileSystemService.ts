import { inject, injectable } from 'inversify';
import path from 'path';
import { GlobalOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import {
  CacheFolderName,
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
}
