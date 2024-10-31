import type { DeepNullable, MarkRequired } from 'ts-essentials';
import { MarkNonNullable } from '../../types/util.ts';
import { Channel, ChannelFillerShow } from './schema/Channel.ts';
import { FillerShow } from './schema/FillerShow.js';

import { Program } from './schema/Program.ts';
import { MinimalProgramExternalId } from './schema/ProgramExternalId.ts';
import { ProgramGrouping } from './schema/ProgramGrouping.ts';

export type ProgramWithRelations = Program & {
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
  programs?: ProgramWithRelations[];
  fillerContent?: ProgramWithRelations[];
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
  fillerContent?: ProgramWithRelations[];
};

export type ChannelFillerShowWithContent = MarkRequired<
  ChannelFillerShowWithRelations,
  'fillerContent'
>;

export type ProgramWithExternalIds = Program & {
  externalIds: MinimalProgramExternalId[];
};

// export type DB = Omit<RawType.DB, 'channel' | 'mediaSource'> & {
//   channel: Channel;
//   mediaSource: MediaSource;
// };
