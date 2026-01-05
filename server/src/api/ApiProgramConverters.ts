import dayjs from '@/util/dayjs.js';
import type {
  Actor,
  Episode,
  Identifier,
  MediaArtwork,
  Movie,
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  OtherVideo,
  ProgramGrouping,
  Season,
  Show,
  Studio,
  TerminalProgram,
} from '@tunarr/types';
import { orderBy } from 'lodash-es';
import { match } from 'ts-pattern';
import type { ProgramGroupingChildCounts } from '../db/interfaces/IProgramDB.ts';
import type { CreditType } from '../db/schema/Credit.ts';
import type {
  CreditWithArtwork,
  MediaSourceWithRelations,
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
} from '../db/schema/derivedTypes.ts';
import type { MediaSourceLibraryOrm } from '../db/schema/MediaSourceLibrary.ts';
import type {
  ProgramGroupingSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';
import type { Maybe, Nullable } from '../types/util.ts';
import { isNonEmptyString } from '../util/index.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { titleToSortTitle } from '../util/programs.ts';

export class ApiProgramConverters {
  private static logger = LoggerFactory.child({
    className: ApiProgramConverters.name,
  });

  private constructor() {}

  static convertProgram(
    program: ProgramWithRelationsOrm,
    searchDoc: Maybe<TerminalProgramSearchDocument>,
    mediaSource: MediaSourceWithRelations,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Nullable<TerminalProgram> {
    if (!program.canonicalId) {
      this.logger.warn(`Program %s doesn't have a canonicalId!`, program.uuid);
    }

    const externalId = program.externalKey;

    if (!externalId && program.sourceType !== 'local') {
      throw new Error('No external Id found');
    }

    const parsed = dayjs(
      program.originalAirDate,
      [`YYYY-MM-DDTHH:mm:ssZ`, `YYYY-MM-DD`],
      true,
    );
    const releaseDate = parsed.isValid() ? +parsed : null;
    const year =
      program.year && program.year > 0
        ? program.year
        : parsed.isValid()
          ? parsed.year()
          : null;

    const identifiers =
      program.externalIds?.map((eid) => ({
        id: eid.externalKey,
        sourceId: isNonEmptyString(eid.mediaSourceId)
          ? eid.mediaSourceId
          : undefined,
        type: eid.sourceType,
      })) ?? [];

    const uuid = program.uuid;

    const base = {
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      // externalLibraryId: mediaLibrary.externalKey,
      releaseDate: releaseDate,
      releaseDateString: program.originalAirDate,
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
      genres: program.genres
        ?.map((g) => g.genre)
        .map((genre) => ({
          name: genre.name,
        })),
      state: program.state,
      uuid,
      identifiers,
      year: year && year > 0 ? year : null,
      title: program.title,
      duration: program.duration,
      canonicalId: program.canonicalId ?? '',
      // TODO: Persist these to the DB
      tags: searchDoc?.tags ?? [],
      actors: convertCreditWithArtwork(program.credits ?? [], 'cast'),
      writers: convertCreditWithArtwork(program.credits ?? [], 'writer'),
      directors: convertCreditWithArtwork(program.credits ?? [], 'director'),
      studios: program.studios?.map(
        (studio) =>
          ({
            uuid: studio.studio.uuid,
            name: studio.studio.name,
          }) satisfies Studio,
      ),
    } satisfies Partial<TerminalProgram>;

    const result = match(program)
      .returnType<TerminalProgram | null>()
      .with(
        { type: 'episode' },
        (ep) =>
          ({
            ...base,
            type: 'episode',
            summary: ep.summary,
            originalTitle: null,
            episodeNumber: ep.episode ?? 0,
          }) satisfies Episode,
      )
      .with(
        { type: 'movie' },
        (movie) =>
          ({
            ...base,
            type: 'movie',
            originalTitle: null,
            plot: movie.plot,
            rating: movie.rating,
            summary: movie.summary,
            tagline: movie.tagline,
            tags: [],
          }) satisfies Movie,
      )
      .with(
        { type: 'track' },
        () =>
          ({
            ...base,
            type: 'track',
            originalTitle: null,
            trackNumber: program.episode ?? 0,
            tags: [],
          }) satisfies MusicTrack,
      )
      .with(
        {
          type: 'other_video',
        },
        () =>
          ({
            ...base,
            type: 'other_video',
            originalTitle: null,
            tags: [],
          }) satisfies OtherVideo,
      )
      .otherwise(() => null);

    if (!result) {
      throw new Error(
        'Could not convert program result for incoming document: ' +
          JSON.stringify(program),
      );
    }

    return result;
  }

  static convertProgramGrouping(
    grouping: ProgramGroupingOrmWithRelations,
    doc: Maybe<ProgramGroupingSearchDocument>,
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

    const identifiers = grouping.externalIds.map(
      (eid) =>
        ({
          id: eid.externalKey,
          sourceId: eid.mediaSourceId ?? undefined,
          type: eid.sourceType,
        }) satisfies Identifier,
    );

    const uuid = grouping.uuid;
    const studios =
      grouping?.studios?.map(({ studio }) => ({ name: studio.name })) ?? [];

    const externalId =
      grouping.externalKey ??
      grouping.externalIds.find((eid) => eid.sourceType === mediaSource.type)
        ?.externalKey;

    if (!externalId && mediaSource.type !== 'local') {
      throw new Error(`Program grouping ${grouping.uuid} has no external ID!`);
    }

    const releaseDateObj = grouping.releaseDate
      ? dayjs(grouping.releaseDate)
      : null;

    let year = releaseDateObj?.year();
    if (!year || year <= 0) {
      year = grouping.year ?? undefined;
    }

    const base = {
      sortTitle: '',
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      // externalLibraryId: mediaLibrary.externalKey,
      releaseDate: releaseDateObj?.valueOf() ?? null,
      releaseDateString: releaseDateObj?.format('YYYY-MM-DD') ?? null,
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
      index: grouping.index ?? 0,
      uuid,
      identifiers,
      year: year && year > 0 ? year : null,
      canonicalId: grouping.canonicalId ?? '',
      title: grouping.title,
      summary: grouping.summary,
      plot: grouping.plot,
      tagline: grouping.tagline,
      tags: doc?.tags ?? [],
      genres: grouping.genres?.map(({ genre }) => ({ name: genre.name })) ?? [],
      actors: convertCreditWithArtwork(grouping.credits ?? [], 'cast'),
    } satisfies Partial<ProgramGrouping>;

    const result = match(grouping)
      .returnType<ProgramGrouping>()
      .with(
        { type: 'season' },
        () =>
          ({
            ...base,
            type: 'season',
            studios,
            childCount,
            grandchildCount,
          }) satisfies Season,
      )
      .with(
        { type: 'show' },
        () =>
          ({
            ...base,
            type: 'show',
            studios,
            childCount,
            grandchildCount,
            rating: grouping.rating,
          }) satisfies Show,
      )
      .with(
        { type: 'album' },
        () =>
          ({
            ...base,
            type: 'album',
            childCount,
            grandchildCount,
          }) satisfies MusicAlbum,
      )
      .with(
        { type: 'artist' },
        () =>
          ({
            ...base,
            type: 'artist',
            childCount,
            grandchildCount,
          }) satisfies MusicArtist,
      )
      .exhaustive();

    return result;
  }
}

function convertCreditWithArtwork(
  credits: CreditWithArtwork[],
  creditType: CreditType,
) {
  return orderBy(
    credits.filter((credit) => credit.type === creditType),
    (credit, idx) => credit.index ?? idx,
    'asc',
  ).map((credit, index) => {
    const maybeThumbPath = credit.artwork?.find(
      (art) => art.artworkType === 'thumbnail',
    )?.sourcePath;
    const thumb =
      maybeThumbPath && URL.canParse(maybeThumbPath) ? maybeThumbPath : null;
    return {
      uuid: credit.uuid,
      name: credit.name,
      order: index,
      role: credit.role,
      thumb,
    } satisfies Actor;
  });
}
