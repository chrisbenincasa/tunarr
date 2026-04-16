import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import type { GetSubtitlesRequest, ScanContext } from './MediaSourceScanner.ts';

export class JellyfinScanUtil {
  private constructor() {}

  static async getSubtitles(
    context: ScanContext<JellyfinApiClient>,
    req: GetSubtitlesRequest,
  ): Promise<QueryResult<string>> {
    return context.apiClient.getSubtitles(
      req.externalItemId,
      req.externalMediaItemId ?? req.externalItemId,
      req.streamIndex,
      req.extension,
    );
  }
}
