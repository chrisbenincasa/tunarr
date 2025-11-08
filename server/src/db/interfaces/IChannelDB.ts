import type { ChannelQueryBuilder } from '@/db/ChannelQueryBuilder.js';
import type {
  Lineup,
  LineupItem,
  PendingProgram,
} from '@/db/derived_types/Lineup.js';
import type { Channel } from '@/db/schema/Channel.js';
import type { ProgramDao } from '@/db/schema/Program.js';
import type { ProgramExternalId } from '@/db/schema/ProgramExternalId.js';
import type {
  ChannelOrmWithRelations,
  ChannelWithRelations,
  MusicArtistOrm,
  ProgramWithRelations,
  TvShowOrm,
} from '@/db/schema/derivedTypes.js';
import type { ChannelAndLineup } from '@/types/internal.js';
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

export type ChannnelAndLineup = { channel: Channel; lineup: Lineup };
export type ChannelAndRawLineup = { channel: Channel; lineup: Json };

export interface IChannelDB {
  channelExists(channelId: string): Promise<boolean>;

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

  getAllChannels(pageParams?: PageParams): Promise<Channel[]>;

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
  ): Promise<ProgramWithRelations[]>;

  getChannelProgramExternalIds(uuid: string): Promise<ProgramExternalId[]>;

  getChannelFallbackPrograms(uuid: string): Promise<ProgramDao[]>;

  saveChannel(createReq: SaveableChannel): Promise<ChannnelAndLineup>;

  deleteChannel(
    channelId: string,
    blockOnLineupUpdates?: boolean,
  ): Promise<void>;

  updateChannel(
    id: string,
    updateReq: SaveableChannel,
  ): Promise<ChannelAndLineup>;

  copyChannel(id: string): Promise<ChannelAndLineup>;

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
  ): Promise<Record<string, ChannnelAndLineup>>;

  loadAllRawLineups(): Promise<Record<string, ChannelAndRawLineup>>;

  loadChannelAndLineup(channelId: string): Promise<ChannnelAndLineup | null>;

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

  findChannelsForProgramId(programId: string): Promise<Channel[]>;
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
