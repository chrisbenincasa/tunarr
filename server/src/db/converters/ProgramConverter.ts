import { KEYS } from '@/types/inject.js';
import { isNonEmptyString, nullToUndefined } from '@/util/index.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import type {
  Actor,
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
} from '@tunarr/types';
import { untag } from '@tunarr/types';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { first, isNil, orderBy } from 'lodash-es';
import { isPromise } from 'node:util/types';
import type { DeepPartial, MarkRequired } from 'ts-essentials';
import { ApiProgramConverters } from '../../api/ApiProgramConverters.ts';
import type { MediaLocation } from '../../types/Media.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import type { OfflineItem, RedirectItem } from '../derived_types/Lineup.js';
import type { Channel, ChannelOrm } from '../schema/Channel.ts';
import type { DB } from '../schema/db.ts';
import type {
  ChannelOrmWithRelations,
  ChannelWithRelations,
  GeneralizedProgramGroupingWithExternalIds,
  MediaSourceWithRelations,
  MusicAlbumWithExternalIds,
  MusicArtistWithExternalIds,
  ProgramOrmWithExternalIds,
  ProgramWithRelationsOrm,
  TvSeasonWithExternalIds,
  TvShowWithExternalIds,
} from '../schema/derivedTypes.ts';
import type { MediaSourceLibrary } from '../schema/MediaSourceLibrary.ts';
import type { ProgramChapterType } from '../schema/ProgramChapter.ts';

function chapterTypeOrder(chapterType: ProgramChapterType) {
  switch (chapterType) {
    case 'chapter':
      return 0;
    case 'intro':
      return 1;
    case 'outro':
      return 2;
  }
}

/**
 * Converts DB types to API types
 */
@injectable()
export class ProgramConverter {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(@inject(KEYS.Database) private db: Kysely<DB>) {}

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

    let typed: TerminalProgram;
    switch (program.type) {
      case 'movie':
        typed = {
          ...base,
          type: 'movie',
          plot: program.summary,
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
        } satisfies Movie;
        break;
      case 'episode':
        typed = {
          ...base,
          type: 'episode' as const,
          summary: program.summary,
          episodeNumber: program.episode ?? 0,
        } satisfies Episode;
        break;
      case 'track':
        typed = {
          ...base,
          type: 'track',
          trackNumber: program.episode ?? 0,
        };
        break;
      case 'music_video':
        typed = { ...base, type: 'music_video' };
        break;
      case 'other_video':
        typed = { ...base, type: 'other_video' };
        break;
    }

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
          (c) => [chapterTypeOrder(c.chapterType), c.index],
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

  programOrmToContentProgram(
    program: ProgramOrmWithExternalIds,
    mediaSource?: MediaSourceWithRelations,
    mediaLibrary?: MediaSourceLibrary,
  ): MarkRequired<ContentProgram, 'id'> | null {
    if (!program.mediaSourceId) {
      return null;
    }

    const convertedProgram = ApiProgramConverters.convertProgram(
      program,
      undefined,
      mediaSource,
      mediaLibrary,
    );

    if (!convertedProgram) {
      // TODO: log
      return null;
    }

    return this.materializedProgramToContentProgram(convertedProgram);
  }

  materializedProgramToContentProgram(
    program: TerminalProgram,
  ): MarkRequired<ContentProgram, 'id'> {
    return {
      type: 'content',
      duration: program.duration,
      id: program.uuid,
      program,
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
  ): FlexProgram {
    return {
      type: 'flex',
      icon: channel.icon?.path,
      duration: program.durationMs,
      // Carries the mid-roll marker (and any filler list restrictions) through
      // to the API. Without it, a lazy mid-roll break is indistinguishable
      // from ordinary flex once it leaves the lineup file.
      fillerConfig: program.fillerConfig,
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
      type: 'redirect',
      channel: item.channel,
      channelName: channel.name,
      channelNumber: channel.number,
      duration: item.durationMs,
    };
  }
}
