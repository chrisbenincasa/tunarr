import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { NewSingleOrMultiProgramGroupingExternalId } from '@/db/schema/ProgramGroupingExternalId.js';
import { isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import type { ContentProgram } from '@tunarr/types';
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
  MediaSourceSeason,
  MediaSourceShow,
} from '../../types/Media.ts';
import type { Nullable } from '../../types/util.ts';
import { MediaSourceId, MediaSourceName } from '../schema/base.ts';
import {
  NewMusicAlbum,
  NewMusicArtist,
  NewProgramGroupingWithExternalIds,
  NewTvSeason,
  NewTvShow,
} from '../schema/derivedTypes.js';
import { MediaSource, MediaSourceLibrary } from '../schema/MediaSource.ts';
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

    if (!item.canonicalId || !item.libraryId) {
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
    };
  }

  static mintParentGrouping(
    item: MarkRequired<ContentProgram, 'parent'>,
  ): Nullable<NewProgramGrouping> {
    if (item.subtype === 'movie') {
      return null;
    }

    if (!item.canonicalId || !item.libraryId) {
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
    } satisfies NewProgramGrouping;
  }

  mintForMediaSourceShow(
    mediaSource: MediaSource,
    mediaSourceLibrary: MediaSourceLibrary,
    show: MediaSourceShow,
  ): NewTvShow {
    const now = +dayjs();
    const groupingId = v4();

    const externalIds = seq.collect(show.identifiers, (id) => {
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

    return {
      uuid: groupingId,
      type: ProgramGroupingType.Show,
      createdAt: now,
      updatedAt: now,
      // index: show.index,
      title: show.title,
      summary: show.summary,
      year: show.year,
      libraryId: mediaSourceLibrary.uuid,
      canonicalId: show.canonicalId,
      externalIds,
    } satisfies NewProgramGroupingWithExternalIds;
  }

  mintForMediaSourceArtist(
    mediaSource: MediaSource,
    mediaSourceLibrary: MediaSourceLibrary,
    artist: MediaSourceMusicArtist,
  ): NewMusicArtist {
    const now = +dayjs();
    const groupingId = v4();

    const externalIds = seq.collect(artist.identifiers, (id) => {
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

    return {
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
      externalIds,
    } satisfies NewMusicArtist;
  }

  mintSeason(
    mediaSource: MediaSource,
    mediaSourceLibrary: MediaSourceLibrary,
    season: MediaSourceSeason,
  ): NewTvSeason {
    const now = +dayjs();
    const groupingId = v4();

    const externalIds = seq.collect(season.identifiers, (id) => {
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

    return {
      uuid: groupingId,
      type: ProgramGroupingType.Season,
      createdAt: now,
      updatedAt: now,
      index: season.index,
      title: season.title,
      summary: season.summary,
      libraryId: mediaSourceLibrary.uuid,
      canonicalId: season.canonicalId,
      externalIds,
    } satisfies NewProgramGroupingWithExternalIds;
  }

  mintMusicAlbum(
    mediaSource: MediaSource,
    mediaSourceLibrary: MediaSourceLibrary,
    album: MediaSourceMusicAlbum,
  ): NewMusicAlbum {
    const now = +dayjs();
    const groupingId = v4();

    const externalIds = seq.collect(album.identifiers, (id) => {
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

    return {
      uuid: groupingId,
      type: ProgramGroupingType.Album,
      createdAt: now,
      updatedAt: now,
      index: album.index,
      title: album.title,
      summary: album.summary,
      libraryId: mediaSourceLibrary.uuid,
      canonicalId: album.canonicalId,
      externalIds,
    } satisfies NewMusicAlbum;
  }
}
