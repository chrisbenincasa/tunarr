import { MovieMetadata, OtherVideoMetadata, ShowMetadata } from '@tunarr/types';
import { injectable } from 'inversify';
import { isNull } from 'lodash-es';
import { basename, extname } from 'node:path';
import { v4 } from 'uuid';
import { parseIntOrNull } from '../../util/index.ts';

// TODO: Maybe make this customizable
const MovieNameRegex = /^(.*?)[.(](\d{4})[.)].*\.\w+$/;

@injectable()
export class FallbackMetadataService {
  constructor() {}

  getShowFallbackMetadata(showFolderPath: string): ShowMetadata {
    const title = basename(showFolderPath);
    const metadata: ShowMetadata = {
      actors: [],
      genres: [],
      identifiers: [],
      plot: null,
      rating: null,
      releaseDate: null,
      releaseDateString: null,
      title,
      sortTitle: title,
      sourceType: 'local',
      studios: [],
      summary: null,
      tagline: null,
      tags: [],
      type: 'show',
      uuid: v4(),
      year: null,
      artwork: [],
    };
    return metadata;
  }

  getMovieFallbackMetadata(movieFilePath: string): MovieMetadata {
    const title = basename(movieFilePath, extname(movieFilePath));
    const metadata: MovieMetadata = {
      identifiers: [],
      originalTitle: null,
      releaseDate: null,
      releaseDateString: null,
      sortTitle: title, // TODO:
      sourceType: 'local',
      summary: null,
      title,
      tags: [],
      type: 'movie',
      uuid: v4(),
      year: null,
      plot: null,
      rating: null,
      tagline: null,
      artwork: [],
      state: 'ok',
    };

    const filename = basename(movieFilePath);
    const matches = filename.match(MovieNameRegex);
    if (!matches || matches.length === 0) {
      return metadata;
    }

    metadata.title = matches[1]?.trim() ?? title;
    metadata.sortTitle = metadata.title;

    const maybeYear = parseIntOrNull(matches[2] ?? '');

    if (!isNull(maybeYear)) {
      metadata.year = maybeYear;
    }

    const metadataExtractorRegex = /[({[](.*?)[)}\]]/g;

    for (const match of filename.matchAll(metadataExtractorRegex)) {
      const service = match?.[1]?.toLowerCase().trim().split('-', 2) ?? '';
      if (['imdb', 'tmdb'].includes(service?.[0] ?? '')) {
        if (service.length === 2) {
          metadata.identifiers.push({
            id: service[1]!.trim(),
            type: service[0] === 'imdb' ? 'imdb' : 'tmdb',
          });
        }
      }
    }

    return metadata;
  }

  getOtherVideoFallbackMetadata(filePath: string): OtherVideoMetadata {
    const title = basename(filePath, extname(filePath));
    return {
      identifiers: [],
      originalTitle: null,
      releaseDate: null,
      releaseDateString: null,
      sortTitle: title, // TODO:
      sourceType: 'local',
      title,
      tags: [],
      type: 'other_video',
      uuid: v4(),
      year: null,
      artwork: [],
      state: 'ok',
    };
  }
}
