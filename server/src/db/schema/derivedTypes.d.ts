import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import type { MarkNonNullable } from '@/types/util.js';
import type { DeepNullable, MarkRequired, StrictOmit } from 'ts-essentials';
import type { Channel, ChannelFillerShow } from './Channel.ts';
import type { FillerShow } from './FillerShow.ts';
import type { ProgramDao } from './Program.ts';
import type { MinimalProgramExternalId } from './ProgramExternalId.ts';
import type { ProgramGrouping } from './ProgramGrouping.ts';
import type { ProgramGroupingExternalId } from './ProgramGroupingExternalId.ts';
import type { ChannelSubtitlePreferences } from './SubtitlePreferences.ts';

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
  subtitlePreferences?: ChannelSubtitlePreferences[];
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

export type ChannelWithSubtitlePreferences = MarkRequired<
  ChannelWithRelations,
  'subtitlePreferences'
>;

export type ProgramWithExternalIds = ProgramDao & {
  externalIds: MinimalProgramExternalId[];
};

export type ProgramGroupingWithExternalIds = ProgramGrouping & {
  externalIds: ProgramGroupingExternalId[];
};

type SpecificSubtype<BaseType, Value extends BaseType['type']> = StrictOmit<
  BaseType,
  'type'
> & { type: Value };

export type TvSeasonWithExternalIds = SpecificSubtype<
  ProgramGroupingWithExternalIds,
  'season'
>;

export type TvShowWithExternalIds = SpecificSubtype<
  ProgramGroupingWithExternalIds,
  'show'
> & {
  seasons?: TvSeasonWithExternalIds[];
};

export type MusicAlbumWithExternalIds = SpecificSubtype<
  ProgramGroupingWithExternalIds,
  'album'
>;

export type MusicArtistWithExternalIds = SpecificSubtype<
  ProgramGroupingWithExternalIds,
  'artist'
> & {
  albums?: MusicAlbumWithExternalIds[];
};

export type GeneralizedProgramGroupingWithExternalIds =
  | TvShowWithExternalIds
  | TvSeasonWithExternalIds
  | MusicAlbumWithExternalIds
  | MusicArtistWithExternalIds;
