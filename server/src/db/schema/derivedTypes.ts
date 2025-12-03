import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import type { MarkNonNullable, Nullable } from '@/types/util.js';
import type { Insertable } from 'kysely';
import type { DeepNullable, MarkRequired, StrictOmit } from 'ts-essentials';
import type { Artwork, NewArtwork } from './Artwork.ts';
import type { MediaSourceType } from './base.ts';
import type { Channel, ChannelOrm } from './Channel.ts';
import type { ChannelFillerShow } from './ChannelFillerShow.ts';
import type { Credit, NewCredit } from './Credit.ts';
import type { FillerShow } from './FillerShow.ts';
import type { Genre, GenreEntity, NewGenre } from './Genre.ts';
import type {
  LocalMediaSourcePath,
  LocalMediaSourcePathOrm,
} from './LocalMediaSourcePath.ts';
import type { MediaSource, MediaSourceOrm } from './MediaSource.ts';
import type {
  MediaSourceLibrary,
  MediaSourceLibraryOrm,
} from './MediaSourceLibrary.ts';
import type { MediaSourceLibraryReplacePath } from './MediaSourceLibraryReplacePath.ts';
import type {
  NewProgramDao,
  ProgramDao,
  ProgramOrm,
  ProgramType,
} from './Program.ts';
import type {
  NewProgramChapterOrm,
  ProgramChapter,
  ProgramChapterOrm,
  ProgramChapterTable,
} from './ProgramChapter.ts';
import type {
  MinimalProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalIdOrm,
} from './ProgramExternalId.ts';
import type {
  NewProgramGrouping,
  NewProgramGroupingOrm,
  ProgramGrouping,
  ProgramGroupingOrm,
  ProgramGroupingType,
} from './ProgramGrouping.ts';
import type {
  NewSingleOrMultiProgramGroupingExternalId,
  ProgramGroupingExternalId,
  ProgramGroupingExternalIdOrm,
} from './ProgramGroupingExternalId.ts';
import type {
  NewProgramMediaFile,
  ProgramMediaFile,
} from './ProgramMediaFile.ts';
import type {
  NewProgramMediaStream,
  NewProgramMediaStreamOrm,
  ProgramMediaStream,
  ProgramMediaStreamOrm,
} from './ProgramMediaStream.ts';
import type {
  NewProgramSubtitles,
  ProgramSubtitles,
} from './ProgramSubtitles.ts';
import type {
  NewProgramVersionDao,
  NewProgramVersionOrm,
  ProgramVersion,
  ProgramVersionOrm,
} from './ProgramVersion.ts';
import type { NewStudio, Studio, StudioEntity } from './Studio.ts';
import type { ChannelSubtitlePreferences } from './SubtitlePreferences.ts';

export type ProgramVersionWithRelations = ProgramVersion & {
  mediaStreams?: ProgramMediaStream[];
  chapters?: ProgramChapter[];
};

export type ProgramVersionOrmWithRelations = ProgramVersionOrm & {
  mediaStreams?: ProgramMediaStreamOrm[];
  mediaFiles?: ProgramMediaFile[];
  chapters?: ProgramChapterOrm[];
};

