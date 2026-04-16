import type { MediaSourceLibrary } from '@/db/schema/MediaSourceLibrary.js';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash-es';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type {
  MediaSourceWithRelations,
  NewProgramWithRelations,
} from '../../db/schema/derivedTypes.js';
import type {
  MediaLibraryType,
  MediaSourceOrm,
  RemoteMediaSourceType,
} from '../../db/schema/MediaSource.ts';
import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { devAssert } from '../../util/debug.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';

export type ScanRequest = {
  library: MediaSourceLibrary;
  force?: boolean;
  pathFilter?: string;
};

export type ScanContext<ApiClientTypeT> = {
  library: MediaSourceLibrary;
  mediaSource: MediaSourceOrm;
  apiClient: ApiClientTypeT;
  force: boolean;
  pathFilter?: string;
};

export type RunState =
  | 'unknown'
  | 'starting'
  | 'running'
  | 'canceled'
  | 'stopped';

export type GenericMediaSourceScanner = MediaSourceScanner<
  MediaLibraryType,
  RemoteMediaSourceType,
  unknown
>;

export type GenericMediaSourceScannerFactory = (
  sourceType: RemoteMediaSourceType,
  libraryType: MediaLibraryType,
) => GenericMediaSourceScanner;

export type GetSubtitlesRequest = {
  key: string;
  extension: string;
  externalItemId: string;
  externalMediaItemId?: string;
  streamIndex: number; // Only relevant for Jellyfin
};

export abstract class BaseMediaSourceScanner<ApiClientTypeT, ScanRequestT> {
  abstract scan(req: ScanRequestT): Promise<void>;

  protected abstract getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<ApiClientTypeT>;
}

export abstract class MediaSourceScanner<
  MediaLibraryTypeT extends MediaLibraryType,
  MediaSourceTypeT extends RemoteMediaSourceType,
  ApiClientTypeT,
> extends BaseMediaSourceScanner<ApiClientTypeT, ScanRequest> {
  #state: Map<string, RunState> = new Map();
  abstract readonly type: MediaLibraryTypeT;
  abstract readonly mediaSourceType: MediaSourceTypeT;

  constructor(
    protected logger: Logger,
    protected mediaSourceDB: MediaSourceDB,
    protected externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super();
  }

  async scan({ library, force, pathFilter }: ScanRequest) {
    this.#state.set(library.uuid, 'starting');

    this.#state.set(library.uuid, 'running');

    try {
      if (this.state(library.uuid) === 'canceled') {
        return;
      }

      const mediaSource = await this.mediaSourceDB.getById(
        library.mediaSourceId,
      );

      if (!mediaSource) {
        throw new Error(`Media source ${library.mediaSourceId} not found.`);
      }

      devAssert(mediaSource.type === this.mediaSourceType);

      this.logger.info(
        'Scanning %s library (ID = %s, name = %s, force = %s, filter = %s)',
        mediaSource.type,
        library.uuid,
        library.name,
        force,
        pathFilter,
      );

      await this.scanInternal({
        library,
        mediaSource,
        force: force ?? false,
        apiClient: await this.getApiClient(mediaSource),
        pathFilter,
      });

      await this.mediaSourceDB.setLibraryLastScannedTime(library.uuid, dayjs());
    } finally {
      this.#state.delete(library.uuid);
    }
  }

  cancel(libraryId: string) {
    this.logger.info('Request to cancel scan for library %s', libraryId);
    this.#state.set(libraryId, 'canceled');
  }

  protected state(libraryId: string) {
    return this.#state.get(libraryId) ?? 'unknown';
  }

  protected abstract scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void>;

  protected abstract getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<ApiClientTypeT>;

  protected abstract getLibrarySize(
    libraryKey: string,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<number>;

  protected abstract getSubtitles(
    context: ScanContext<ApiClientTypeT>,
    request: GetSubtitlesRequest,
  ): Promise<QueryResult<string>>;

  protected async downloadExternalSubtitleStreams(
    { program, subtitles }: NewProgramWithRelations,
    getSubtitlesCallback: (
      args: GetSubtitlesRequest,
    ) => Promise<QueryResult<string>>,
  ) {
    const externalSubtitleStreams =
      subtitles.filter((stream) => stream.subtitleType === 'sidecar') ?? [];

    for (const stream of externalSubtitleStreams) {
      if (isEmpty(stream.path)) {
        continue;
      }

      const fullPath =
        await this.externalSubtitleDownloader.downloadSubtitlesIfNecessary(
          {
            externalKey: program.externalKey,
            externalSourceId: program.mediaSourceId,
            sourceType: program.sourceType,
            uuid: program.uuid,
          },
          { streamIndex: stream.streamIndex ?? undefined, codec: stream.codec },
          (args) =>
            getSubtitlesCallback({
              ...args,
              key: stream.path!,
              externalItemId: program.externalKey,
              streamIndex: stream.streamIndex ?? 0,
            }),
        );

      if (fullPath) {
        stream.path = fullPath;
        // return details;
      }

      this.logger.warn(
        'Skipping external subtitles at index %d because download failed. Please check logs and file an issue for assistance.',
        stream.streamIndex ?? -1,
      );

      return;
    }
  }
}
