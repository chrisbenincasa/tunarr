import type { NewSingleOrMultiProgramGroupingExternalId } from '@/db/schema/ProgramGroupingExternalId.js';
import { isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import {
  Actor,
  EpisodeWithHierarchy,
  MusicTrackWithHierarchy,
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
import { v4 } from 'uuid';
import {
  MediaSourceMusicAlbum,
  MediaSourceMusicArtist,
} from '../../types/Media.ts';
import type { Nilable, Nullable } from '../../types/util.ts';
import { NewArtwork } from '../schema/Artwork.ts';
import { NewCredit } from '../schema/Credit.ts';
import {
  NewCreditWithArtwork,
  NewProgramGroupingWithRelations,
} from '../schema/derivedTypes.js';
import { MediaSourceOrm } from '../schema/MediaSource.ts';
import { MediaSourceLibraryOrm } from '../schema/MediaSourceLibrary.ts';
import { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import { CommonDaoMinter } from './CommonDaoMinter.ts';

@injectable()
export class ProgramGroupingMinter {
  constructor() {}

  mintGrandparentGrouping(
    item: EpisodeWithHierarchy | MusicTrackWithHierarchy,
    mediaSource: MediaSourceOrm,
    mediaSourceLibrary: MediaSourceLibraryOrm,
  ): Nullable<NewProgramGroupingWithRelations> {
    if (item.type === 'episode') {
      return this.mintForMediaSourceShow(
        mediaSource,
        mediaSourceLibrary,
        item.show ?? item.season.show,
      );
    } else if (item.type === 'track') {
      return this.mintForMediaSourceArtist(
        mediaSource,
        mediaSourceLibrary,
        item.artist ?? item.album.artist,
      );
    }

    return null;
  }

  mintParentGrouping(
    item: EpisodeWithHierarchy | MusicTrackWithHierarchy,
    mediaSource: MediaSourceOrm,
    mediaSourceLibrary: MediaSourceLibraryOrm,
  ): Nullable<NewProgramGroupingWithRelations> {
    if (item.type === 'episode') {
      return this.mintSeason(mediaSource, mediaSourceLibrary, item.season);
    } else if (item.type === 'track') {
      return this.mintMusicAlbum(mediaSource, mediaSourceLibrary, item.album);
    }

    return null;
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
          // externalSourceId: mediaSource.name, // legacy
          mediaSourceId: mediaSource.uuid, // new
        } satisfies NewSingleOrMultiProgramGroupingExternalId;
      }

      return;
    });
  }
}