export type NewProgramVersionOrmWithRelations = NewProgramVersionOrm & {
  mediaStreams?: NewProgramMediaStreamOrm[];
  chapters?: NewProgramChapterOrm[];
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

export type GenreEntityWithGenre = GenreEntity & {
  genre: Genre;
};

export type StudioEntityWithStudio = StudioEntity & {
  studio: Studio;
};

export type ProgramWithRelationsOrm = ProgramOrm & {
  show?: DeepNullable<Partial<ProgramGroupingOrmWithRelations>> | null;
  season?: DeepNullable<Partial<ProgramGroupingOrmWithRelations>> | null;
  artist?: DeepNullable<Partial<ProgramGroupingOrmWithRelations>> | null;
  album?: DeepNullable<Partial<ProgramGroupingOrmWithRelations>> | null;
  // Require minimum data from externalId
  externalIds?: ProgramExternalIdOrm[];
  versions?: ProgramVersionOrmWithRelations[];
  mediaLibrary?: Nullable<MediaSourceLibraryOrm>;
  artwork?: Artwork[];
  subtitles?: ProgramSubtitles[];
  credits?: CreditWithArtwork[];
  genres?: GenreEntityWithGenre[];
  studios?: StudioEntityWithStudio[];
};

export type SpecificProgramOrmType<
  Typ extends ProgramType,
  ProgramT extends { type: ProgramType } = ProgramWithRelationsOrm,
> = StrictOmit<ProgramT, 'type'> & { type: Typ };
export type SpecificProgramSourceOrmType<
  Typ extends MediaSourceType,
  ProgramT extends { sourceType: MediaSourceType } = ProgramWithRelationsOrm,
> = StrictOmit<ProgramT, 'sourceType'> & { sourceType: Typ };

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

export type ChannelOrmWithRelations = ChannelOrm & {
  programs?: ProgramWithRelationsOrm[];
  fillerContent?: ProgramWithRelationsOrm[];
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

export type ChannelOrmWithPrograms = MarkRequired<
  ChannelOrmWithRelations,
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
  mediaFiles: NewProgramMediaFile[];
  chapters?: Insertable<ProgramChapterTable>[];
};

export type NewCreditWithArtwork = {
  credit: NewCredit;
  artwork: NewArtwork[];
};

export type NewProgramWithRelations<Type extends ProgramType = ProgramType> = {
  program: SpecificProgramType<Type, NewProgramDao>;
  externalIds: NewSingleOrMultiExternalId[];
  versions: NewProgramVersion[];
  artwork: NewArtwork[];
  subtitles: NewProgramSubtitles[];
  credits: NewCreditWithArtwork[];
  genres: NewGenre[];
  studios: NewStudio[];
};

export type NewProgramWithExternalIds = NewProgramDao & {
  externalIds: NewSingleOrMultiExternalId[];
};

export type NewMovieProgram = SpecificProgramType<'movie', NewProgramDao>;
export type NewOtherVideoProgram = SpecificProgramType<
  'other_video',
  NewProgramDao
>;

export type NewEpisodeProgram = SpecificProgramType<'episode', NewProgramDao>;

export type ProgramGroupingWithExternalIds = ProgramGrouping & {
  externalIds: ProgramGroupingExternalId[];
};

export type CreditWithArtwork = Credit & {
  artwork?: Artwork[];
};

export type ProgramGroupingOrmWithRelations = ProgramGroupingOrm & {
  externalIds: ProgramGroupingExternalIdOrm[];
  artwork?: Artwork[];
  credits?: CreditWithArtwork[];
  genres?: GenreEntityWithGenre[];
  studios?: StudioEntityWithStudio[];
};

type SpecificSubtype<
  BaseType extends { type: string },
  Value extends BaseType['type'],
> = StrictOmit<BaseType, 'type'> & { type: Value };

export type TvSeasonWithExternalIds = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'season'
>;

export type TvShowWithExternalIds = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'show'
> & {
  seasons?: TvSeasonWithExternalIds[];
};

export type MusicAlbumWithExternalIds = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'album'
>;

export type MusicArtistWithExternalIds = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'artist'
> & {
  albums?: MusicAlbumWithExternalIds[];
};

export type GeneralizedProgramGroupingWithExternalIds =
  | TvShowWithExternalIds
  | TvSeasonWithExternalIds
  | MusicAlbumWithExternalIds
  | MusicArtistWithExternalIds;

export type TvSeasonOrm = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'season'
>;

export type TvShowOrm = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'show'
> & {
  seasons?: TvSeasonOrm[];
};

export type MusicAlbumOrm = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'album'
>;

export type MusicArtistOrm = SpecificSubtype<
  ProgramGroupingOrmWithRelations,
  'artist'
> & {
  albums?: MusicAlbumOrm[];
};

type WithNewGroupingExternalIds = {
  externalIds: NewSingleOrMultiProgramGroupingExternalId[];
};

export type NewProgramGroupingWithExternalIds = NewProgramGrouping &
  WithNewGroupingExternalIds;

export type NewProgramGroupingWithRelations<
  Typ extends ProgramGroupingType = ProgramGroupingType,
> = {
  programGrouping: SpecificProgramGroupingType<Typ, NewProgramGroupingOrm>;
  externalIds: NewSingleOrMultiProgramGroupingExternalId[];
  artwork: NewArtwork[];
  credits: NewCreditWithArtwork[];
  genres: NewGenre[];
  studios: NewStudio[];
};

export type NewTvShow = SpecificProgramGroupingType<'show', NewProgramGrouping>;

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

export type MediaSourceWithLibrariesDirect = MediaSource & {
  libraries: MediaSourceLibrary[];
  paths: LocalMediaSourcePath[];
};

export type MediaSourceWithRelations = MediaSourceOrm & {
  libraries: MediaSourceLibraryOrm[];
  paths: LocalMediaSourcePathOrm[];
  replacePaths: MediaSourceLibraryReplacePath[];
};

export type SpecificMediaSourceType<Typ extends MediaSourceType> = StrictOmit<
  MediaSourceWithRelations,
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
