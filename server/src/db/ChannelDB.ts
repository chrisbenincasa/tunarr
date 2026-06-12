import type {
  ChannelAndLineup,
  ChannelAndRawLineup,
  IChannelDB,
  UpdateChannelLineupRequest,
} from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe, Nullable, PagedResult } from '@/types/util.js';
import type {
  CondensedChannelProgramming,
  SaveableChannel,
} from '@tunarr/types';
import type { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import type { ContentProgramType } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import type { MarkRequired } from 'ts-essentials';
import { BasicChannelRepository } from './channel/BasicChannelRepository.ts';
import { ChannelConfigRepository } from './channel/ChannelConfigRepository.ts';
import { ChannelProgramRepository } from './channel/ChannelProgramRepository.ts';
import { ChannelReadOpsRepository } from './channel/ChannelReadOpsRepository.ts';
import { LineupRepository } from './channel/LineupRepository.ts';
import type {
  Lineup,
  LineupItem,
  PendingProgram,
} from './derived_types/Lineup.ts';
import type { PageParams } from './interfaces/IChannelDB.ts';
import type { Channel, ChannelOrm } from './schema/Channel.ts';
import type { ProgramExternalId } from './schema/ProgramExternalId.ts';
import type { ChannelSubtitlePreferences } from './schema/SubtitlePreferences.ts';
import type {
  ChannelOrmWithPrograms,
  ChannelOrmWithRelations,
  MusicArtistOrm,
  ProgramOrmWithExternalIds,
  ProgramWithRelationsOrm,
  TvShowOrm,
} from './schema/derivedTypes.ts';

@injectable()
export class ChannelDB implements IChannelDB {
  constructor(
    @inject(KEYS.BasicChannelRepository)
    private readonly basicChannel: BasicChannelRepository,
    @inject(KEYS.ChannelProgramRepository)
    private readonly channelProgram: ChannelProgramRepository,
    @inject(KEYS.LineupRepository)
    private readonly lineup: LineupRepository,
    @inject(KEYS.ChannelConfigRepository)
    private readonly channelConfig: ChannelConfigRepository,
    @inject(KEYS.ChannelReadOpsRepository)
    private readonly channelReadOps: ChannelReadOpsRepository,
  ) {}

  // --- BasicChannelRepository delegation ---

  channelExists(channelId: string): Promise<boolean> {
    return this.channelReadOps.channelExists(channelId);
  }

  getChannelOrm(
    id: string | number,
  ): Promise<
    Maybe<
      MarkRequired<ChannelOrmWithRelations, 'transcodeConfig' | 'fillerShows'>
    >
  > {
    return this.channelReadOps.getChannelOrm(id);
  }

  getChannel(id: string | number): Promise<Maybe<ChannelOrmWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: true,
  ): Promise<Maybe<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>>;
  getChannel(
    id: string | number,
    includeFiller: boolean,
  ): Promise<Maybe<ChannelOrmWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: boolean = false,
  ): Promise<Maybe<ChannelOrmWithRelations>> {
    if (includeFiller) {
      return this.channelReadOps.getChannel(id, true);
    }
    return this.channelReadOps.getChannel(id);
  }

  getAllChannels(): Promise<ChannelOrm[]> {
    return this.channelReadOps.getAllChannels();
  }

  saveChannel(
    createReq: SaveableChannel,
  ): Promise<
    ChannelAndLineup<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>
  > {
    return this.basicChannel.saveChannel(createReq);
  }

  updateChannel(
    id: string,
    updateReq: SaveableChannel,
  ): Promise<
    ChannelAndLineup<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>
  > {
    return this.basicChannel.updateChannel(id, updateReq);
  }

  updateChannelDuration(id: string, duration: number): Promise<number> {
    return this.basicChannel.updateChannelDuration(id, duration);
  }

  updateChannelStartTime(id: string, newTime: number): Promise<void> {
    return this.basicChannel.updateChannelStartTime(id, newTime);
  }

  syncChannelDuration(id: string): Promise<boolean> {
    return this.basicChannel.syncChannelDuration(id);
  }

  copyChannel(
    id: string,
  ): Promise<
    ChannelAndLineup<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>
  > {
    return this.basicChannel.copyChannel(id);
  }

  deleteChannel(
    channelId: string,
    blockOnLineupUpdates?: boolean,
  ): Promise<void> {
    return this.basicChannel.deleteChannel(channelId, blockOnLineupUpdates);
  }

  // --- ChannelProgramRepository delegation ---

  getChannelAndPrograms(
    uuid: string,
    typeFilter?: ContentProgramType,
  ): Promise<Maybe<MarkRequired<ChannelOrmWithRelations, 'programs'>>> {
    return this.channelProgram.getChannelAndPrograms(uuid, typeFilter);
  }

  getChannelTvShows(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<TvShowOrm>> {
    return this.channelProgram.getChannelTvShows(id, pageParams);
  }

  getChannelMusicArtists(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<MusicArtistOrm>> {
    return this.channelProgram.getChannelMusicArtists(id, pageParams);
  }

  getChannelPrograms(
    id: string,
    pageParams?: PageParams,
    typeFilter?: ContentProgramType,
  ): Promise<PagedResult<ProgramWithRelationsOrm>> {
    return this.channelProgram.getChannelPrograms(id, pageParams, typeFilter);
  }

  getChannelProgramExternalIds(uuid: string): Promise<ProgramExternalId[]> {
    return this.channelProgram.getChannelProgramExternalIds(uuid);
  }

  getChannelFallbackPrograms(
    uuid: string,
  ): Promise<Maybe<ProgramOrmWithExternalIds>> {
    return this.channelProgram.getChannelFallbackPrograms(uuid);
  }

  replaceChannelPrograms(channelId: string, programIds: string[]): void {
    this.channelProgram.replaceChannelPrograms(channelId, programIds);
  }

  findChannelsForProgramId(programId: string): Promise<ChannelOrm[]> {
    return this.channelProgram.findChannelsForProgramId(programId);
  }

  // --- LineupRepository delegation ---

  loadLineup(channelId: string, forceRead?: boolean): Promise<Lineup> {
    return this.lineup.loadLineup(channelId, forceRead);
  }

  loadCondensedLineup(
    channelId: string,
    offset?: number,
    limit?: number,
  ): Promise<CondensedChannelProgramming | null> {
    return this.lineup.loadCondensedLineup(channelId, offset, limit);
  }

  loadChannelAndLineup(
    channelId: string,
  ): Promise<ChannelAndLineup<Channel> | null> {
    return this.lineup.loadChannelAndLineup(channelId);
  }

  loadChannelAndLineupOrm(
    channelId: string,
  ): Promise<ChannelAndLineup<
    MarkRequired<ChannelOrmWithRelations, 'fillerShows'>
  > | null> {
    return this.lineup.loadChannelAndLineupOrm(channelId);
  }

  loadChannelWithProgamsAndLineup(
    channelId: string,
  ): Promise<{ channel: ChannelOrmWithPrograms; lineup: Lineup } | null> {
    return this.lineup.loadChannelWithProgamsAndLineup(channelId);
  }

  loadAllLineups(): Promise<
    Record<string, { channel: ChannelOrm; lineup: Lineup }>
  > {
    return this.lineup.loadAllLineups();
  }

  loadAllLineupConfigs(
    forceRead?: boolean,
  ): Promise<Record<string, ChannelAndLineup>> {
    return this.lineup.loadAllLineupConfigs(forceRead);
  }

  loadAllRawLineups(): Promise<Record<string, ChannelAndRawLineup>> {
    return this.lineup.loadAllRawLineups();
  }

  saveLineup(
    channelId: string,
    newLineup: UpdateChannelLineupRequest,
  ): Promise<Lineup> {
    return this.lineup.saveLineup(channelId, newLineup);
  }

  updateLineup(
    id: string,
    req: UpdateChannelProgrammingRequest,
  ): Promise<Nullable<{ channel: ChannelOrm; newLineup: LineupItem[] }>> {
    return this.lineup.updateLineup(id, req);
  }

  updateLineupConfig<
    Key extends keyof Omit<
      Lineup,
      'items' | 'startTimeOffsets' | 'pendingPrograms'
    >,
  >(id: string, key: Key, conf: Lineup[Key]): Promise<void> {
    return this.lineup.updateLineupConfig(id, key, conf);
  }

  setChannelPrograms(
    channel: Channel,
    lineup: readonly LineupItem[],
  ): Promise<ChannelOrm | null>;
  setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<ChannelOrm | null>;
  setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<ChannelOrm | null> {
    // TODO: Update LineupRepository.setChannelPrograms to return ChannelOrm
    return this.lineup.setChannelPrograms(channel, lineup, startTime);
  }

  addPendingPrograms(
    channelId: string,
    pendingPrograms: PendingProgram[],
  ): Promise<void> {
    return this.lineup.addPendingPrograms(channelId, pendingPrograms);
  }

  removeProgramsFromLineup(
    channelId: string,
    programIds: string[],
  ): Promise<void> {
    return this.lineup.removeProgramsFromLineup(channelId, programIds);
  }

  removeProgramsFromAllLineups(programIds: string[]): Promise<void> {
    return this.lineup.removeProgramsFromAllLineups(programIds);
  }

  // --- ChannelConfigRepository delegation ---

  getChannelSubtitlePreferences(
    id: string,
  ): Promise<ChannelSubtitlePreferences[]> {
    return this.channelConfig.getChannelSubtitlePreferences(id);
  }
}
