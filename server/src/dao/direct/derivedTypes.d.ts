import { Selectable } from 'kysely';
import type { DeepNullable, MarkRequired } from 'ts-essentials';
import { MarkNonNullable } from '../../types/util.ts';
import { MediaSourceType } from '../entities/MediaSource.ts';
import * as RawType from './schema/db.ts';

export type ProgramWithRelations = RawType.Program & {
  tvShow?: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
  tvSeason?: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
  trackArtist?: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
  trackAlbum?: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
  // Require minimum data from externalId
  externalIds?: RawType.MinimalProgramExternalId[];
};

// export type Channel = Omit<
//   RawType.Channel,
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

export type ChannelWithRelations = RawType.Channel & {
  programs?: ProgramWithRelations[];
  fillerContent?: ProgramWithRelations[];
  fillerShows?: RawType.ChannelFillerShow[];
};

export type ChannelWithRequiredJoins<Joins extends keyof RawType.Channel> =
  MarkRequired<ChannelWithRelations, Joins>;

export type ChannelWithPrograms = MarkRequired<
  ChannelWithRelations,
  'programs'
>;

export type ChannelFillerShowWithRelations = RawType.ChannelFillerShow & {
  fillerShow: MarkNonNullable<DeepNullable<RawType.FillerShow>, 'uuid'>;
  fillerContent?: ProgramWithRelations[];
};

export type ChannelFillerShowWithContent = MarkRequired<
  ChannelFillerShowWithRelations,
  'fillerContent'
>;

export type MediaSource = Omit<Selectable<RawType.MediaSource>, 'type'> & {
  type: MediaSourceType;
};

export type ProgramWithExternalIds = RawType.Program & {
  externalIds: RawType.MinimalProgramExternalId[];
};

// export type DB = Omit<RawType.DB, 'channel' | 'mediaSource'> & {
//   channel: Channel;
//   mediaSource: MediaSource;
// };
