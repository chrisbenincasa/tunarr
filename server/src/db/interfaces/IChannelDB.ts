import type {
  Lineup,
  LineupItem,
  PendingProgram,
} from '@/db/derived_types/Lineup.js';
import type { Channel, ChannelOrm } from '@/db/schema/Channel.js';
import type { ProgramExternalId } from '@/db/schema/ProgramExternalId.js';
import type {
  ChannelOrmWithRelations,
  MusicArtistOrm,
  ProgramOrmWithExternalIds,
  ProgramWithRelationsOrm,
  TvShowOrm,
} from '@/db/schema/derivedTypes.js';
import type {
  MarkNullable,
  Maybe,
  Nullable,
  PagedResult,
} from '@/types/util.js';
import type {
  CondensedChannelProgramming,
  SaveableChannel,
} from '@tunarr/types';
import type { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import type { ContentProgramType } from '@tunarr/types/schemas';
import type { MarkOptional, MarkRequired } from 'ts-essentials';
import type { Json } from '../../types/schemas.ts';
import type { ChannelSubtitlePreferences } from '../schema/SubtitlePreferences.ts';

// TODO: I hate this type and it will go away ASAP. This is solely for compat between kysely and drizzle types
export type ChannelAndLineup<ChannelType = ChannelOrm> = {
  channel: ChannelType;
  lineup: Lineup;
};
export type ChannelAndRawLineup = { channel: ChannelOrm; lineup: Json };

export interface IChannelDB {
  channelExists(channelId: string): Promise<boolean>;

  getChannelOrm(
    id: string | number,
  ): Promise<
    Maybe<
      MarkRequired<ChannelOrmWithRelations, 'transcodeConfig' | 'fillerShows'>
    >
  >;

  getChannel(id: string | number): Promise<Maybe<ChannelOrmWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: true,
  ): Promise<Maybe<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>>;
  getChannel(
    id: string | number,
    includeFiller: boolean,
  ): Promise<Maybe<ChannelOrmWithRelations>>;

  getAllChannels(): Promise<ChannelOrm[]>;

  getChannelAndPrograms(
    uuid: string,
    typeFilter?: ContentProgramType,
  ): Promise<Maybe<MarkRequired<ChannelOrmWithRelations, 'programs'>>>;

  getChannelTvShows(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<TvShowOrm>>;

  getChannelMusicArtists(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<MusicArtistOrm>>;

  getChannelPrograms(
    id: string,
    pageParams?: PageParams,
    typeFilter?: ContentProgramType,
  ): Promise<PagedResult<ProgramWithRelationsOrm>>;

  getChannelProgramExternalIds(uuid: string): Promise<ProgramExternalId[]>;

  getChannelFallbackPrograms(
    uuid: string,
  ): Promise<Maybe<ProgramOrmWithExternalIds>>;

  saveChannel(
    createReq: SaveableChannel,
  ): Promise<
    ChannelAndLineup<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>
  >;

  deleteChannel(
    channelId: string,
    blockOnLineupUpdates?: boolean,
  ): Promise<void>;

  updateChannel(
    id: string,
    updateReq: SaveableChannel,
  ): Promise<
    ChannelAndLineup<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>
  >;

  updateChannelDuration(id: string, duration: number): Promise<number>;

  copyChannel(
    id: string,
  ): Promise<
    ChannelAndLineup<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>
  >;

  loadLineup(channelId: string, forceRead?: boolean): Promise<Lineup>;

  loadCondensedLineup(
    channelId: string,
    offset?: number,
    limit?: number,
  ): Promise<CondensedChannelProgramming | null>;

  /**
   * Replace associations between channel and programs completely
   * @param channelId
   * @param programIds
   */
  replaceChannelPrograms(channelId: string, programIds: string[]): void;

  updateLineup(
    id: string,
    req: UpdateChannelProgrammingRequest,
  ): Promise<Nullable<{ channel: ChannelOrm; newLineup: LineupItem[] }>>;

  saveLineup(
    channelId: string,
    newLineup: UpdateChannelLineupRequest,
  ): Promise<Lineup>;

  updateLineupConfig<
    Key extends keyof Omit<
      Lineup,
      'items' | 'startTimeOffsets' | 'pendingPrograms'
    >,
  >(
    id: string,
    key: Key,
    conf: Lineup[Key],
  ): Promise<void>;

  removeProgramsFromLineup(
    channelId: string,
    programIds: string[],
  ): Promise<void>;

  removeProgramsFromAllLineups(programIds: string[]): Promise<void>;

  loadAllLineupConfigs(
    forceRead?: boolean,
  ): Promise<Record<string, ChannelAndLineup>>;

  loadAllRawLineups(): Promise<Record<string, ChannelAndRawLineup>>;

  loadChannelAndLineup(
    channelId: string,
  ): Promise<ChannelAndLineup<Channel> | null>;

  loadChannelAndLineupOrm(
    channelId: string,
  ): Promise<ChannelAndLineup<
    MarkRequired<ChannelOrmWithRelations, 'fillerShows'>
  > | null>;

  addPendingPrograms(
    channelId: string,
    pendingPrograms: PendingProgram[],
  ): Promise<void>;

  setChannelPrograms(
    channel: Channel,
    lineup: readonly LineupItem[],
  ): Promise<ChannelOrm | null>;
  setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<ChannelOrm | null>;

  updateChannelStartTime(id: string, newTime: number): Promise<void>;

  getChannelSubtitlePreferences(
    id: string,
  ): Promise<ChannelSubtitlePreferences[]>;

  findChannelsForProgramId(programId: string): Promise<ChannelOrm[]>;
}
export type UpdateChannelLineupRequest = MarkOptional<
  MarkNullable<
    Omit<Lineup, 'lastUpdated'>,
    | 'dynamicContentConfig'
    | 'schedule'
    | 'schedulingOperations'
    | 'pendingPrograms'
  >,
  'version' | 'onDemandConfig' | 'items' | 'startTimeOffsets'
>;

export type PageParams = {
  offset: number;
  limit: number;
};
