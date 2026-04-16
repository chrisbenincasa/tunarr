import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import type { ScanContext } from './MediaSourceScanner.ts';

export class PlexScanUtil {
  private constructor() {}

  static async getSubtitles(
    context: ScanContext<PlexApiClient>,
    key: string,
  ): Promise<QueryResult<string>> {
    return context.apiClient.getSubtitles(key);
  }
}
