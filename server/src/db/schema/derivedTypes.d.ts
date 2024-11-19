import { MarkNonNullable } from '@/types/util.ts';
import type { DeepNullable, MarkRequired } from 'ts-essentials';
import { Channel, ChannelFillerShow } from './Channel.ts';
import { FillerShow } from './FillerShow.ts';
import { ProgramDao } from './Program.ts';
import { MinimalProgramExternalId } from './ProgramExternalId.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';
import { ProgramGroupingExternalId } from './ProgramGroupingExternalId.ts';

export type ProgramDaoWithRelations = ProgramDao & {
  tvShow?: DeepNullable<Partial<ProgramGrouping>> | null;
  tvSeason?: DeepNullable<Partial<ProgramGrouping>> | null;
  trackArtist?: DeepNullable<Partial<ProgramGrouping>> | null;
  trackAlbum?: DeepNullable<Partial<ProgramGrouping>> | null;
  // Require minimum data from externalId
  externalIds?: MinimalProgramExternalId[];
};

// export type Channel = Omit<
//   Channel,
//   'icon' | 'offline' | 'watermark' | 'transcoding' | 'streamMode'
// > & {
//   icon?: ChannelIcon;
//   offline?: ChannelOfflineSettings;
//   watermark?: ChannelWatermark;
//   transcoding?: ChannelTranscodingSettings;
//   streamMode: ChannelStreamMode;
// } & {
//   programs?: Program[];
// };

export type ChannelWithRelations = Channel & {
  programs?: ProgramDaoWithRelations[];
  fillerContent?: ProgramDaoWithRelations[];
  fillerShows?: ChannelFillerShow[];
};

export type ChannelWithRequiredJoins<Joins extends keyof Channel> =
  MarkRequired<ChannelWithRelations, Joins>;

export type ChannelWithPrograms = MarkRequired<
  ChannelWithRelations,
  'programs'
>;

export type ChannelFillerShowWithRelations = ChannelFillerShow & {
  fillerShow: MarkNonNullable<DeepNullable<FillerShow>, 'uuid'>;
  fillerContent?: ProgramDaoWithRelations[];
};

export type ChannelFillerShowWithContent = MarkRequired<
  ChannelFillerShowWithRelations,
  'fillerContent'
>;

export type ProgramWithExternalIds = ProgramDao & {
  externalIds: MinimalProgramExternalId[];
};

export type ProgramGroupingWithExternalIds = ProgramGrouping & {
  externalIds: ProgramGroupingExternalId[];
};

// export type DB = Omit<RawType.DB, 'channel' | 'mediaSource'> & {
//   channel: Channel;
//   mediaSource: MediaSource;
// };
