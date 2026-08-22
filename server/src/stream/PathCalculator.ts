import { replace } from 'lodash-es';
import type { MediaSourceLibraryReplacePath } from '../db/schema/MediaSourceLibraryReplacePath.ts';
import type { Maybe, Nilable } from '../types/util.ts';
import { fileExists } from '../util/fsUtil.ts';
import { isNonEmptyString } from '../util/index.ts';

export class PathCalculator {
  /**
   * Resolves a path reported by a media source into one Tunarr can open,
   * trying the path as-is before falling back to the source's replacements.
   * Returns undefined when Tunarr cannot see the file either way.
   */
  static async findLocalPath(
    inPath: Nilable<string>,
    replacements: MediaSourceLibraryReplacePath[],
  ): Promise<Maybe<string>> {
    if (!isNonEmptyString(inPath)) {
      return undefined;
    }

    if (await fileExists(inPath)) {
      return inPath;
    }

    return await PathCalculator.findFirstValidPath(inPath, replacements);
  }

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
