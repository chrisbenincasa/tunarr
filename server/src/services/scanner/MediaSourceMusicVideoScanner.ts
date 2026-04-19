import type { MusicVideo } from '@tunarr/types';
import { differenceWith, head, round, values } from 'lodash-es';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import type { HasMediaSourceInfo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceScanner } from './MediaSourceScanner.ts';

export type GenericMediaSourceMusicVideoLibraryScanner<
  VideoT extends MusicVideo = MusicVideo,
> = MediaSourceMusicVideoScanner<
  RemoteMediaSourceType,
  MediaSourceApiClient,
  VideoT
>;

export abstract class MediaSourceMusicVideoScanner<
  MediaSourceTypeT extends RemoteMediaSourceType,
  ApiClientTypeT extends MediaSourceApiClient,
  MusicVideoTypeT extends MusicVideo,
> extends MediaSourceScanner<'music_videos', MediaSourceTypeT, ApiClientTypeT> {
  constructor(
    logger: Logger,
    mediaSourceDB: MediaSourceDB,
    protected programDB: IProgramDB,
    private searchService: MeilisearchService,
    private mediaSourceProgressService: MediaSourceProgressService,
    protected programMinter: ProgramDaoMinter,
    externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super(logger, mediaSourceDB, externalSubtitleDownloader);
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { library, mediaSource, force } = context;

    const existingPrograms =
      await this.programDB.getProgramInfoForMediaSourceLibrary(
        library.uuid,
        ProgramType.MusicVideo,
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

        const fullMetadataResult = await this.scanVideo(context, video);

        if (fullMetadataResult.isFailure()) {
          this.logger.warn(
            fullMetadataResult.error,
            'Failed to request full metadata for video %s',
            video.externalId,
          );
          continue;
        }

        const fullMetadata = fullMetadataResult.get();

        const processedAmount = round(seenVideos.size / totalSize, 2) * 100.0;

        this.mediaSourceProgressService.scanProgress(
          library.uuid,
          processedAmount,
        );

        const existingVideo = existingPrograms[externalKey];
        if (
          !force &&
          existingVideo &&
          existingVideo.canonicalId &&
          existingVideo.canonicalId === fullMetadata.canonicalId
        ) {
          this.logger.debug(
            'Found an unchanged program: rating key = %s, program ID = %s',
            externalKey,
            existingVideo.uuid,
          );
          continue;
        }

        const minted = this.programMinter.mintMusicVideo(
          mediaSource,
          library,
          fullMetadata,
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

          continue;
        }

        const dbVideo = head(upsertResult.get());
        if (dbVideo) {
          this.logger.debug(
            'Upserted video %s (ID = %s)',
            dbVideo?.title,
            dbVideo?.uuid,
          );

          await this.searchService.indexMusicVideo([
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

  protected abstract getVideos(
    libraryId: string,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<MusicVideoTypeT>;

  protected abstract scanVideo(
    context: ScanContext<ApiClientTypeT>,
    incomingVideo: MusicVideoTypeT,
  ): Promise<Result<MusicVideoTypeT & HasMediaSourceInfo>>;
}
