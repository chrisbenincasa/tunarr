import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { isNonEmptyString } from '../../util/index.ts';
import type { GetSubtitlesRequest, ScanContext } from './MediaSourceScanner.ts';

export class JellyfinScanUtil {
  private constructor() {}

  static async getSubtitles(
    context: ScanContext<JellyfinApiClient>,
    req: GetSubtitlesRequest,
  ): Promise<QueryResult<string>> {
    // External subtitles are separate files and are fetched from the location
    // the server reported for them. Their container stream index is meaningless
    // -- falling back to it would download some other stream entirely.
    if (isNonEmptyString(req.key)) {
      return context.apiClient.getSubtitlesByPath(req.key);
    }

    return context.apiClient.getSubtitles(
      req.externalItemId,
      req.externalMediaItemId ?? req.externalItemId,
      req.streamIndex,
      req.extension,
    );
  }
}
