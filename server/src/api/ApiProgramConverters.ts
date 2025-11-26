import type {
  Actor,
  Episode,
  MediaArtwork,
  Movie,
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  OtherVideo,
  ProgramGrouping,
  Season,
  Show,
  TerminalProgram,
} from '@tunarr/types';
import dayjs from 'dayjs';
import { orderBy } from 'lodash-es';
import { match } from 'ts-pattern';
import type { ProgramGroupingChildCounts } from '../db/interfaces/IProgramDB.ts';
import type {
  MediaSourceWithRelations,
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
} from '../db/schema/derivedTypes.ts';
import type { MediaSourceLibraryOrm } from '../db/schema/MediaSourceLibrary.ts';
import type {
  ProgramGroupingSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';
import { decodeCaseSensitiveId } from '../services/MeilisearchService.ts';
import type { Maybe, Nullable } from '../types/util.ts';
import { isNonEmptyString } from '../util/index.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { titleToSortTitle } from '../util/programs.ts';

export class ApiProgramConverters {
  private static logger = LoggerFactory.child({
    className: ApiProgramConverters.name,
  });

  private constructor() {}

  static convertProgramSearchResult(
    doc: TerminalProgramSearchDocument,
    program: ProgramWithRelationsOrm,
    mediaSource: MediaSourceWithRelations,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Nullable<TerminalProgram> {
    if (!program.canonicalId) {
      this.logger.warn(`Program %s doesn't have a canonicalId!`, program.uuid);
    }

    const externalId = doc.externalIds.find(
      (eid) => eid.source === mediaSource.type,
    )?.id;
    if (!externalId && program.sourceType !== 'local') {
      throw new Error('No external Id found');
    }

    const base = {
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalLibraryId: mediaLibrary.externalKey,
      releaseDate: doc.originalReleaseDate,
      releaseDateString: doc.originalReleaseDate
        ? dayjs(doc.originalReleaseDate).format('YYYY-MM-DD')
        : null,
      externalId: externalId ?? program.externalKey,
      sourceType: mediaSource.type,
      sortTitle: titleToSortTitle(program.title),
      artwork:
        program.artwork?.map(
          (art) =>
            ({
              id: art.uuid,
              type: art.artworkType,
              path: URL.canParse(art.sourcePath) ? art.sourcePath : null,
            }) satisfies MediaArtwork,
        ) ?? [],
      genres: doc.genres,
      state: program.state,
    } satisfies Partial<TerminalProgram>;

    const identifiers = doc.externalIds.map((eid) => ({
      id: eid.id,
      sourceId: isNonEmptyString(eid.sourceId)
        ? decodeCaseSensitiveId(eid.sourceId)
        : undefined,
      type: eid.source,
    }));

    const uuid = doc.id;
    const year =
      doc.originalReleaseYear ??
      (doc.originalReleaseDate && doc.originalReleaseDate > 0
        ? dayjs(doc.originalReleaseDate).year()
        : null);
    const releaseDate =
      doc.originalReleaseDate && doc.originalReleaseDate > 0
        ? doc.originalReleaseDate
        : null;

    const result = match(doc)
      .returnType<TerminalProgram | null>()
      .with(
        { type: 'episode' },
        (ep) =>
          ({
            ...ep,
            ...base,
            uuid,
            originalTitle: null,
            year,
            releaseDate,
            identifiers,
            episodeNumber: ep.index ?? 0,
            canonicalId: program.canonicalId ?? '',
          }) satisfies Episode,
      )
      .with(
        { type: 'movie' },
        (movie) =>
          ({
            ...movie,
            ...base,
            identifiers,
            uuid,
            originalTitle: null,
            year,
            releaseDate,
            canonicalId: program.canonicalId ?? '',
          }) satisfies Movie,
      )
      .with(
        { type: 'track' },
        (track) =>
          ({
            ...track,
            ...base,
            identifiers,
            uuid,
            originalTitle: null,
            year,
            releaseDate,
            canonicalId: program.canonicalId ?? '',
            trackNumber: doc.index ?? 0,
          }) satisfies MusicTrack,
      )
      .with(
        {
          type: 'other_video',
        },
        (video) =>
          ({
            ...video,
            ...base,
            identifiers,
            uuid,
            originalTitle: null,
            year,
            releaseDate,
            canonicalId: program.canonicalId ?? '',
          }) satisfies OtherVideo,
      )
      .otherwise(() => null);

    if (!result) {
      throw new Error(
        'Could not convert program result for incoming document: ' +
          JSON.stringify(doc),
      );
    }

    return result;
  }

  static convertProgramGroupingSearchResult(
    doc: ProgramGroupingSearchDocument,
    grouping: ProgramGroupingOrmWithRelations,
    childCounts: Maybe<ProgramGroupingChildCounts>,
    mediaSource: MediaSourceWithRelations,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Nullable<ProgramGrouping> {
    if (!grouping.canonicalId) {
      this.logger.warn(
        `Grouping %s (type = %s) doesn't have a canonicalId!`,
        grouping.uuid,
        grouping.type,
      );
    }

    const childCount = childCounts?.childCount;
    const grandchildCount = childCounts?.grandchildCount;

    const identifiers = doc.externalIds.map((eid) => ({
      id: eid.id,
      sourceId: isNonEmptyString(eid.sourceId)
        ? decodeCaseSensitiveId(eid.sourceId)
        : undefined,
      type: eid.source,
    }));

    const uuid = doc.id;
    const studios = doc?.studio?.map(({ name }) => ({ name })) ?? [];

    const externalId =
      doc.externalIds.find((eid) => eid.source === mediaSource.type)?.id ??
      grouping.externalKey;

    if (!externalId && mediaSource.type !== 'local') {
      throw new Error(`Program grouping ${grouping.uuid} has no external ID!`);
    }

    const base = {
      sortTitle: '',
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalLibraryId: mediaLibrary.externalKey,
      releaseDate: doc.originalReleaseDate,
      releaseDateString: doc.originalReleaseDate
        ? dayjs(doc.originalReleaseDate).format('YYYY-MM-DD')
        : null,
      externalId: externalId ?? '',
      sourceType: mediaSource.type,
      artwork:
        grouping.artwork?.map(
          (art) =>
            ({
              id: art.uuid,
              type: art.artworkType,
              path: URL.canParse(art.sourcePath) ? art.sourcePath : null,
            }) satisfies MediaArtwork,
        ) ?? [],
      index: grouping.index ?? doc.index ?? 0,
    } satisfies Partial<ProgramGrouping>;

    const result = match(doc)
      .returnType<ProgramGrouping>()
      .with(
        { type: 'season' },
        (season) =>
          ({
            ...season,
            ...base,
            type: 'season',
            identifiers,
            uuid,
            canonicalId: grouping.canonicalId ?? '',
            studios,
            year: doc.originalReleaseYear,
            childCount,
            grandchildCount,
          }) satisfies Season,
      )
      .with(
        { type: 'show' },
        (show) =>
          ({
            ...show,
            ...base,
            identifiers,
            uuid,
            canonicalId: grouping.canonicalId ?? '',
            studios,
            year: doc.originalReleaseYear,
            childCount,
            grandchildCount,
            actors: orderBy(
              grouping.credits?.filter((credit) => credit.type === 'cast'),
              (credit, idx) => credit.index ?? idx,
              'asc',
            ).map(
              (credit, index) =>
                ({
                  name: credit.name,
                  order: index,
                  role: credit.role,
                }) satisfies Actor,
            ),
          }) satisfies Show,
      )
      .with(
        { type: 'album' },
        (album) =>
          ({
            ...album,
            ...base,
            identifiers,
            uuid,
            canonicalId: grouping.canonicalId ?? '',
            // studios,
            year: doc.originalReleaseYear,
            childCount,
            grandchildCount,
          }) satisfies MusicAlbum,
      )
      .with(
        { type: 'artist' },
        (artist) =>
          ({
            ...artist,
            ...base,
            identifiers,
            uuid,
            canonicalId: grouping.canonicalId ?? '',
            childCount,
            grandchildCount,
          }) satisfies MusicArtist,
      )
      .exhaustive();

    return result;
  }
}
