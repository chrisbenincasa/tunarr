import { ProgramType } from '@/db/schema/Program.js';
import { MinimalProgramExternalId } from '@/db/schema/ProgramExternalId.js';
import { ProgramGroupingExternalId } from '@/db/schema/ProgramGroupingExternalId.js';
import { KEYS } from '@/types/inject.js';
import { isNonEmptyString, nullToUndefined } from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import {
  Actor,
  ChannelProgram,
  ContentProgram,
  ContentProgramParent,
  Episode,
  ExternalId,
  FlexProgram,
  Identifier,
  MediaArtwork,
  MediaItem,
  MediaStream,
  Movie,
  MusicAlbumContentProgram,
  MusicArtistContentProgram,
  RedirectProgram,
  TerminalProgram,
  TvSeasonContentProgram,
  TvShowContentProgram,
  untag,
} from '@tunarr/types';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { find, first, isNil, omitBy, orderBy } from 'lodash-es';
import { isPromise } from 'node:util/types';
import { DeepNullable, DeepPartial, MarkRequired } from 'ts-essentials';
import { match } from 'ts-pattern';
import { MediaLocation } from '../../types/Media.ts';
import { MarkNonNullable } from '../../types/util.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import {
  LineupItem,
  OfflineItem,
  RedirectItem,
  isOfflineItem,
  isRedirectItem,
} from '../derived_types/Lineup.js';
import { Channel, ChannelOrm } from '../schema/Channel.ts';
import { DB } from '../schema/db.ts';
import type {
  ChannelOrmWithPrograms,
  ChannelOrmWithRelations,
  ChannelWithPrograms,
  ChannelWithRelations,
  GeneralizedProgramGroupingWithExternalIds,
  MusicAlbumWithExternalIds,
  MusicArtistWithExternalIds,
  ProgramWithRelations,
  ProgramWithRelationsOrm,
  TvSeasonWithExternalIds,
  TvShowWithExternalIds,
} from '../schema/derivedTypes.ts';

/**
 * Converts DB types to API types
 */
