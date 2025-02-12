import type { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { container } from '../container.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { GenericMediaSourceMovieLibraryScanner } from '../services/scanner/MediaSourceMovieLibraryScanner.ts';
import { GenericMediaSourceMusicLibraryScanner } from '../services/scanner/MediaSourceMusicArtistScanner.ts';
import { GenericMediaSourceScanner } from '../services/scanner/MediaSourceScanner.ts';
import { GenericMediaSourceTvShowLibraryScanner } from '../services/scanner/MediaSourceTvShowLibraryScanner.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { Maybe } from '../types/util.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import type { TaskMetadata } from './Task.ts';
import { Task } from './Task.ts';

@injectable()
export class ScanLibrariesTask extends Task {
  static KEY = Symbol.for(ScanLibrariesTask.name);
  static ID = ScanLibrariesTask.name;
  public ID = ScanLibrariesTask.ID as Tag<
    typeof ScanLibrariesTask.name,
    TaskMetadata
  >;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {
    super(logger);
  }

  protected async runInternal(): Promise<unknown> {
    const allSources = await this.mediaSourceDB.getAll();

    // Very simple impl - we can probably fan out by source
    for (const source of allSources) {
      for (const library of source.libraries) {
        if (!library.enabled) {
          continue;
        }

        let scanner: Maybe<GenericMediaSourceScanner> = undefined;
        switch (library.mediaType) {
          case 'movies': {
            scanner =
              container.tryGetNamed<GenericMediaSourceMovieLibraryScanner>(
                KEYS.MediaSourceMovieLibraryScanner,
                source.type,
              );
            break;
          }
          case 'shows': {
            scanner =
              container.tryGetNamed<GenericMediaSourceTvShowLibraryScanner>(
                KEYS.MediaSourceTvShowLibraryScanner,
                source.type,
              );
            break;
          }
          case 'tracks': {
            scanner =
              container.tryGetNamed<GenericMediaSourceMusicLibraryScanner>(
                KEYS.MediaSourceMusicLibraryScanner,
                source.type,
              );
            break;
          }
          case 'music_videos':
          case 'other_videos':
            this.logger.warn(
              'media type %s is not yet supported',
              library.mediaType,
            );
            continue;
        }

        if (!scanner) {
          this.logger.warn(
            'Could not retrieve %s scanner implementation for source type: %s',
            library.mediaType,
            source.type,
          );
          break;
        }

        const scanResult = await Result.attemptAsync(() =>
          scanner.scan({ library }),
        );
        if (scanResult.isFailure()) {
          this.logger.error(
            scanResult.error,
            'Failure while scanning %s %s library: %s',
            source.type,
            library.mediaType,
            library.name,
          );
        }
      }
    }

    return;
  }
}
