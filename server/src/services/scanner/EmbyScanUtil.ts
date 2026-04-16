import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import type { GetSubtitlesRequest, ScanContext } from './MediaSourceScanner.ts';

export class EmbyScanUtil {
  private constructor() {}

  static async getSubtitles(
    context: ScanContext<EmbyApiClient>,
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
