import type { MediaSourceLibrary } from '@/db/schema/MediaSourceLibrary.js';
import { InjectLogger } from '@/util/inject.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type {
  MediaSourceWithRelations,
  NewProgramWithRelations,
} from '../../db/schema/derivedTypes.js';
import type {
  MediaLibraryType,
  RemoteMediaSourceType,
} from '../../db/schema/MediaSource.ts';
import type { MediaSourceLibraryReplacePath } from '../../db/schema/MediaSourceLibraryReplacePath.ts';
import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { PathCalculator } from '../../stream/PathCalculator.ts';
import { Result } from '../../types/result.ts';
import { devAssert } from '../../util/debug.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';

export type ScanRequest = {
  library: MediaSourceLibrary;
  force?: boolean;
  pathFilter?: string;
};

export type ScanSingleRequest = {
  library: MediaSourceLibrary;
  externalId: string;
  force?: boolean;
};

export type ScanContext<ApiClientTypeT> = {
  library: MediaSourceLibrary;
  mediaSource: MediaSourceWithRelations;
  apiClient: ApiClientTypeT;
  force: boolean;
  pathFilter?: string;

  // internal state
  scannedEntities: number;
  totalEntities: number;
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

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
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
        scannedEntities: 0,
        totalEntities: 0,
      });

      await this.mediaSourceDB.setLibraryLastScannedTime(library.uuid, dayjs());
    } finally {
      this.#state.delete(library.uuid);
    }
  }

  abstract scanSingle(req: ScanSingleRequest): Promise<Result<void>>;

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
    replacePaths: MediaSourceLibraryReplacePath[],
    getSubtitlesCallback: (
      args: GetSubtitlesRequest,
    ) => Promise<QueryResult<string>>,
  ) {
    const externalSubtitleStreams =
      subtitles.filter((stream) => stream.subtitleType === 'sidecar') ?? [];

    for (const stream of externalSubtitleStreams) {
      if (isNonEmptyString(stream.path)) {
        continue;
      }

      // If Tunarr can see the same storage the media source is reading from,
      // the sidecar is just a file: no download, and no HTTP at playback time.
      const localPath = await PathCalculator.findLocalPath(
        stream.sourcePath,
        replacePaths,
      );
      if (localPath) {
        this.logger.debug(
          'Found external subtitle on local storage, skipping download. Source path: %s Local path: %s',
          stream.sourcePath ?? '',
          localPath,
        );
        stream.path = localPath;
        continue;
      }

      const subtitleKey = stream.sourceKey;
      if (!isNonEmptyString(subtitleKey)) {
        continue;
      }

      const fullPathResult = await Result.attemptAsync(() =>
        this.externalSubtitleDownloader.downloadSubtitlesIfNecessary(
          {
            externalKey: program.externalKey,
            externalSourceId: program.mediaSourceId,
            sourceType: program.sourceType,
            uuid: program.uuid,
          },
          {
            streamIndex: stream.streamIndex ?? undefined,
            codec: stream.codec,
            // External subtitles have no stream index, so the source-relative
            // location is what keeps their cache entries distinct.
            key: subtitleKey,
          },
          (args) =>
            getSubtitlesCallback({
              ...args,
              key: subtitleKey,
              externalItemId: program.externalKey,
              streamIndex: stream.streamIndex ?? 0,
            }),
        ),
      );

      if (fullPathResult.isFailure()) {
        this.logger.warn(
          fullPathResult.error,
          'Error while locating / downloading external subtitles for item: %j',
          program,
        );
        continue;
      }

      const fullPath = fullPathResult.get();

      if (isNonEmptyString(fullPath)) {
        this.logger.debug(
          'Downloaded external subtitle to local cache: source = %s, local cache = %s',
          subtitleKey,
          fullPath,
        );
        stream.path = fullPath;
      }
    }
  }
}
