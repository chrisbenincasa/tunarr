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

    // Apply all replacements sequentially, each building on the previous result.
    // This handles cases like Windows→Linux path conversion where you need
    // both a prefix swap (D:\media → /data) and separator conversion (\ → /).
    let sequentialResult = inPath;
    for (const { localPath, serverPath } of replacements) {
      sequentialResult = sequentialResult.replaceAll(serverPath, localPath);
    }

    if (sequentialResult !== inPath && (await fileExists(sequentialResult))) {
      return sequentialResult;
    }

    // Fall back to trying each replacement independently.
    for (const { localPath, serverPath } of replacements) {
      const replaced = inPath.replaceAll(serverPath, localPath);
      if (await fileExists(replaced)) {
        return replaced;
      }
    }

    return;
  }

  private constructor() {}
}
