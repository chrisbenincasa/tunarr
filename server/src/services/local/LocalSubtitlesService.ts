import { isNonEmptyString } from '@tunarr/shared/util';
import type { MediaSubtitles } from '@tunarr/types';
import { injectable } from 'inversify';
import fs from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { match, P } from 'ts-pattern';
import type { Nullable } from '../../types/util.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';
import { LanguageService } from '../LanguageService.ts';

@injectable()
export class LocalSubtitlesService {
  private static _logger?: Logger;
  private static get logger() {
    return (this._logger ??= LoggerFactory.child({
      className: LocalSubtitlesService.name,
    }));
  }
  constructor() {}

  async findExternalSubtitles(fullItemPath: string) {
    const subtitles: MediaSubtitles[] = [];
    for (const dirent of await fs.readdir(dirname(fullItemPath), {
      withFileTypes: true,
    })) {
      if (!dirent.isFile()) {
        continue;
      }

      const parsedSubtitles = LocalSubtitlesService.parseSubtitleFilePath(
        fullItemPath,
        join(dirname(fullItemPath), dirent.name),
      );

      if (!parsedSubtitles) {
        continue;
      }

      subtitles.push(parsedSubtitles);
    }

    return subtitles;
  }

  static parseSubtitleFilePath(
    originalItemPath: string,
    fullPath: string,
  ): Nullable<MediaSubtitles> {
    const itemName = basename(originalItemPath, extname(originalItemPath));
    const fileName = basename(fullPath);
    const codec = match(extname(fileName))
      .with(P.union('.ssa', '.ass'), () => 'ass')
      .with('.srt', () => 'subrip')
      .with('.vtt', () => 'webvtt')
      .otherwise(() => null);

    if (!codec) {
      return null;
    }

    // Sidecars are named {media_name}(.{lang})?(.{opts})*.{codec_ext}. Requiring
    // the dot after the media name keeps "Movie Part 2.en.srt" off "Movie.mkv".

    const prefix = `${itemName}.`;
    if (!fileName.startsWith(prefix)) {
      return null;
    }

    const [lang = 'und', ...opts] = basename(fileName, extname(fileName))
      .slice(prefix.length)
      .toLowerCase()
      .split('.')
      .filter((s) => s.length > 0);

    const sdh =
      opts.includes('hi') || opts.includes('cc') || opts.includes('sdh');
    const forced = opts.includes('forced');

    const maybeLang3T = LanguageService.getAlpha3TCode(
      lang.split(/[-_]/)?.[0] ?? lang,
    );

    if (isNonEmptyString(maybeLang3T)) {
      return {
        codec,
        language: maybeLang3T,
        subtitleType: 'sidecar',
        default: false,
        forced,
        sdh,
        path: fullPath,
      };
    } else {
      this.logger.debug(
        'Found unknown subtitle language (%s) for file: %s',
        lang,
        fullPath,
      );
      return {
        codec,
        language: lang,
        subtitleType: 'sidecar',
        default: false,
        forced,
        sdh,
        path: fullPath,
      };
    }
  }
}
