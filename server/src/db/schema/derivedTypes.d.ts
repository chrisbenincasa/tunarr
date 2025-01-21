import { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { MarkNonNullable } from '@/types/util.js';
import type { DeepNullable, MarkRequired } from 'ts-essentials';
import { Channel, ChannelFillerShow } from './Channel.ts';
import { FillerShow } from './FillerShow.ts';
import { ProgramDao } from './Program.ts';
import { MinimalProgramExternalId } from './ProgramExternalId.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';
import { ProgramGroupingExternalId } from './ProgramGroupingExternalId.ts';

export type ProgramWithRelations = ProgramDao & {
  tvShow?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  tvSeason?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  trackArtist?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  trackAlbum?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  // Require minimum data from externalId
  externalIds?: MinimalProgramExternalId[];
};

export type ChannelWithRelations = Channel & {
  programs?: ProgramWithRelations[];
  fillerContent?: ProgramWithRelations[];
  fillerShows?: ChannelFillerShow[];
  transcodeConfig?: TranscodeConfig;
};

export type ChannelWithTranscodeConfig = MarkRequired<
  ChannelWithRelations,
  'transcodeConfig'
>;

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

export type ProgramWithExternalIds = ProgramDao & {
  externalIds: MinimalProgramExternalId[];
};

export type ProgramGroupingWithExternalIds = ProgramGrouping & {
  externalIds: ProgramGroupingExternalId[];
};
