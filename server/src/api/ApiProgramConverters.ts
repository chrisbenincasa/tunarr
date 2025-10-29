import type {
  Episode,
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
import { match } from 'ts-pattern';
import type { ProgramGroupingChildCounts } from '../db/interfaces/IProgramDB.ts';
import type {
  MediaSourceWithRelations,
  ProgramWithRelationsOrm,
} from '../db/schema/derivedTypes.ts';
import type { MediaSourceLibraryOrm } from '../db/schema/MediaSourceLibrary.ts';
import type { ProgramGrouping as ProgramGroupingDao } from '../db/schema/ProgramGrouping.ts';
import type {
  ProgramGroupingSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';
import { decodeCaseSensitiveId } from '../services/MeilisearchService.ts';
import type { Maybe } from '../types/util.ts';
import { isNonEmptyString } from '../util/index.ts';

export class ApiProgramConverters {
  private constructor() {}

  static convertProgramSearchResult(
    doc: TerminalProgramSearchDocument,
    program: ProgramWithRelationsOrm,
    mediaSource: MediaSourceWithRelations,
    mediaLibrary: MediaSourceLibraryOrm,
  ): TerminalProgram {
    if (!program.canonicalId) {
      throw new Error('Program did not have a canonical ID');
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
      sortTitle: '',
    };

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
            canonicalId: program.canonicalId!,
            sortTitle: '',
            // mediaItem: {
            //   displayAspectRatio: '',
            //   duration: doc.duration,
            //   resolution: {
            //     widthPx: doc.videoWidth ?? 0,
            //     heightPx: doc.videoHeight ?? 0,
            //   },
            //   sampleAspectRatio: '',

            // },
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
            canonicalId: program.canonicalId!,
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
            canonicalId: program.canonicalId!,
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
            canonicalId: program.canonicalId!,
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
    grouping: ProgramGroupingDao,
    childCounts: Maybe<ProgramGroupingChildCounts>,
    mediaSource: MediaSourceWithRelations,
    mediaLibrary: MediaSourceLibraryOrm,
  ): ProgramGrouping {
    if (!grouping.canonicalId) {
      throw new Error(`No canonical id for grouping ${grouping.uuid}`);
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

    const externalId = doc.externalIds.find(
      (eid) => eid.source === mediaSource.type,
    )?.id;

    if (!externalId && mediaSource.type !== 'local') {
      throw new Error('');
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
      externalId: externalId ?? grouping.externalKey ?? '',
      sourceType: mediaSource.type,
    };

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
            canonicalId: grouping.canonicalId!,
            studios,
            year: doc.originalReleaseYear,
            index: doc.index ?? 0,
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
            canonicalId: grouping.canonicalId!,
            studios,
            year: doc.originalReleaseYear,
            childCount,
            grandchildCount,
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
            canonicalId: grouping.canonicalId!,
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
            canonicalId: grouping.canonicalId!,
            childCount,
            grandchildCount,
          }) satisfies MusicArtist,
      )
      .exhaustive();

    return result;
  }
}
