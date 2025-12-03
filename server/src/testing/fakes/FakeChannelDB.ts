import type {
  ChannelProgramming,
  CondensedChannelProgramming,
  SaveableChannel,
} from '@tunarr/types';
import type { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import type { ContentProgramType } from '@tunarr/types/schemas';
import type { MarkRequired } from 'ts-essentials';
import type { ChannelQueryBuilder } from '../../db/ChannelQueryBuilder.ts';
import type {
  Lineup,
  LineupItem,
  PendingProgram,
} from '../../db/derived_types/Lineup.ts';
import type {
  ChannelAndLineup,
  ChannelAndRawLineup,
  IChannelDB,
  PageParams,
  UpdateChannelLineupRequest,
} from '../../db/interfaces/IChannelDB.ts';
import type { Channel } from '../../db/schema/Channel.ts';
import type {
  ChannelWithPrograms,
  ChannelWithRelations,
  MusicArtistWithExternalIds,
  ProgramWithRelations,
  TvShowWithExternalIds,
} from '../../db/schema/derivedTypes.js';
import type { ProgramDao } from '../../db/schema/Program.ts';
import type { ProgramExternalId } from '../../db/schema/ProgramExternalId.ts';
import type { ChannelSubtitlePreferences } from '../../db/schema/SubtitlePreferences.ts';
import type { Maybe, Nullable, PagedResult } from '../../types/util.ts';

export class FakeChannelDB implements IChannelDB {
  channelExists(channelId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  getChannel(id: string | number): Promise<Maybe<ChannelWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: true,
  ): Promise<Maybe<MarkRequired<ChannelWithRelations, 'fillerShows'>>>;
  getChannel(
    id: string | number,
    includeFiller: boolean = false,
  ): Promise<Maybe<ChannelWithRelations>> {
    throw new Error('Method not implemented.');
  }

  getChannelBuilder(
    id: string | number,
  ): ChannelQueryBuilder<ChannelWithRelations> {
    throw new Error('Method not implemented.');
  }
  getAllChannels(pageParams?: PageParams): Promise<Channel[]> {
    throw new Error('Method not implemented.');
  }
  getChannelAndPrograms(
    uuid: string,
    typeFilter?: ContentProgramType,
  ): Promise<ChannelWithPrograms | undefined> {
    throw new Error('Method not implemented.');
  }
  getChannelTvShows(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<TvShowWithExternalIds>> {
    throw new Error('Method not implemented.');
  }
  getChannelMusicArtists(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<MusicArtistWithExternalIds>> {
    throw new Error('Method not implemented.');
  }
  getChannelPrograms(
    id: string,
    pageParams?: PageParams,
    typeFilter?: ContentProgramType,
  ): Promise<ProgramWithRelations[]> {
    throw new Error('Method not implemented.');
  }
  getChannelProgramExternalIds(uuid: string): Promise<ProgramExternalId[]> {
    throw new Error('Method not implemented.');
  }
  getChannelFallbackPrograms(uuid: string): Promise<ProgramDao[]> {
    throw new Error('Method not implemented.');
  }
  saveChannel(createReq: SaveableChannel): Promise<ChannelAndLineup> {
    throw new Error('Method not implemented.');
  }
  deleteChannel(
    channelId: string,
    blockOnLineupUpdates?: boolean,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  updateChannel(
    id: string,
    updateReq: SaveableChannel,
  ): Promise<ChannelAndLineup> {
    throw new Error('Method not implemented.');
  }
  copyChannel(id: string): Promise<ChannelAndLineup> {
    throw new Error('Method not implemented.');
  }
  loadLineup(channelId: string, forceRead?: boolean): Promise<Lineup> {
    throw new Error('Method not implemented.');
  }
  loadCondensedLineup(
    channelId: string,
    offset?: number,
    limit?: number,
  ): Promise<CondensedChannelProgramming | null> {
    throw new Error('Method not implemented.');
  }
  updateLineup(
    id: string,
    req: UpdateChannelProgrammingRequest,
  ): Promise<Nullable<{ channel: Channel; newLineup: LineupItem[] }>> {
    throw new Error('Method not implemented.');
  }
  saveLineup(
    channelId: string,
    newLineup: UpdateChannelLineupRequest,
  ): Promise<Lineup> {
    throw new Error('Method not implemented.');
  }
  updateLineupConfig<
    Key extends keyof Omit<
      Lineup,
      'items' | 'startTimeOffsets' | 'pendingPrograms'
    >,
  >(id: string, key: Key, conf: Lineup[Key]): Promise<void> {
    throw new Error('Method not implemented.');
  }
  removeProgramsFromLineup(
    channelId: string,
    programIds: string[],
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  removeProgramsFromAllLineups(programIds: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
  loadAllLineupConfigs(
    forceRead?: boolean,
  ): Promise<Record<string, ChannelAndLineup>> {
    throw new Error('Method not implemented.');
  }
  loadAllRawLineups(): Promise<Record<string, ChannelAndRawLineup>> {
    throw new Error('Method not implemented.');
  }
  loadChannelAndLineup(channelId: string): Promise<ChannelAndLineup | null> {
    throw new Error('Method not implemented.');
  }
  addPendingPrograms(
    channelId: string,
    pendingPrograms: PendingProgram[],
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  setChannelPrograms(
    channel: Channel,
    lineup: readonly LineupItem[],
  ): Promise<Channel | null>;
  setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<Channel | null>;
  setChannelPrograms(
    channel: unknown,
    lineup: unknown,
    startTime?: unknown,
  ): Promise<{
    number: number;
    duration: number;
    uuid: string;
    offline: {
      mode: 'pic' | 'clip';
      picture?: string | undefined;
      soundtrack?: string | undefined;
    };
    createdAt: number | null;
    updatedAt: number | null;
    name: string;
    disableFillerOverlay: number;
    fillerRepeatCooldown: number | null;
    groupTitle: string | null;
    guideFlexTitle: string | null;
    guideMinimumDuration: number;
    icon: {
      path: string;
      width: number;
      duration: number;
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    };
    startTime: number;
    stealth: number;
    streamMode: 'hls' | 'hls_slower' | 'mpegts' | 'hls_direct';
    transcoding: {
      targetResolution?: { widthPx: number; heightPx: number } | undefined;
      videoBitrate?: number | undefined;
      videoBufferSize?: number | undefined;
    } | null;
    transcodeConfigId: string;
    watermark: {
      enabled: boolean;
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      width: number;
      verticalMargin: number;
      horizontalMargin: number;
      duration: number;
      opacity: number;
      url?: string | undefined;
      fixedSize?: boolean | undefined;
      animated?: boolean | undefined;
      fadeConfig?:
        | {
            periodMins: number;
            programType?:
              | 'movie'
              | 'episode'
              | 'track'
              | 'music_video'
              | 'other_video'
              | undefined;
            leadingEdge?: boolean | undefined;
          }[]
        | undefined;
    } | null;
    subtitlesEnabled: number;
  } | null> {
    throw new Error('Method not implemented.');
  }
  updateChannelStartTime(id: string, newTime: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getChannelSubtitlePreferences(
    id: string,
  ): Promise<ChannelSubtitlePreferences[]> {
    throw new Error('Method not implemented.');
  }
  loadAndMaterializeLineup(
    channelId: string,
    offset?: number,
    limit?: number,
  ): Promise<ChannelProgramming | null> {
    throw new Error('Method not implemented.');
  }
  findChannelsForProgramId(programId: string): Promise<Channel[]> {
    throw new Error('Method not implemented.');
  }
}
