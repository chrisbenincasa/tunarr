import { differenceWith, head, round, values } from 'lodash-es';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
} from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import type { HasMediaSourceInfo, OtherVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { Maybe } from '../../types/util.ts';
import { devAssert } from '../../util/debug.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext, ScanSingleRequest } from './MediaSourceScanner.ts';
import { MediaSourceScanner } from './MediaSourceScanner.ts';

export type GenericMediaSourceOtherVideoLibraryScanner<
  VideoT extends OtherVideo = OtherVideo,
> = MediaSourceOtherVideoScanner<
  RemoteMediaSourceType,
  MediaSourceApiClient,
  VideoT
>;

export abstract class MediaSourceOtherVideoScanner<
  MediaSourceTypeT extends RemoteMediaSourceType,
  ApiClientTypeT extends MediaSourceApiClient,
  OtherVideoTypeT extends OtherVideo,
> extends MediaSourceScanner<'other_videos', MediaSourceTypeT, ApiClientTypeT> {
  constructor(
    mediaSourceDB: MediaSourceDB,
    protected programDB: IProgramDB,
    private searchService: MeilisearchService,
    private mediaSourceProgressService: MediaSourceProgressService,
    protected programMinter: ProgramDaoMinter,
    protected externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super(mediaSourceDB, externalSubtitleDownloader);
  }

  async scanSingle({
    library,
    force,
    externalId,
  }: ScanSingleRequest): Promise<Result<void>> {
    const mediaSource = await this.mediaSourceDB.getById(library.mediaSourceId);

    if (!mediaSource) {
      throw new Error(`Media source ${library.mediaSourceId} not found.`);
    }

    devAssert(mediaSource.type === this.mediaSourceType);

    this.logger.info(
      'Scanning %s library for single item (ID = %s, name = %s, item = %s, force = %s)',
      mediaSource.type,
      library.uuid,
      library.name,
      externalId,
      force,
    );

    const client = await this.getApiClient(mediaSource);
    const ctx = {
      library,
      mediaSource,
      force: force ?? false,
      apiClient: client,
      scannedEntities: 0,
      totalEntities: 0,
    } satisfies ScanContext<ApiClientTypeT>;

    const apiVideo = await this.scanVideoById(ctx, externalId);

    if (apiVideo.isFailure()) {
      return apiVideo.recast();
    }

    const existingVideo = await this.programDB.lookupByExternalId({
      sourceType: this.mediaSourceType,
      externalSourceId: mediaSource.uuid,
      externalKey: externalId,
    });

    return Result.attemptAsync(() =>
      this.scanSingleInternal(ctx, apiVideo.get(), existingVideo),
    );
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { library } = context;

    const existingPrograms =
      await this.programDB.getProgramInfoForMediaSourceLibrary(
        library.uuid,
        ProgramType.OtherVideo,
      );

    const seenVideos = new Set<string>();

    try {
      const totalSize = await this.getLibrarySize(library.externalKey, context);

      for await (const video of this.getVideos(library.externalKey, context)) {
        if (this.state(library.uuid) === 'canceled') {
          return;
        }

        const externalKey = video.externalId;

        seenVideos.add(externalKey);

        await this.scanSingleInternal(
          context,
          video,
          existingPrograms[externalKey],
        );

        const processedAmount = round(seenVideos.size / totalSize, 2) * 100.0;

        this.mediaSourceProgressService.scanProgress(
          library.uuid,
          processedAmount,
        );
      }

      const missingVideos = differenceWith(
        values(existingPrograms),
        [...seenVideos.values()],
        (existing, seen) => existing.externalKey === seen,
      );

      await this.programDB.updateProgramsState(
        missingVideos.map((ep) => ep.uuid),
        'missing',
      );
      await this.searchService.updatePrograms(
        missingVideos.map((ep) => ({
          id: ep.uuid,
          state: 'missing',
        })),
      );

      this.logger.debug('Completed scanning library %s', context.library.uuid);
    } finally {
      this.mediaSourceProgressService.scanEnded(context.library.uuid);
    }
  }

  protected async scanSingleInternal(
    context: ScanContext<ApiClientTypeT>,
    video: OtherVideoTypeT,
    existingVideo: Maybe<ProgramCanonicalIdLookupResult>,
  ) {
    const { force, library, mediaSource } = context;
    const fullMetadataResult = await this.scanVideo(context, video);

    if (fullMetadataResult.isFailure()) {
      this.logger.warn(
        fullMetadataResult.error,
        'Failed to request full metadata for video %s',
        video.externalId,
      );
      return;
    }

    const fullMetadata = fullMetadataResult.get();

    if (
      !force &&
      existingVideo &&
      existingVideo.canonicalId &&
      existingVideo.canonicalId === fullMetadata.canonicalId
    ) {
      this.logger.debug(
        'Found an unchanged program: rating key = %s, program ID = %s',
        video.externalId,
        existingVideo.uuid,
      );
      return;
    }

    const minted = this.programMinter.mintOtherVideo(
      mediaSource,
      library,
      fullMetadata,
    );

    await this.downloadExternalSubtitleStreams(minted, (req) =>
      this.getSubtitles(context, {
        ...req,
        externalMediaItemId: fullMetadata.mediaItem?.externalKey ?? undefined,
      }),
    );

    const upsertResult = await Result.attemptAsync(() =>
      this.programDB.upsertPrograms([minted]),
    );

    if (upsertResult.isFailure()) {
      this.logger.warn(
        upsertResult.error,
        'Error while processing video (%O)',
        video,
      );

      return;
    }

    const dbVideo = head(upsertResult.get());
    if (dbVideo) {
      this.logger.debug(
        'Upserted video %s (ID = %s)',
        dbVideo?.title,
        dbVideo?.uuid,
      );

      await this.searchService.indexOtherVideo([
        {
          ...fullMetadata,
          uuid: dbVideo.uuid,
          mediaSourceId: mediaSource.uuid,
          libraryId: library.uuid,
        },
      ]);
    } else {
      this.logger.warn('No upserted video');
    }
  }

  protected abstract getVideos(
    libraryId: string,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<OtherVideoTypeT>;

  protected scanVideo(
    context: ScanContext<ApiClientTypeT>,
    incomingVideo: OtherVideoTypeT,
  ): Promise<Result<OtherVideoTypeT & HasMediaSourceInfo>> {
    return this.scanVideoById(context, incomingVideo.externalId);
  }

  protected abstract scanVideoById(
    context: ScanContext<ApiClientTypeT>,
    externalKey: string,
  ): Promise<Result<OtherVideoTypeT & HasMediaSourceInfo>>;
}
