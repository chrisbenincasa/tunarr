import { head, round } from 'lodash-es';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { HasMediaSourceInfo, OtherVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { wait } from '../../util/index.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceScanner } from './MediaSourceScanner.ts';

export type GenericMediaSourceOtherVideoLibraryScanner<
  MovieT extends OtherVideo = OtherVideo,
> = MediaSourceOtherVideoScanner<
  RemoteMediaSourceType,
  MediaSourceApiClient,
  MovieT
>;

export abstract class MediaSourceOtherVideoScanner<
  MediaSourceTypeT extends RemoteMediaSourceType,
  ApiClientTypeT extends MediaSourceApiClient,
  OtherVideoTypeT extends OtherVideo,
> extends MediaSourceScanner<'other_videos', MediaSourceTypeT, ApiClientTypeT> {
  constructor(
    logger: Logger,
    mediaSourceDB: MediaSourceDB,
    protected programDB: IProgramDB,
    private searchService: MeilisearchService,
    private mediaSourceProgressService: MediaSourceProgressService,
    protected programMinter: ProgramDaoMinter,
  ) {
    super(logger, mediaSourceDB);
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { library, mediaSource, force } = context;

    const existingPrograms =
      await this.programDB.getProgramCanonicalIdsForMediaSource(
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

        const canonicalId = video.canonicalId;
        const externalKey = this.getExternalKey(video);

        seenVideos.add(externalKey);

        const processedAmount = round(seenVideos.size / totalSize, 2) * 100.0;

        this.mediaSourceProgressService.scanProgress(
          library.uuid,
          processedAmount,
        );

        if (
          !force &&
          existingPrograms[externalKey] &&
          existingPrograms[externalKey].canonicalId === canonicalId
        ) {
          this.logger.debug(
            'Found an unchanged program: rating key = %s, program ID = %s',
            externalKey,
            existingPrograms[externalKey].uuid,
          );
          continue;
        }

        const result = await this.scanVideo(context, video).then((result) =>
          result.flatMapAsync((fullVideo) => {
            return Result.attemptAsync(async () => {
              const minted = this.programMinter.mintOtherVideo(
                mediaSource,
                library,
                fullVideo,
              );

              const upsertResult = await this.programDB.upsertPrograms([
                minted,
              ]);

              return [fullVideo, upsertResult] as const;
            });
          }),
        );

        if (result.isFailure()) {
          this.logger.warn(
            result.error,
            'Error while processing video (%O)',
            video,
          );

          continue;
        }

        const [fullApiVideo, upsertedDbVideos] = result.get();
        const dbVideo = head(upsertedDbVideos);
        if (dbVideo) {
          this.logger.debug(
            'Upserted video %s (ID = %s)',
            dbVideo?.title,
            dbVideo?.uuid,
          );

          await this.searchService.indexOtherVideo([
            {
              ...fullApiVideo,
              uuid: dbVideo.uuid,
              mediaSourceId: mediaSource.uuid,
              libraryId: library.uuid,
            },
          ]);
        } else {
          this.logger.warn('No upserted video');
        }

        await wait();
      }

      this.logger.debug('Completed scanning library %s', context.library.uuid);
    } finally {
      this.mediaSourceProgressService.scanEnded(context.library.uuid);
    }
  }

  protected abstract getVideos(
    libraryId: string,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<OtherVideoTypeT>;

  protected abstract scanVideo(
    context: ScanContext<ApiClientTypeT>,
    incomingVideo: OtherVideoTypeT,
  ): Promise<Result<OtherVideoTypeT & HasMediaSourceInfo>>;

  protected abstract getExternalKey(video: OtherVideoTypeT): string;
}
