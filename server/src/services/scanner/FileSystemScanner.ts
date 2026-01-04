import type { MediaSourceLibraryOrm } from '@/db/schema/MediaSourceLibrary.js';
import { seq } from '@tunarr/shared/util';
import type { MediaItem, MediaStream } from '@tunarr/types';
import dayjs from 'dayjs';
import { head, orderBy } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { basename } from 'node:path';
import { v4 } from 'uuid';
import type { LocalMediaDB } from '../../db/LocalMediaDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type {
  Artwork,
  ArtworkType,
  NewArtwork,
} from '../../db/schema/Artwork.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import type { MediaLibraryType } from '../../db/schema/MediaSource.ts';
import type { ProgramOrm } from '../../db/schema/Program.ts';
import type { FfprobeStreamDetails } from '../../stream/FfprobeStreamDetails.ts';
import { Result } from '../../types/result.js';
import type { Maybe } from '../../types/util.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { caughtErrorToError, isDefined } from '../../util/index.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { ImageCache } from '../ImageCache.ts';
import { KnownImageFileExtensions } from './constants.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { RunState } from './MediaSourceScanner.ts';

export type LocalScanRequest = {
  mediaSource: MediaSourceWithRelations;
  force?: boolean;
  pathFilter?: string;
};

export type GenericLocalMediaSourceScanner = FileSystemScanner;

export type GenericLocalMediaSourceScannerFactory = (
  libraryType: MediaLibraryType,
) => GenericLocalMediaSourceScanner;

export abstract class FileSystemScanner {
  protected state: RunState = 'starting';
  private mediaSourceId: Maybe<string>;

  constructor(
    protected logger: Logger,
    protected ffprobeStreamDetails: FfprobeStreamDetails,
    protected imageCache: ImageCache,
    protected localMediaDB: LocalMediaDB,
    protected mediaSourceProgressService: MediaSourceProgressService,
    protected mediaSourceDB: MediaSourceDB,
  ) {}

  async scan(req: LocalScanRequest) {
    this.mediaSourceId = req.mediaSource.uuid;
    if (!req.mediaSource.mediaType || req.mediaSource.type !== 'local') {
      throw new Error(
        'Invalid media source for local scanning: ' +
          JSON.stringify(req.mediaSource),
      );
    }

    if (req.mediaSource.libraries.length === 0) {
      this.logger.warn('Media source has no paths to scan.');
      return;
    }

    this.state = 'running';

    this.logger.info(
      'Scanning local media source: %s (force=%s)',
      req.mediaSource.uuid,
      req.force ?? false,
    );

    for (let i = 0; i < req.mediaSource.libraries.length; i++) {
      const localPath = req.mediaSource.libraries[i]!;
      this.mediaSourceProgressService.scanStarted(req.mediaSource.uuid);
      try {
        await this.scanPath({
          mediaSource: req.mediaSource,
          library: localPath,
          force: req.force ?? false,
          percentMin: i / req.mediaSource.libraries.length,
          percentCompleteMultiplier:
            (i + 1) / req.mediaSource.libraries.length -
            i / req.mediaSource.libraries.length,
          pathFilter: req.pathFilter,
        });
      } catch (e) {
        this.logger.error(
          e,
          'Error scanning local path: %s',
          localPath.externalKey,
        );
      } finally {
        this.mediaSourceProgressService.scanEnded(req.mediaSource.uuid);
        await this.mediaSourceDB.setLibraryLastScannedTime(
          localPath.uuid,
          dayjs(),
        );
      }
    }
  }

  cancel() {
    this.logger.info(
      'Canceling scan of local media source: %s',
      this.mediaSourceId ?? '???',
    );
    this.state = 'canceled';
  }

  abstract scanPath(context: LocalScanContext): Promise<Result<void>>;

  protected async shouldScanDirectory(dir: string): Promise<boolean> {
    return (
      !basename(dir).startsWith('.') &&
      !(await fileExists(path.join(dir, '.tunarrignore')))
    );
  }