@injectable()
export class ProgramConverter {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
  ) {}

  lineupItemToChannelProgramOrm(
    channel: ChannelOrmWithRelations,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<ChannelOrm>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelationsOrm,
  ): ChannelProgram | null;
  lineupItemToChannelProgramOrm(
    channel: ChannelOrmWithPrograms,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<ChannelOrm>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelationsOrm,
  ): ChannelProgram | null;
  lineupItemToChannelProgramOrm(
    channel: ChannelOrmWithRelations | ChannelOrmWithPrograms,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<ChannelOrm>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelationsOrm,
  ): ChannelProgram | null {
    if (isOfflineItem(item)) {
      return this.offlineLineupItemToProgram(channel, item);
    } else if (isRedirectItem(item)) {
      const redirectChannel = find(channelReferences, { uuid: item.channel });
      if (isNil(redirectChannel)) {
        this.logger.warn(
          'Dangling redirect channel reference. Source channel = %s, target channel = %s',
          channel.uuid,
          item.channel,
        );
        return this.offlineLineupItemToProgram(channel, {
          type: 'offline',
          durationMs: item.durationMs,
        });
      }
      return this.redirectLineupItemToProgram(item, redirectChannel);
    } else if (item.type === 'content') {
      const program =
        preMaterializedProgram && preMaterializedProgram.uuid === item.id
          ? preMaterializedProgram
          : channel.programs?.find((p) => p.uuid === item.id);
      if (isNil(program) || isNil(program.mediaSourceId)) {
        return null;
      }

      return this.programOrmToContentProgram(
        program,
        program.externalIds ?? [], // TODO fill in external IDs here
      );
    }

    return null;
  }

  lineupItemToChannelProgram(
    channel: ChannelWithRelations,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<Channel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelations,
  ): ChannelProgram | null;
  lineupItemToChannelProgram(
    channel: ChannelWithPrograms,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<Channel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelations,
  ): ChannelProgram | null;
  lineupItemToChannelProgram(
    channel: ChannelWithRelations | ChannelWithPrograms,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<Channel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelations,
  ): ChannelProgram | null {
    if (isOfflineItem(item)) {
      return this.offlineLineupItemToProgram(channel, item);
    } else if (isRedirectItem(item)) {
      const redirectChannel = find(channelReferences, { uuid: item.channel });
      if (isNil(redirectChannel)) {
        this.logger.warn(
          'Dangling redirect channel reference. Source channel = %s, target channel = %s',
          channel.uuid,
          item.channel,
        );
        return this.offlineLineupItemToProgram(channel, {
          type: 'offline',
          durationMs: item.durationMs,
        });
      }
      return this.redirectLineupItemToProgram(item, redirectChannel);
    } else if (item.type === 'content') {
      const program =
        preMaterializedProgram && preMaterializedProgram.uuid === item.id
          ? preMaterializedProgram
          : channel.programs?.find((p) => p.uuid === item.id);
      if (isNil(program) || isNil(program.mediaSourceId)) {
        return null;
      }

      return this.programDaoToContentProgram(
        program,
        program.externalIds ?? [], // TODO fill in external IDs here
      );
    }

    return null;
  }

  programDaoToTerminalProgram(
    program: ProgramWithRelationsOrm,
  ): TerminalProgram | null {
    if (
      !program.mediaSourceId ||
      !program.externalIds ||
      !program.canonicalId ||
      !program.libraryId
    ) {
      this.logger.error(
        'Program missing critical fields. Aborting: %O',
        program,
      );
      return null;
    }

    const base = {
      rating: program.rating,
      summary: program.summary,
      title: program.title,
      year: program.year,
      duration: program.duration,
      uuid: program.uuid,
      sourceType: program.sourceType,
      sortTitle: titleToSortTitle(program.title),
      type: program.type,
      mediaSourceId: untag(program.mediaSourceId)!,
      canonicalId: program.canonicalId,
      libraryId: program.libraryId,
      externalId: program.externalKey,
      identifiers: program.externalIds.map(
        (eid) =>
          ({
            id: eid.externalKey,
            type: eid.sourceType,
            sourceId: eid.externalSourceId ?? undefined,
          }) satisfies Identifier,
      ),
      tags: [],
      originalTitle: null,
      releaseDate: program.originalAirDate
        ? +dayjs(program.originalAirDate)
        : null,
      releaseDateString: program.originalAirDate,
      actors: orderBy(
        program.credits?.filter((credit) => credit.type === 'cast'),
        (c, idx) => c.index ?? idx,
        'asc',
      ).map(
        (credit, idx) =>
          ({
            name: credit.name,
            order: idx,
            role: credit.role,
          }) satisfies Actor,
      ),
      artwork:
        program.artwork?.map(
          (art) =>
            ({
              id: art.uuid,
              type: art.artworkType,
            }) satisfies MediaArtwork,
        ) ?? [],
      state: program.state,
    } satisfies Partial<TerminalProgram>;

    const typed = match(program)
      .returnType<TerminalProgram>()
      .with(
        { type: 'movie' },
        (movie) =>
          ({
            ...base,
            type: 'movie',
            plot: movie.summary,
            tagline: null,
            writers:
              program.credits
                ?.filter((c) => c.type === 'writer')
                .map((writer) => ({
                  name: writer.name,
                })) ?? [],
            directors:
              program.credits
                ?.filter((c) => c.type === 'director')
                .map((director) => ({
                  name: director.name,
                })) ?? [],
          }) satisfies Movie,
      )
      .with(
        { type: 'episode' },
        (episode) =>
          ({
            ...base,
            type: 'episode' as const,
            summary: episode.summary,
            episodeNumber: episode.episode ?? 0,
          }) satisfies Episode,
      )
      .with({ type: 'track' }, (track) => ({
        ...base,
        type: 'track',
        trackNumber: track.episode ?? 0,
      }))
      .with({ type: 'music_video' }, () => ({ ...base, type: 'music_video' }))
      .with({ type: 'other_video' }, () => ({ ...base, type: 'other_video' }))
      .exhaustive();

    const version = first(program.versions);
    if (version) {
      typed.mediaItem = {
        ...version,
        streams: orderBy(
          version.mediaStreams?.map(
            (stream) =>
              ({
                ...stream,
                default: stream.default,
                streamType: stream.streamKind,
              }) satisfies MediaStream,
          ) ?? [],
          'index',
          'asc',
        ),
        chapters: orderBy(
          version.chapters,
          (c) => [
            match(c.chapterType)
              .with('chapter', () => 0)
              .with('intro', () => 1)
              .with('outro', () => 2)
              .exhaustive(),
            c.index,
          ],
          ['asc', 'asc'],
        ),
        locations:
          version.mediaFiles?.map(
            (file) =>
              ({
                type: 'local',
                path: file.path,
              }) satisfies MediaLocation,
          ) ?? [],
      } satisfies MediaItem;
    }

    return typed;
  }

  programDaoToContentProgram(
    program: MarkNonNullable<ProgramWithRelations, 'mediaSourceId'>,
    externalIds?: MinimalProgramExternalId[],
  ): MarkRequired<ContentProgram, 'id'>;
  programDaoToContentProgram(
    program: ProgramWithRelations,
    externalIds?: MinimalProgramExternalId[],
  ): MarkRequired<ContentProgram, 'id'> | null;
  programDaoToContentProgram(
    program:
      | ProgramWithRelations
      | MarkNonNullable<ProgramWithRelations, 'mediaSourceId'>,
    externalIds: MinimalProgramExternalId[] = program.externalIds ?? [],
  ): MarkRequired<ContentProgram, 'id'> | null {
    if (!program.mediaSourceId) {
      return null;
    }

    let extraFields: Partial<ContentProgram> = {};
    if (program.type === ProgramType.Episode) {
      extraFields = {
        ...extraFields,
        icon: nullToUndefined(program.episodeIcon ?? program.showIcon),
        showId: nullToUndefined(program.tvShow?.uuid ?? program.tvShowUuid),
        seasonId: nullToUndefined(program.tvSeason?.uuid ?? program.seasonUuid),
        // Fallback to the denormalized field, for now
        seasonNumber: nullToUndefined(
          program.tvSeason?.index ?? program.seasonNumber,
        ),
        episodeNumber: nullToUndefined(program.episode),
        title: program.title,
        parent: {
          type: 'season',
          id: nullToUndefined(program.tvSeason?.uuid ?? program.seasonUuid),
          index: nullToUndefined(program.tvSeason?.index),
          title: nullToUndefined(program.tvSeason?.title ?? program.showTitle),
          year: nullToUndefined(program.tvSeason?.year),
          externalKey: nullToUndefined(
            find(
              program.tvSeason?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          externalIds: seq.collect(program.tvSeason?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        grandparent: {
          type: 'show',
          id: nullToUndefined(program.tvShow?.uuid ?? program.tvShowUuid),
          index: nullToUndefined(program.tvShow?.index),
          title: nullToUndefined(program.tvShow?.title),
          externalKey: nullToUndefined(
            find(
              program.tvShow?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.tvShow?.year),
          externalIds: seq.collect(program.tvShow?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        index: nullToUndefined(program.episode),
      };
    } else if (program.type === ProgramType.Track.toString()) {
      extraFields = {
        parent: {
          type: 'album',
          id: nullToUndefined(program.trackAlbum?.uuid ?? program.albumUuid),
          index: nullToUndefined(program.trackAlbum?.index),
          title: nullToUndefined(
            program.albumName ?? program.trackAlbum?.title,
          ),
          externalKey: nullToUndefined(
            find(
              program.trackAlbum?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.trackAlbum?.year),
          externalIds: seq.collect(program.trackAlbum?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        grandparent: {
          type: 'artist',
          id: nullToUndefined(program.trackArtist?.uuid ?? program.artistUuid),
          index: nullToUndefined(program.trackArtist?.index),
          title: nullToUndefined(program.trackArtist?.title),
          externalKey: nullToUndefined(
            find(
              program.trackArtist?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.trackArtist?.year),
          externalIds: seq.collect(program.trackArtist?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        albumId: nullToUndefined(program.trackAlbum?.uuid ?? program.albumUuid),
        artistId: nullToUndefined(
          program.trackArtist?.uuid ?? program.artistUuid,
        ),
        // HACK: Tracks save their index under the episode field
        index: nullToUndefined(program.episode),
      };
    }

    return {
      persisted: true, // Explicit since we're dealing with db loaded entities
      uniqueId: program.uuid,
      summary: nullToUndefined(program.summary),
      date: nullToUndefined(program.originalAirDate),
      rating: nullToUndefined(program.rating),
      icon: nullToUndefined(program.icon),
      title: program.title,
      duration: program.duration,
      type: 'content',
      id: program.uuid,
      subtype: program.type,
      externalIds: seq.collect(program.externalIds ?? externalIds, (eid) =>
        this.toExternalId(eid),
      ),
      externalKey: program.externalKey,
      externalSourceId: program.mediaSourceId,
      externalSourceName: program.externalSourceId,
      externalSourceType: program.sourceType,
      canonicalId: nullToUndefined(program.canonicalId),
      ...omitBy(extraFields, isNil),
    };
  }

  // TEMP during migrations
  programOrmToContentProgram(
    program: MarkNonNullable<ProgramWithRelationsOrm, 'mediaSourceId'>,
    externalIds?: MinimalProgramExternalId[],
  ): MarkRequired<ContentProgram, 'id'>;
  programOrmToContentProgram(
    program: ProgramWithRelationsOrm,
    externalIds?: MinimalProgramExternalId[],
  ): MarkRequired<ContentProgram, 'id'> | null;
  programOrmToContentProgram(
    program:
      | ProgramWithRelationsOrm
      | MarkNonNullable<ProgramWithRelationsOrm, 'mediaSourceId'>,
    externalIds: MinimalProgramExternalId[] = program.externalIds ?? [],
  ): MarkRequired<ContentProgram, 'id'> | null {
    if (!program.mediaSourceId) {
      return null;
    }

    let extraFields: Partial<ContentProgram> = {};
    if (program.type === ProgramType.Episode) {
      extraFields = {
        ...extraFields,
        icon: nullToUndefined(program.episodeIcon ?? program.showIcon),
        showId: nullToUndefined(program.show?.uuid ?? program.tvShowUuid),
        seasonId: nullToUndefined(program.season?.uuid ?? program.seasonUuid),
        // Fallback to the denormalized field, for now
        seasonNumber: nullToUndefined(
          program.season?.index ?? program.seasonNumber,
        ),
        episodeNumber: nullToUndefined(program.episode),
        title: program.title,
        parent: {
          type: 'season',
          id: nullToUndefined(program.season?.uuid ?? program.seasonUuid),
          index: nullToUndefined(program.season?.index),
          title: nullToUndefined(program.season?.title ?? program.showTitle),
          year: nullToUndefined(program.season?.year),
          externalKey: nullToUndefined(
            find(
              program.season?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          externalIds: seq.collect(program.season?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        grandparent: {
          type: 'show',
          id: nullToUndefined(program.show?.uuid ?? program.tvShowUuid),
          index: nullToUndefined(program.show?.index),
          title: nullToUndefined(program.show?.title),
          externalKey: nullToUndefined(
            find(
              program.show?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.show?.year),
          externalIds: seq.collect(program.show?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        index: nullToUndefined(program.episode),
      };
    } else if (program.type === ProgramType.Track.toString()) {
      extraFields = {
        parent: {
          type: 'album',
          id: nullToUndefined(program.album?.uuid ?? program.albumUuid),
          index: nullToUndefined(program.album?.index),
          title: nullToUndefined(program.albumName ?? program.album?.title),
          externalKey: nullToUndefined(
            find(
              program.album?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.album?.year),
          externalIds: seq.collect(program.album?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        grandparent: {
          type: 'artist',
          id: nullToUndefined(program.artist?.uuid ?? program.artistUuid),
          index: nullToUndefined(program.artist?.index),
          title: nullToUndefined(program.artist?.title),
          externalKey: nullToUndefined(
            find(
              program.artist?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.artist?.year),
          externalIds: seq.collect(program.artist?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        albumId: nullToUndefined(program.album?.uuid ?? program.albumUuid),
        artistId: nullToUndefined(program.artist?.uuid ?? program.artistUuid),
        // HACK: Tracks save their index under the episode field
        index: nullToUndefined(program.episode),
      };
    }

    return {
      persisted: true, // Explicit since we're dealing with db loaded entities
      uniqueId: program.uuid,
      summary: nullToUndefined(program.summary),
      date: nullToUndefined(program.originalAirDate),
      rating: nullToUndefined(program.rating),
      icon: nullToUndefined(program.icon),
      title: program.title,
      duration: program.duration,
      type: 'content',
      id: program.uuid,
      subtype: program.type,
      externalIds: seq.collect(program.externalIds ?? externalIds, (eid) =>
        this.toExternalId(eid),
      ),
      externalKey: program.externalKey,
      externalSourceId: program.mediaSourceId,
      externalSourceName: program.externalSourceId,
      externalSourceType: program.sourceType,
      canonicalId: nullToUndefined(program.canonicalId),
      ...omitBy(extraFields, isNil),
    };
  }

  programGroupingDaoToDto(program: TvShowWithExternalIds): TvShowContentProgram;
  programGroupingDaoToDto(
    program: TvSeasonWithExternalIds,
  ): TvSeasonContentProgram;
  programGroupingDaoToDto(
    program: MusicArtistWithExternalIds,
  ): MusicArtistContentProgram;
  programGroupingDaoToDto(
    program: MusicAlbumWithExternalIds,
  ): MusicAlbumContentProgram;
  programGroupingDaoToDto(
    program: GeneralizedProgramGroupingWithExternalIds,
  ): ContentProgramParent {
    const base = {
      type: program.type,
      id: program.uuid,
      title: program.title,
      year: nullToUndefined(program.year),
      index: nullToUndefined(program.index),
      summary: nullToUndefined(program.summary),
      externalIds: seq.collect(program.externalIds, (eid) => {
        if (
          isValidMultiExternalIdType(eid.sourceType) &&
          isNonEmptyString(eid.externalSourceId)
        ) {
          return {
            type: 'multi',
            source: eid.sourceType,
            sourceId: eid.mediaSourceId ?? eid.externalSourceId,
            id: eid.externalKey,
          } satisfies ExternalId;
        } else if (isValidSingleExternalIdType(eid.sourceType)) {
          return {
            type: 'single',
            source: eid.sourceType,
            id: eid.externalKey,
          } satisfies ExternalId;
        }

        return;
      }),
    };

    if (program.type === 'show') {
      (base as TvShowContentProgram).seasons = program.seasons?.map((season) =>
        this.programGroupingDaoToDto(season),
      );
      return base;
    }

    return base;
  }

  offlineLineupItemToProgram(
    channel: ChannelWithRelations | ChannelOrmWithRelations,
    program: OfflineItem,
    persisted: boolean = true,
  ): FlexProgram {
    return {
      persisted,
      type: 'flex',
      icon: channel.icon?.path,
      duration: program.durationMs,
    };
  }

  redirectLineupItemToProgram(
    item: RedirectItem,
    channel: MarkRequired<DeepPartial<Channel | ChannelOrm>, 'name' | 'number'>,
  ): RedirectProgram;
  redirectLineupItemToProgram(
    item: RedirectItem,
    channel?: MarkRequired<
      DeepPartial<Channel | ChannelOrm>,
      'name' | 'number'
    >,
  ): Promise<RedirectProgram> | RedirectProgram {
    const loadedChannel = isNil(channel)
      ? this.db
          .selectFrom('channel')
          .select(['uuid', 'number', 'name'])
          .where('uuid', '=', item.channel)
          .executeTakeFirstOrThrow()
      : channel;
    if (isPromise(loadedChannel)) {
      return loadedChannel.then((c) => this.toRedirectChannelInternal(item, c));
    } else {
      return this.toRedirectChannelInternal(item, loadedChannel);
    }
  }

  private toRedirectChannelInternal(
    item: RedirectItem,
    channel: MarkRequired<DeepPartial<Channel | ChannelOrm>, 'name' | 'number'>,
  ): RedirectProgram {
    return {
      persisted: true,
      type: 'redirect',
      channel: item.channel,
      channelName: channel.name,
      channelNumber: channel.number,
      duration: item.durationMs,
    };
  }

  private toExternalId(rawExternalId: MinimalProgramExternalId) {
    if (
      isNonEmptyString(rawExternalId.externalSourceId) &&
      isValidMultiExternalIdType(rawExternalId.sourceType)
    ) {
      return {
        type: 'multi' as const,
        source: rawExternalId.sourceType,
        sourceId: rawExternalId.externalSourceId,
        id: rawExternalId.externalKey,
      };
    } else if (
      isValidSingleExternalIdType(rawExternalId.sourceType) &&
      !isNonEmptyString(rawExternalId.externalSourceId)
    ) {
      return {
        type: 'single' as const,
        source: rawExternalId.sourceType,
        id: rawExternalId.externalKey,
      };
    }

    return;
  }

  private toGroupingExternalId(
    rawExternalId: DeepNullable<ProgramGroupingExternalId>,
  ) {
    if (!rawExternalId.externalKey) {
      return;
    }

    if (
      rawExternalId.sourceType &&
      isNonEmptyString(rawExternalId.externalSourceId) &&
      isValidMultiExternalIdType(rawExternalId.sourceType)
    ) {
      return {
        type: 'multi' as const,
        source: rawExternalId.sourceType,
        sourceId: rawExternalId.externalSourceId,
        id: rawExternalId.externalKey,
      };
    } else if (
      rawExternalId.sourceType &&
      isValidSingleExternalIdType(rawExternalId.sourceType) &&
      !isNonEmptyString(rawExternalId.externalSourceId)
    ) {
      return {
        type: 'single' as const,
        source: rawExternalId.sourceType,
        id: rawExternalId.externalKey,
      };
    }

    return;
  }
}
