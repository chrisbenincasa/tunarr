import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import type { MarkNonNullable, Nullable } from '@/types/util.js';
import type { Insertable } from 'kysely';
import type { DeepNullable, MarkRequired, StrictOmit } from 'ts-essentials';
import type { Channel, ChannelFillerShow } from './Channel.ts';
import type { FillerShow } from './FillerShow.ts';
import type {
  MediaSource,
  MediaSourceLibrary,
  MediaSourceLibraryOrm,
  MediaSourceType,
} from './MediaSource.ts';
import type {
  NewProgramDao,
  ProgramDao,
  ProgramOrm,
  ProgramType,
} from './Program.ts';
import type {
  ProgramChapter,
  ProgramChapterOrm,
  ProgramChapterTable,
} from './ProgramChapter.ts';
import type {
  MinimalProgramExternalId,
  NewSingleOrMultiExternalId,
} from './ProgramExternalId.ts';
import type {
  NewProgramGrouping,
  ProgramGrouping,
  ProgramGroupingType,
} from './ProgramGrouping.ts';
import type {
  NewSingleOrMultiProgramGroupingExternalId,
  ProgramGroupingExternalId,
} from './ProgramGroupingExternalId.ts';
import type {
  NewProgramMediaStream,
  ProgramMediaStream,
  ProgramMediaStreamOrm,
} from './ProgramMediaStream.ts';
import type {
  NewProgramVersionDao,
  ProgramVersion,
  ProgramVersionOrm,
} from './ProgramVersion.ts';
import type { ChannelSubtitlePreferences } from './SubtitlePreferences.ts';

export type ProgramVersionWithRelations = ProgramVersion & {
  mediaStreams?: ProgramMediaStream[];
  chapters?: ProgramChapter[];
};

export type ProgramVersionOrmWithRelations = ProgramVersionOrm & {
  mediaStreams?: ProgramMediaStreamOrm[];
  chapters?: ProgramChapterOrm[];
};

export type ProgramWithRelations = ProgramDao & {
  tvShow?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  tvSeason?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  trackArtist?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  trackAlbum?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  // Require minimum data from externalId
  externalIds?: MinimalProgramExternalId[];
  versions?: ProgramVersionWithRelations[];
  mediaLibrary?: Nullable<MediaSourceLibrary>;
};

export type ProgramWithRelationsOrm = ProgramOrm & {
  show?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  season?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  artist?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  album?: DeepNullable<Partial<ProgramGroupingWithExternalIds>> | null;
  // Require minimum data from externalId
  externalIds?: MinimalProgramExternalId[];
  versions?: ProgramVersionOrmWithRelations[];
  mediaLibrary?: Nullable<MediaSourceLibraryOrm>;
};

export type SpecificProgramGroupingType<
  Typ extends ProgramGroupingType,
  ProgramGroupingT extends { type: ProgramGroupingType } = ProgramGrouping,
> = StrictOmit<ProgramGroupingT, 'type'> & { type: Typ };

export type SpecificProgramType<
  Typ extends ProgramType,
  ProgramT extends { type: ProgramType } = ProgramDao,
> = StrictOmit<ProgramT, 'type'> & { type: Typ };

export type MovieProgram = SpecificProgramType<'movie'> & {
  externalIds: MinimalProgramExternalId[];
};

export type TvSeason = SpecificProgramGroupingType<'season'> & {
  externalIds: ProgramGroupingExternalId[];
};

export type TvShow = SpecificProgramGroupingType<'show'> & {
  externalIds: ProgramGroupingExternalId[];
};

export type EpisodeProgram = SpecificProgramType<'episode'> & {
  tvSeason: TvSeason;
  tvShow: TvShow;
  externalIds: MinimalProgramExternalId[];
};

export type EpisodeProgramWithRelations = EpisodeProgram & {
  tvShow: ProgramGroupingWithExternalIds;
  tvSeason: ProgramGroupingWithExternalIds;
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

export type NewProgramVersion = NewProgramVersionDao & {
  mediaStreams: NewProgramMediaStream[];
  chapters?: Insertable<ProgramChapterTable>[];
};

export type NewProgramWithRelations<Type extends ProgramType = ProgramType> = {
  program: SpecificProgramType<Type, NewProgramDao>;
  externalIds: NewSingleOrMultiExternalId[];
  versions: NewProgramVersion[];
};

export type NewProgramWithExternalIds = NewProgramDao & {
  externalIds: NewSingleOrMultiExternalId[];
};

export type NewMovieProgram = SpecificProgramType<'movie', NewProgramDao>;

export type NewEpisodeProgram = SpecificProgramType<'episode', NewProgramDao>;

export type ProgramGroupingWithExternalIds = ProgramGrouping & {
  externalIds: ProgramGroupingExternalId[];
};

type SpecificSubtype<
  BaseType extends { type: string },
  Value extends BaseType['type'],
> = StrictOmit<BaseType, 'type'> & { type: Value };

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

type WithNewGroupingExternalIds = {
  externalIds: NewSingleOrMultiProgramGroupingExternalId[];
};

export type NewProgramGroupingWithExternalIds = NewProgramGrouping &
  WithNewGroupingExternalIds;

export type NewTvShow = SpecificProgramGroupingType<
  'show',
  NewProgramGrouping
> &
  WithNewGroupingExternalIds;
export type NewTvSeason = SpecificProgramGroupingType<
  'season',
  NewProgramGrouping
> &
  WithNewGroupingExternalIds;

export type NewMusicArtist = SpecificProgramGroupingType<
  'artist',
  NewProgramGrouping
> &
  WithNewGroupingExternalIds;
export type NewMusicAlbum = SpecificProgramGroupingType<
  'album',
  NewProgramGrouping
> &
  WithNewGroupingExternalIds;

export type NewMusicTrack = SpecificProgramType<'track', NewProgramDao>;

export type MediaSourceWithLibraries = MediaSource & {
  libraries: MediaSourceLibrary[];
};
export type SpecificMediaSourceType<Typ extends MediaSourceType> = StrictOmit<
  MediaSourceWithLibraries,
  'type'
> & {
  type: Typ;
};

export type PlexMediaSource = SpecificMediaSourceType<
  typeof MediaSourceType.Plex
>;
export type JellyfinMediaSource = SpecificMediaSourceType<
  typeof MediaSourceType.Jellyfin
>;
export type EmbyMediaSource = SpecificMediaSourceType<
  typeof MediaSourceType.Emby
>;
