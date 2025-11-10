import type { MediaSourceLibraryOrm } from '@/db/schema/MediaSourceLibrary.js';
import dayjs from 'dayjs';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import type {
  MediaLibraryType,
  MediaSourceOrm,
  RemoteMediaSourceType,
} from '../../db/schema/MediaSource.ts';
import { devAssert } from '../../util/debug.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';

export type ScanRequest = {
  library: MediaSourceLibraryOrm;
  force?: boolean;
  pathFilter?: string;
};

export type ScanContext<ApiClientTypeT> = {
  library: MediaSourceLibraryOrm;
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

export abstract class MediaSourceScanner<
  MediaLibraryTypeT extends MediaLibraryType,
  MediaSourceTypeT extends RemoteMediaSourceType,
  ApiClientTypeT,
> {
  #state: Map<string, RunState> = new Map();
  abstract readonly type: MediaLibraryTypeT;
  abstract readonly mediaSourceType: MediaSourceTypeT;

  constructor(
    protected logger: Logger,
    protected mediaSourceDB: MediaSourceDB,
  ) {}

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
}
