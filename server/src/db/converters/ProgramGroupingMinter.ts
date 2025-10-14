import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { NewSingleOrMultiProgramGroupingExternalId } from '@/db/schema/ProgramGroupingExternalId.js';
import { isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import {
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
import { MediaSourceId, MediaSourceName } from '../schema/base.js';
import { NewProgramGroupingWithRelations } from '../schema/derivedTypes.js';
import {
  MediaSourceLibraryOrm,
  MediaSourceOrm,
} from '../schema/MediaSource.ts';
import {
  ProgramGroupingType,
  type NewProgramGrouping,
} from '../schema/ProgramGrouping.ts';

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
    const now = +dayjs();
    const groupingId = v4();

    return {
      programGrouping: {
        uuid: groupingId,
        type: ProgramGroupingType.Show,
        createdAt: now,
        updatedAt: now,
        // index: show.index,
        title: show.title,
        summary: show.summary ?? show.plot,
        year: show.year,
        libraryId: mediaSourceLibrary.uuid,
        canonicalId: show.canonicalId,
        sourceType: mediaSource.type,
        mediaSourceId: mediaSource.uuid,
        externalKey: show.externalId,
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        show.identifiers,
        now,
      ),
      artwork: [],
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
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        artist.identifiers,
        now,
      ),
      artwork: [],
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
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        season.identifiers,
        now,
      ),
      artwork: [],
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
      },
      externalIds: this.mintExternalIdsFromIdentifiers(
        mediaSource,
        groupingId,
        album.identifiers,
        now,
      ),
      artwork: [],
    };
  }

  mintExternalIdsFromIdentifiers(
    mediaSource: MediaSourceOrm,
    groupingId: string,
    identifiers: Nilable<Identifier[]>,
    now: number = +dayjs(),
  ) {
    return seq.collect(identifiers, (id) => {
      if (isNonEmptyString(id.id) && isValidSingleExternalIdType(id.type)) {
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
