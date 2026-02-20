import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { NewSingleOrMultiProgramGroupingExternalId } from '@/db/schema/ProgramGroupingExternalId.js';
import { isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import {
  Actor,
  tag,
  type ContentProgram,
  type Identifier,
  type Season,
  type Show,
} from '@tunarr/types';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import { first } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import {
  MediaSourceMusicAlbum,
  MediaSourceMusicArtist,
} from '../../types/Media.ts';
import type { Nilable, Nullable } from '../../types/util.ts';
import { NewArtwork } from '../schema/Artwork.ts';
import { MediaSourceId, MediaSourceName } from '../schema/base.js';
import { NewCredit } from '../schema/Credit.ts';
import {
  NewCreditWithArtwork,
  NewProgramGroupingWithRelations,
} from '../schema/derivedTypes.js';
import { MediaSourceOrm } from '../schema/MediaSource.ts';
import { MediaSourceLibraryOrm } from '../schema/MediaSourceLibrary.ts';
import {
  ProgramGroupingType,
  type NewProgramGrouping,
} from '../schema/ProgramGrouping.ts';
import { CommonDaoMinter } from './CommonDaoMinter.ts';

@injectable()
export class ProgramGroupingMinter {
  constructor() {}

  static mintGroupingExternalIds(
    program: ContentProgram,
    groupingId: string,
    externalSourceId: MediaSourceName,
    mediaSourceId: MediaSourceId,
    relationType: 'parent' | 'grandparent',
  ): NewSingleOrMultiProgramGroupingExternalId[] {
    if (program.subtype === 'movie') {
      return [];
    }

    const now = +dayjs();
    const parentExternalIds: NewSingleOrMultiProgramGroupingExternalId[] = [];

    const ratingKey =
      relationType === 'grandparent'
        ? program.grandparent?.externalKey
        : program.parent?.externalKey;
    if (isNonEmptyString(ratingKey)) {
      parentExternalIds.push({
        type: 'multi',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalFilePath: null,
        externalKey: ratingKey,
        sourceType: ProgramExternalIdType.PLEX,
        externalSourceId,
        mediaSourceId,
        groupUuid: groupingId,
      });
    }

    const guid = first(
      relationType === 'grandparent'
        ? program.grandparent?.guids
        : program.parent?.guids,
    );
    if (isNonEmptyString(guid)) {
      parentExternalIds.push({
        type: 'single',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalFilePath: null,
        externalKey: guid,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        groupUuid: groupingId,
      });
    }

    return parentExternalIds;
  }

  static mintGrandparentGrouping(
    item: MarkRequired<ContentProgram, 'grandparent'>,
  ): Nullable<NewProgramGrouping> {
    if (item.subtype === 'movie') {
      return null;
    }

    if (!item.canonicalId || !item.libraryId || !item.grandparent.externalKey) {
      return null;
    }

    const now = +dayjs();
    return {
      uuid: v4(),
      type:
        item.subtype === 'episode'
          ? ProgramGroupingType.Show
          : ProgramGroupingType.Artist,
      createdAt: now,
      updatedAt: now,
      index: null,
      title: item.grandparent.title ?? '',
      summary: item.grandparent.summary,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: item.grandparent.year,
      canonicalId: item.canonicalId,
      libraryId: item.libraryId,
      sourceType: item.externalSourceType,
      mediaSourceId: tag(item.externalSourceId),
      externalKey: item.grandparent.externalKey,
    };
  }

  static mintParentGrouping(
    item: MarkRequired<ContentProgram, 'parent'>,
  ): Nullable<NewProgramGrouping> {
    if (item.subtype === 'movie') {
      return null;
    }

    if (!item.canonicalId || !item.libraryId || !item.parent.externalKey) {
      return null;
    }

    const now = +dayjs();
    return {
      uuid: v4(),
      type:
        item.subtype === 'episode'
          ? ProgramGroupingType.Season
          : ProgramGroupingType.Album,
      createdAt: now,
      updatedAt: now,
      index: item.parent.index,
      title: item.parent.title ?? '',
      summary: item.parent.summary,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: item.parent.year,
      canonicalId: item.canonicalId,
      libraryId: item.libraryId,
      sourceType: item.externalSourceType,
      mediaSourceId: tag(item.externalSourceId),
      externalKey: item.parent.externalKey,
    } satisfies NewProgramGrouping;
  }

  mintForMediaSourceShow(
    mediaSource: MediaSourceOrm,
    mediaSourceLibrary: MediaSourceLibraryOrm,
    show: Show,
  ): NewProgramGroupingWithRelations<'show'> {
    const now = dayjs();
    const groupingId = v4();

    return {
      programGrouping: {
        uuid: groupingId,
        type: ProgramGroupingType.Show,
        createdAt: +now,
        updatedAt: +now,
        // index: show.index,
        title: show.title,
        summary: show.summary ?? show.plot,
        libraryId: mediaSourceLibrary.uuid,
        canonicalId: show.canonicalId,
        sourceType: mediaSource.type,
        mediaSourceId: mediaSource.uuid,
        externalKey: show.externalId,
        plot: show.plot,
        releaseDate: show.releaseDate ? dayjs(show.releaseDate).toDate() : null,
        tagline: show.tagline,
        year:
          show.year ??
          (show.releaseDate ? dayjs(show.releaseDate).year() : null),
        rating: show.rating,
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        show.identifiers,
        +now,
      ),
      artwork: show.artwork
        .filter((art) => isNonEmptyString(art.path))
        .map(
          (art) =>
            ({
              uuid: v4(),
              groupingId,
              artworkType: art.type,
              createdAt: now.toDate(),
              updatedAt: now.toDate(),
              sourcePath: art.path!,
            }) satisfies NewArtwork,
        ),
      credits: show.actors.map((actor) =>
        this.mintCreditForActor(actor, groupingId, +now),
      ),
      genres: seq.collect(show.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(show.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(show.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  // TODO: This is duplicated with ProgramMinter, except for programId, dedupe it
  mintCreditForActor(
    actor: Actor,
    groupingId: string,
    createdAt: number = +dayjs(),
    updatedAt: number = createdAt,
  ): NewCreditWithArtwork {
    const credit = {
      type: 'cast',
      name: actor.name,
      uuid: v4(),
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      groupingId,
      index: actor.order,
      role: actor.role,
    } satisfies NewCredit;

    const artwork: NewArtwork[] = [];
    if (isNonEmptyString(actor.thumb)) {
      artwork.push({
        artworkType: 'thumbnail',
        sourcePath: actor.thumb,
        uuid: v4(),
        creditId: credit.uuid,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
      });
    }

    return {
      credit,
      artwork,
    };
  }

  mintForMediaSourceArtist(
    mediaSource: MediaSourceOrm,
    mediaSourceLibrary: MediaSourceLibraryOrm,
    artist: MediaSourceMusicArtist,
  ): NewProgramGroupingWithRelations<'artist'> {
    const now = +dayjs();
    const groupingId = v4();

    return {
      programGrouping: {
        uuid: groupingId,
        type: ProgramGroupingType.Artist,
        createdAt: now,
        updatedAt: now,
        // index: show.index,
        title: artist.title,
        summary: artist.summary,
        year: null,
        libraryId: mediaSourceLibrary.uuid,
        canonicalId: artist.canonicalId,
        sourceType: mediaSource.type,
        mediaSourceId: mediaSource.uuid,
        externalKey: artist.externalId,
        plot: artist.plot,
        tagline: artist.tagline,
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        artist.identifiers,
        now,
      ),
      artwork: artist.artwork
        .filter((art) => isNonEmptyString(art.path))
        .map(
          (art) =>
            ({
              uuid: v4(),
              groupingId,
              artworkType: art.type,
              createdAt: new Date(now),
              updatedAt: new Date(now),
              sourcePath: art.path!,
            }) satisfies NewArtwork,
        ),
      credits: [],
      genres: seq.collect(artist.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: [],
      tags: seq.collect(artist.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintSeason(
    mediaSource: MediaSourceOrm,
    mediaSourceLibrary: MediaSourceLibraryOrm,
    season: Season,
  ): NewProgramGroupingWithRelations<'season'> {
    const now = +dayjs();
    const groupingId = v4();

    return {
      programGrouping: {
        uuid: groupingId,
        type: ProgramGroupingType.Season,
        createdAt: now,
        updatedAt: now,
        index: season.index,
        title: season.title,
        summary: season.summary,
        libraryId: mediaSourceLibrary.uuid,
        canonicalId: season.canonicalId,
        sourceType: mediaSource.type,
        mediaSourceId: mediaSource.uuid,
        externalKey: season.externalId,
        showUuid: season.show?.uuid,
        plot: season.plot,
        releaseDate: season.releaseDate
          ? dayjs(season.releaseDate).toDate()
          : null,
        tagline: season.tagline,
        year:
          season.year ??
          (season.releaseDate ? dayjs(season.releaseDate).year() : null),
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        season.identifiers,
        now,
      ),
      artwork: season.artwork
        .filter((art) => isNonEmptyString(art.path))
        .map(
          (art) =>
            ({
              uuid: v4(),
              groupingId,
              artworkType: art.type,
              createdAt: new Date(now),
              updatedAt: new Date(now),
              sourcePath: art.path!,
            }) satisfies NewArtwork,
        ),
      credits: [],
      genres: seq.collect(season.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(season.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(season.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintMusicAlbum(
    mediaSource: MediaSourceOrm,
    mediaSourceLibrary: MediaSourceLibraryOrm,
    album: MediaSourceMusicAlbum,
  ): NewProgramGroupingWithRelations<'album'> {
    const now = +dayjs();
    const groupingId = v4();
    return {
      programGrouping: {
        uuid: groupingId,
        type: ProgramGroupingType.Album,
        createdAt: now,
        updatedAt: now,
        index: album.index,
        title: album.title,
        summary: album.summary,
        libraryId: mediaSourceLibrary.uuid,
        canonicalId: album.canonicalId,
        sourceType: mediaSource.type,
        mediaSourceId: mediaSource.uuid,
        externalKey: album.externalId,
        plot: album.plot,
        releaseDate: album.releaseDate
          ? dayjs(album.releaseDate).toDate()
          : null,
        tagline: album.tagline,
        year:
          album.year ??
          (album.releaseDate ? dayjs(album.releaseDate).year() : null),
        artistUuid: album.artist?.uuid,
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        album.identifiers,
        now,
      ),
      artwork: album.artwork
        .filter((art) => isNonEmptyString(art.path))
        .map(
          (art) =>
            ({
              uuid: v4(),
              groupingId,
              artworkType: art.type,
              createdAt: new Date(now),
              updatedAt: new Date(now),
              sourcePath: art.path!,
            }) satisfies NewArtwork,
        ),
      credits: [],
      genres: seq.collect(album.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(album.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(album.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintExternalIdsFromIdentifiers(
    mediaSource: MediaSourceOrm,
    groupingId: string,
    identifiers: Nilable<Identifier[]>,
    now: number = +dayjs(),
  ) {
    const seen = new Set<string>();
    return seq.collect(identifiers, (id) => {
      if (isNonEmptyString(id.id) && isValidSingleExternalIdType(id.type)) {
        // Deduplicate single-type external IDs by sourceType to avoid
        // unique constraint violations on (group_uuid, source_type).
        if (seen.has(id.type)) {
          return;
        }
        seen.add(id.type);
        return {
          type: 'single',
          externalKey: id.id,
          groupUuid: groupingId,
          sourceType: id.type,
          uuid: v4(),
          createdAt: now,
          updatedAt: now,
        } satisfies NewSingleOrMultiProgramGroupingExternalId;
      } else if (isValidMultiExternalIdType(id.type)) {
        // Deduplicate multi-type external IDs by sourceType|mediaSourceId.
        const key = `${id.type}|${mediaSource.uuid}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        return {
          type: 'multi',
          externalKey: id.id,
          groupUuid: groupingId,
          sourceType: id.type,
          uuid: v4(),
          createdAt: now,
          updatedAt: now,
          externalSourceId: mediaSource.name, // legacy
          mediaSourceId: mediaSource.uuid, // new
        } satisfies NewSingleOrMultiProgramGroupingExternalId;
      }

      return;
    });
  }
}
