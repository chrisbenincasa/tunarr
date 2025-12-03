import type { ChannelQueryBuilder } from '@/db/ChannelQueryBuilder.js';
import type {
  Lineup,
  LineupItem,
  PendingProgram,
} from '@/db/derived_types/Lineup.js';
import type { Channel, ChannelOrm } from '@/db/schema/Channel.js';
import type { ProgramDao } from '@/db/schema/Program.js';
import type { ProgramExternalId } from '@/db/schema/ProgramExternalId.js';
import type {
  ChannelOrmWithRelations,
  ChannelWithRelations,
  MusicArtistOrm,
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
  ChannelProgramming,
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
export type LegacyChannelAndLineup = ChannelAndLineup<Channel>;
export type ChannelAndRawLineup = { channel: ChannelOrm; lineup: Json };

export interface IChannelDB {
  channelExists(channelId: string): Promise<boolean>;

  getChannelOrm(id: string | number): Promise<Maybe<ChannelOrm>>;

  getChannel(id: string | number): Promise<Maybe<ChannelWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: true,
  ): Promise<Maybe<MarkRequired<ChannelWithRelations, 'fillerShows'>>>;
  getChannel(
    id: string | number,
    includeFiller: boolean,
  ): Promise<Maybe<ChannelWithRelations>>;

  getChannelBuilder(
    id: string | number,
  ): ChannelQueryBuilder<ChannelWithRelations>;

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

  getChannelFallbackPrograms(uuid: string): Promise<ProgramDao[]>;

  saveChannel(createReq: SaveableChannel): Promise<ChannelAndLineup<Channel>>;

  deleteChannel(
    channelId: string,
    blockOnLineupUpdates?: boolean,
  ): Promise<void>;

  updateChannel(
    id: string,
    updateReq: SaveableChannel,
  ): Promise<ChannelAndLineup<Channel>>;

  copyChannel(id: string): Promise<ChannelAndLineup<Channel>>;

  loadLineup(channelId: string, forceRead?: boolean): Promise<Lineup>;

  loadCondensedLineup(
    channelId: string,
    offset?: number,
    limit?: number,
  ): Promise<CondensedChannelProgramming | null>;

  updateLineup(
    id: string,
    req: UpdateChannelProgrammingRequest,
  ): Promise<Nullable<{ channel: Channel; newLineup: LineupItem[] }>>;

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

  addPendingPrograms(
    channelId: string,
    pendingPrograms: PendingProgram[],
  ): Promise<void>;

  setChannelPrograms(
    channel: Channel,
    lineup: readonly LineupItem[],
  ): Promise<Channel | null>;
  setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<Channel | null>;

  updateChannelStartTime(id: string, newTime: number): Promise<void>;

  getChannelSubtitlePreferences(
    id: string,
  ): Promise<ChannelSubtitlePreferences[]>;

  loadAndMaterializeLineup(
    channelId: string,
    offset?: number,
    limit?: number,
  ): Promise<ChannelProgramming | null>;

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
