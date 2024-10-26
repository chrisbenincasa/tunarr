import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexEpisode, PlexMusicTrack } from '@tunarr/types/plex';
import { ContentProgramOriginalProgram } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { find } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { v4 } from 'uuid';
import { isNonEmptyString } from '../../util/index.ts';
import { ProgramExternalIdType } from '../custom_types/ProgramExternalIdType.ts';
import type { NewProgramGrouping } from '../direct/schema/ProgramGrouping.d.ts';
import type { NewProgramGroupingExternalId } from '../direct/schema/ProgramGroupingExternalId.d.ts';
import { ProgramGroupingType } from '../entities/ProgramGrouping.ts';

type MintedProgramGrouping = {
  grouping: NewProgramGrouping;
  externalIds: NewProgramGroupingExternalId[];
};

type MintedProgramGroupingResult = {
  parent: MintedProgramGrouping;
  grandparent: MintedProgramGrouping;
};

export class ProgramGroupingMinter {
  static mintParentGrouping(item: ContentProgramOriginalProgram) {
    return match(item)
      .with(
        { sourceType: 'plex', program: { type: P.union('episode', 'track') } },
        ({ program }) => this.mintParentProgramGroupingForPlex(program),
      )
      .with({ sourceType: 'jellyfin' }, ({ program }) =>
        this.mintParentProgramGroupingForJellyfin(program),
      )
      .otherwise(() => null);
  }

  static mintParentProgramGroupingForPlex(
    plexItem: PlexEpisode | PlexMusicTrack,
  ): NewProgramGrouping {
    const now = +dayjs();

    return {
      uuid: v4(),
      type:
        plexItem.type === 'episode'
          ? ProgramGroupingType.TvShowSeason
          : ProgramGroupingType.MusicAlbum,
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
          ? ProgramGroupingType.TvShowSeason
          : ProgramGroupingType.MusicAlbum,
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
    item: ContentProgramOriginalProgram,
    groupingId: string,
    externalSourceId: string,
    relationType: 'parent' | 'grandparent',
  ) {
    return match(item)
      .with(
        { sourceType: 'plex', program: { type: P.union('episode', 'track') } },
        ({ program }) =>
          this.mintGroupingExternalIdsForPlex(
            program,
            groupingId,
            externalSourceId,
            relationType,
          ),
      )
      .with({ sourceType: 'jellyfin' }, ({ program }) =>
        this.mintGroupingExternalIdsForJellyfin(
          program,
          groupingId,
          externalSourceId,
          relationType,
        ),
      )
      .otherwise(() => []);
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

  static mintGrandparentGrouping(item: ContentProgramOriginalProgram) {
    return match(item)
      .with(
        { sourceType: 'plex', program: { type: P.union('episode', 'track') } },
        ({ program }) => this.mintGrandparentGroupingForPlex(program),
      )
      .with({ sourceType: 'jellyfin' }, ({ program }) =>
        this.mintGrandparentGroupingForJellyfin(program),
      )
      .otherwise(() => null);
  }

  static mintGrandparentGroupingForPlex(
    plexItem: PlexEpisode | PlexMusicTrack,
  ) {
    const now = +dayjs();
    return {
      uuid: v4(),
      type:
        plexItem.type === 'episode'
          ? ProgramGroupingType.TvShow
          : ProgramGroupingType.MusicArtist,
      createdAt: now,
      updatedAt: now,
      index: null,
      title: plexItem.grandparentTitle ?? '',
      summary: null,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: null,
    };
  }

  static mintGrandparentGroupingForJellyfin(jellyfinItem: JellyfinItem) {
    if (jellyfinItem.Type !== 'Episode' && jellyfinItem.Type !== 'Audio') {
      return null;
    }

    const now = +dayjs();
    return {
      uuid: v4(),
      type:
        jellyfinItem.Type === 'Episode'
          ? ProgramGroupingType.TvShow
          : ProgramGroupingType.MusicArtist,
      createdAt: now,
      updatedAt: now,
      index: null,
      title: jellyfinItem.SeriesName ?? jellyfinItem.AlbumArtist ?? '',
      summary: null,
      icon: null,
      artistUuid: null,
      showUuid: null,
      year: null,
    };
  }

  static mintRawProgramGroupingForPlex(
    plexItem: PlexEpisode | PlexMusicTrack,
    externalSourceId: string,
  ): MintedProgramGroupingResult {
    const parentItem = this.mintParentProgramGroupingForPlex(plexItem);
    const parentExternalIds = this.mintGroupingExternalIdsForPlex(
      plexItem,
      parentItem.uuid,
      externalSourceId,
      'parent',
    );

    const grandparentItem = this.mintGrandparentGroupingForPlex(plexItem);

    const grandparentExternalIds = this.mintGroupingExternalIdsForPlex(
      plexItem,
      grandparentItem.uuid,
      externalSourceId,
      'grandparent',
    );

    return {
      parent: {
        grouping: parentItem,
        externalIds: parentExternalIds,
      },
      grandparent: {
        grouping: grandparentItem,
        externalIds: grandparentExternalIds,
      },
    };
  }
}
