import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { NewProgramGroupingExternalId } from '@/db/schema/ProgramGroupingExternalId.js';
import { isNonEmptyString } from '@/util/index.js';
import type { ContentProgram } from '@tunarr/types';
import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type { PlexEpisode, PlexMusicTrack } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { find, first } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import { P, match } from 'ts-pattern';
import { v4 } from 'uuid';
import type { Nullable } from '../../types/util.ts';
import {
  ProgramGroupingType,
  type NewProgramGrouping,
} from '../schema/ProgramGrouping.ts';

export class ProgramGroupingMinter {
  static mintParentProgramGroupingForPlex(
    plexItem: PlexEpisode | PlexMusicTrack,
  ): NewProgramGrouping {
    const now = +dayjs();

    return {
      uuid: v4(),
      type:
        plexItem.type === 'episode'
          ? ProgramGroupingType.Season
          : ProgramGroupingType.Album,
      createdAt: now,
      updatedAt: now,
      index: plexItem.parentIndex ?? null,
      title: plexItem.parentTitle ?? '',
      summary: null,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: null,
    };
  }

  static mintParentProgramGroupingForJellyfin(jellyfinItem: JellyfinItem) {
    if (jellyfinItem.Type !== 'Episode' && jellyfinItem.Type !== 'Audio') {
      return null;
    }

    const now = +dayjs();

    return {
      uuid: v4(),
      type:
        jellyfinItem.Type === 'Episode'
          ? ProgramGroupingType.Show
          : ProgramGroupingType.Album,
      createdAt: now,
      updatedAt: now,
      index: jellyfinItem.ParentIndexNumber ?? null,
      title: jellyfinItem.SeasonName ?? jellyfinItem.Album ?? '',
      summary: null,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: jellyfinItem.ProductionYear,
    } satisfies NewProgramGrouping;
  }

  static mintGroupingExternalIds(
    program: ContentProgram,
    groupingId: string,
    externalSourceId: string,
    relationType: 'parent' | 'grandparent',
  ): NewProgramGroupingExternalId[] {
    if (program.subtype === 'movie') {
      return [];
    }

    const now = +dayjs();
    const parentExternalIds: NewProgramGroupingExternalId[] = [];

    const ratingKey =
      relationType === 'grandparent'
        ? program.grandparent?.externalKey
        : program.parent?.externalKey;
    if (isNonEmptyString(ratingKey)) {
      parentExternalIds.push({
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalFilePath: null,
        externalKey: ratingKey,
        sourceType: ProgramExternalIdType.PLEX,
        externalSourceId,
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
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalFilePath: null,
        externalKey: guid,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        externalSourceId: null,
        groupUuid: groupingId,
      });
    }

    return parentExternalIds;
  }

  static mintGroupingExternalIdsForPlex(
    plexItem: PlexEpisode | PlexMusicTrack,
    groupingId: string,
    externalSourceId: string,
    relationType: 'parent' | 'grandparent',
  ): NewProgramGroupingExternalId[] {
    const now = +dayjs();
    const parentExternalIds: NewProgramGroupingExternalId[] = [];

    const ratingKey = plexItem[`${relationType}RatingKey`];
    if (isNonEmptyString(ratingKey)) {
      parentExternalIds.push({
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalFilePath: null,
        externalKey: ratingKey,
        sourceType: ProgramExternalIdType.PLEX,
        externalSourceId,
        groupUuid: groupingId,
      });
    }

    const guid = plexItem[`${relationType}Guid`];
    if (isNonEmptyString(guid)) {
      parentExternalIds.push({
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalFilePath: null,
        externalKey: guid,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        externalSourceId: null,
        groupUuid: groupingId,
      });
    }

    return parentExternalIds;
  }

  static mintGroupingExternalIdsForJellyfin(
    jellyfinItem: JellyfinItem,
    groupingId: string,
    externalSourceId: string,
    relationType: 'parent' | 'grandparent',
  ): NewProgramGroupingExternalId[] {
    const now = +dayjs();
    const parentExternalIds: NewProgramGroupingExternalId[] = [];

    const jellyfinId = match([jellyfinItem, relationType] as const)
      .with([{ Type: 'Episode' }, 'grandparent'], () => jellyfinItem.SeriesId)
      .with(
        [{ Type: 'Audio' }, 'parent'],
        () =>
          find(jellyfinItem.AlbumArtists, { Name: jellyfinItem.AlbumArtist })
            ?.Id,
      )
      .with([P._, 'parent'], () => jellyfinItem.ParentId)
      .otherwise(() => null);

    if (isNonEmptyString(jellyfinId)) {
      parentExternalIds.push({
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalFilePath: null,
        externalKey: jellyfinId,
        sourceType: ProgramExternalIdType.JELLYFIN,
        externalSourceId,
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
      summary: null,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: item.grandparent.year,
    };
  }

  static mintParentGrouping(
    item: MarkRequired<ContentProgram, 'parent'>,
  ): Nullable<NewProgramGrouping> {
    if (item.subtype === 'movie') {
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
      index: item.parent.index,
      title: item.parent.title ?? '',
      summary: null,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: item.parent.year,
    } satisfies NewProgramGrouping;
  }
}