  protected async getMediaItem(filePath: string): Promise<Result<MediaItem>> {
    try {
      const streamDetails = await this.ffprobeStreamDetails.getStream({
        path: filePath,
      });

      if (streamDetails.isFailure()) {
        return streamDetails.recast();
      }

      const videoStreams = streamDetails.get().streamDetails.videoDetails;
      const streams: MediaStream[] = [];
      if (videoStreams) {
        for (const probeVideoStream of videoStreams) {
          const videoStream: MediaStream = {
            ...probeVideoStream,
            // uuid: v4(),
            bitDepth: probeVideoStream.bitDepth,
            streamType: 'video',
            codec: probeVideoStream.codec ?? 'unknown',
            channels: null,
            index: probeVideoStream.streamIndex ?? 0,
            default: true,
            // forced: true,
            title: 'Main',
            // languageCodeISO6392: null,
            // programVersionId: versionId,
            profile: probeVideoStream.profile ?? null,
            pixelFormat: probeVideoStream.pixelFormat ?? null,
            colorPrimaries: probeVideoStream.colorPrimaries ?? null,
            colorRange: probeVideoStream.colorRange ?? null,
            colorSpace: probeVideoStream.colorSpace ?? null,
            colorTransfer: probeVideoStream.colorTransfer ?? null,
          };
          streams.push(videoStream);
        }
      }

      for (const audioStream of streamDetails.get().streamDetails
        .audioDetails ?? []) {
        const stream: MediaStream = {
          ...audioStream,
          // uuid: v4(),
          // bitsPerSample: audioStream.bitrate ?? null,
          streamType: 'audio',
          codec: audioStream.codec ?? 'unknown',
          channels: null,
          index: audioStream.index ?? 0,
          default: true,
          // forced: true,
          languageCodeISO6392:
            audioStream.languageCodeISO6392 ?? audioStream.language,
          // programVersionId: versionId,
          profile: audioStream.profile ?? null,
          pixelFormat: null,
        };
        streams.push(stream);
      }

      for (const subtitleStream of streamDetails.get().streamDetails
        .subtitleDetails ?? []) {
        const stream: MediaStream = {
          ...subtitleStream,
          // uuid: v4(),
          streamType:
            subtitleStream.type === 'external'
              ? 'external_subtitles'
              : 'subtitles',
          codec: subtitleStream.codec ?? 'unknown',
          channels: null,
          index: subtitleStream.index ?? 0,
          default: true,
          // forced: true,
          languageCodeISO6392:
            subtitleStream.languageCodeISO6392 ?? subtitleStream.language,
          // programVersionId: versionId,
          profile: null,
          pixelFormat: null,
        };
        streams.push(stream);
      }

      // const statResult = await fs.stat(filePath);

      const firstVideoStream = head(
        orderBy(
          streamDetails.get().streamDetails.videoDetails,
          (v, i) => (v.streamIndex ?? 0) + i,
          'asc',
        ),
      );

      const chapters = streamDetails.get().streamDetails.chapters;

      const mediaItem: MediaItem = {
        // createdAt: statResult.ctime,
        // updatedAt: statResult.mtime,
        chapters,
        displayAspectRatio: firstVideoStream?.displayAspectRatio,
        sampleAspectRatio: firstVideoStream?.sampleAspectRatio,
        duration: +streamDetails.get().streamDetails.duration,
        frameRate: firstVideoStream?.framerate,
        resolution:
          isDefined(firstVideoStream?.height) &&
          isDefined(firstVideoStream?.width)
            ? {
                widthPx: firstVideoStream.width,
                heightPx: firstVideoStream.height,
              }
            : null,
        scanKind: firstVideoStream?.scanType,
        streams,
        locations: [
          {
            type: 'local',
            path: filePath,
          },
        ],
      };

      return Result.success(mediaItem);
    } catch (e) {
      return Result.forError(caughtErrorToError(e));
    }
  }

