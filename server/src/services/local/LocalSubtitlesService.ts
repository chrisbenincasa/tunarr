import { isNonEmptyString } from '@tunarr/shared/util';
import { MediaSubtitles } from '@tunarr/types';
import { injectable } from 'inversify';
import fs from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import { match, P } from 'ts-pattern';
import { Nullable } from '../../types/util.ts';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';
import { LanguageService } from '../LanguageService.ts';

@injectable()
export class LocalSubtitlesService {
  private static logger = LoggerFactory.child({
    className: LocalSubtitlesService.name,
  });
  constructor() {}

  async findExternalSubtitles(fullItemPath: string) {
    const subtitles: MediaSubtitles[] = [];
    const itemName = basename(fullItemPath, extname(fullItemPath));
    for (const dirent of await fs.readdir(dirname(fullItemPath), {
      withFileTypes: true,
    })) {
      if (!dirent.isFile()) {
        continue;
      }

      if (!dirent.name.startsWith(itemName)) {
        continue;
      }

      const filename = basename(dirent.name, extname(dirent.name));
      const parsedSubtitles = LocalSubtitlesService.parseSubtitleFilePath(
        itemName,
        filename,
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

    // Subtitles generally are meant to be in the form {media_name}.{lang}(.{opts})*.{codec_ext}
    // At this point we've removed the codec_ext and we want to read out the options in the filename
    // and then derive the language.
    const [lang = '', ...opts] = fileName
      .replace(itemName, '')
      .toLowerCase()
      .split('.')
      .filter((s) => s.length > 0);

    const sdh =
      opts.includes('hi') || opts.includes('cc') || opts.includes('sdh');
    const forced = opts.includes('forced');

    const maybeLang3B = LanguageService.getAlpha3TCode(
      lang.split(/[-_]/)?.[0] ?? lang,
    );

    if (isNonEmptyString(maybeLang3B)) {
      return {
        codec,
        language: maybeLang3B,
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
