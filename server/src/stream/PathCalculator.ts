import { replace } from 'lodash-es';
import type { MediaSourceLibraryReplacePath } from '../db/schema/MediaSourceLibraryReplacePath.ts';
import { fileExists } from '../util/fsUtil.ts';

export class PathCalculator {
  static async findFirstValidPath(
    inPath: string,
    replacements: MediaSourceLibraryReplacePath[],
  ) {
    if (replacements.length === 0) {
      return;
    }

    for (const { localPath, serverPath } of replacements) {
      const replaced = replace(inPath, serverPath, localPath);
      if (await fileExists(replaced)) {
        return replaced;
      }
    }

    return;
  }

  private constructor() {}
}