  protected async scanArtwork(
    artworkFilePath: string,
    artworkType: ArtworkType,
    existingArtwork: Maybe<ProgramOrm & { artwork: Artwork[] }>,
    force: boolean = false,
  ): Promise<Result<Maybe<NewArtwork>>> {
    return Result.attemptAsync(async () => {
      const stat = await fs.stat(artworkFilePath);
      const existingOfType = existingArtwork?.artwork.find(
        (a) => a.artworkType === artworkType,
      );
      const needsRefresh =
        force ||
        !existingOfType?.updatedAt ||
        dayjs
          .duration(dayjs(stat.mtime).diff(existingOfType.updatedAt))
          .asSeconds() > 1;
      if (!needsRefresh) {
        return;
      }

      this.logger.trace('Refreshing artwork');

      const cacheResult = await this.imageCache.addArtworkToCache(
        artworkFilePath,
        artworkType,
      );
      if (cacheResult.isFailure()) {
        throw cacheResult.error;
      }

      const cachePath = cacheResult.get().cacheKey;

      let workingArtwork: NewArtwork;
      // const isUpdate = !!existingOfType;
      if (existingOfType) {
        workingArtwork = existingOfType;
        workingArtwork.cachePath = cachePath;
        workingArtwork.sourcePath = artworkFilePath;
        workingArtwork.updatedAt = stat.mtime;
      } else {
        workingArtwork = {
          uuid: v4(),
          artworkType,
          cachePath: cachePath,
          sourcePath: artworkFilePath,
          updatedAt: stat.mtime,
          createdAt: dayjs().toDate(),
        } satisfies NewArtwork;
      }

      /*
      THis is very slow. Do it async.
      const [hash43, hash64] = await Promise.all([
        this.imageCache.calculateBlurHash(cachePath, artworkType, 4, 3),
        this.imageCache.calculateBlurHash(cachePath, artworkType, 6, 4),
      ]);

      hash43.either(
        (h) => {
          workingArtwork.blurHash43 = h;
        },
        (err) => {
          this.logger.error(err, 'Failed to generate blurhash');
        },
      );

      hash64.either(
        (h) => {
          workingArtwork.blurHash64 = h;
        },
        (err) => {
          this.logger.error(err, 'Failed to generate blurhash');
        },
      );
      */

      return workingArtwork;
      // if (isUpdate) {
      //   return await this.localMediaDB.updateArtwork(
      //     workingArtwork.uuid,
      //     workingArtwork,
      //   );
      // } else {
      //   return await this.localMediaDB.insertArtwork(workingArtwork);
      // }
    });
  }

  protected async getAllScannableSubdirectories(dirPath: string) {
    const allEntries = await fs.readdir(dirPath, {
      withFileTypes: true,
    });

    return seq.asyncCollect(
      orderBy(allEntries, (dirent) => dirent.name),
      async (dir) => {
        if (!dir.isDirectory()) {
          return;
        }

        if (
          await this.shouldScanDirectory(path.join(dir.parentPath, dir.name))
        ) {
          return dir;
        }
        return;
      },
    );
  }

  protected static async locateArtworkInDirectory(
    baseFolder: string,
    artworkNames: string[],
  ) {
    const allNames = KnownImageFileExtensions.values()
      .flatMap((ext) => artworkNames.map((name) => `${name}.${ext}`))
      .map((filename) => path.join(baseFolder, filename));
    for (const name of allNames) {
      if (await fileExists(name)) {
        return name;
      }
    }
    return;
  }

  protected static async locateArtworkForPossibleNames(
    possibleNames: string[],
  ) {
    const allNames = [
      ...KnownImageFileExtensions.values().flatMap((ext) =>
        possibleNames.map((name) => `${name}.${ext}`),
      ),
    ];
    for (const name of allNames) {
      if (await fileExists(name)) {
        return name;
      }
    }
    return;
  }
}

export type LocalScanContext = {
  mediaSource: MediaSourceWithRelations;
  library: MediaSourceLibraryOrm;
  force: boolean;
  percentMin: number;
  percentCompleteMultiplier: number;
  pathFilter?: string;
};
