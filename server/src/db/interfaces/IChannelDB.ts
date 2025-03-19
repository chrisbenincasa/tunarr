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
  ChannelWithPrograms,
  ChannelWithRelations,
} from '@/db/schema/derivedTypes.js';
import type { ChannelAndLineup } from '@/types/internal.js';
import type { MarkNullable, Maybe, Nullable } from '@/types/util.js';
import type {
  CondensedChannelProgramming,
  SaveChannelRequest,
} from '@tunarr/types';
import type { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import type { MarkOptional, MarkRequired } from 'ts-essentials';

export type ChannnelAndLineup = { channel: Channel; lineup: Lineup };

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

  getChannelAndPrograms(uuid: string): Promise<ChannelWithPrograms | undefined>;

  getChannelProgramExternalIds(uuid: string): Promise<ProgramExternalId[]>;

  getChannelFallbackPrograms(uuid: string): Promise<ProgramDao[]>;

  saveChannel(createReq: SaveChannelRequest): Promise<ChannnelAndLineup>;

  deleteChannel(
    channelId: string,
    blockOnLineupUpdates?: boolean,
  ): Promise<void>;

  updateChannel(
    id: string,
    updateReq: SaveChannelRequest,
  ): Promise<ChannelAndLineup>;

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
