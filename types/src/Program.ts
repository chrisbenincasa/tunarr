import type z from 'zod/v4';
import { type CondensedChannelProgrammingSchema } from './schemas/lineups.js';
import type {
  Collection,
  Episode,
  EpisodeMetadata,
  EpisodeWithHierarchy,
  FillerProgramSchema,
  Folder,
  IdentifierSchema,
  ItemOrFolder,
  ItemSchema,
  Library,
  MediaChapter,
  MediaItem,
  MediaStream,
  MediaSubtitles,
  Movie,
  MovieMetadata,
  MusicAlbum,
  MusicAlbumContentProgramSchema,
  MusicArtist,
  MusicArtistContentProgramSchema,
  MusicTrack,
  MusicTrackWithHierarchy,
  MusicVideo,
  OtherVideo,
  Playlist,
  ProgramGroupingSchema,
  Season,
  SeasonMetadata,
  Show,
  ShowMetadata,
  StructuralProgramGroupingSchema,
  TerminalProgramSchema,
  TvSeasonContentProgramSchema,
  TvShowContentProgramSchema,
} from './schemas/programmingSchema.js';
import {
  type BaseProgramSchema,
  type ChannelProgramSchema,
  type ChannelProgrammingSchema,
  type CondensedChannelProgramSchema,
  type CondensedContentProgramSchema,
  type ContentProgramParentSchema,
  type ContentProgramSchema,
  type CustomProgramSchema,
  type FlexProgramSchema,
  type ProgramSchema,
  type ProgramTypeSchema,
  type RedirectProgramSchema,
} from './schemas/programmingSchema.js';
import { type ExternalIdSchema } from './schemas/utilSchemas.js';

// This helps with VS Code type preview
export type ProgramType = z.infer<typeof ProgramTypeSchema>;

export type Program = z.infer<typeof ProgramSchema>;

// Used when we only need access to very minimal set of fields that
// are shared by all program types, e.g. duration
export type BaseProgram = z.infer<typeof BaseProgramSchema>;

export type ContentProgram = z.infer<typeof ContentProgramSchema>;

export type ContentProgramParent = z.infer<typeof ContentProgramParentSchema>;

export type TvShowContentProgram = z.infer<typeof TvShowContentProgramSchema>;

export type TvSeasonContentProgram = z.infer<
  typeof TvSeasonContentProgramSchema
>;

export type MusicArtistContentProgram = z.infer<
  typeof MusicArtistContentProgramSchema
>;

export type MusicAlbumContentProgram = z.infer<
  typeof MusicAlbumContentProgramSchema
>;

export type FlexProgram = z.infer<typeof FlexProgramSchema>;

export type CustomProgram = z.infer<typeof CustomProgramSchema>;

export type FillerProgram = z.infer<typeof FillerProgramSchema>;

export type RedirectProgram = z.infer<typeof RedirectProgramSchema>;

export type ChannelProgram = z.infer<typeof ChannelProgramSchema>;

function isProgramType<T extends BaseProgram>(type: T['type']) {
  return (p: BaseProgram): p is T => {
    return p.type === type;
  };
}

export const isContentProgram = isProgramType<ContentProgram>('content');

export const isFlexProgram = isProgramType<FlexProgram>('flex');

export const isRedirectProgram = isProgramType<RedirectProgram>('redirect');

export const isCustomProgram = isProgramType<CustomProgram>('custom');

export const isFillerProgram = isProgramType<FillerProgram>('filler');

export function programUniqueId(program: BaseProgram): string | null {
  if (isContentProgram(program)) {
    return program.uniqueId;
  } else if (isFlexProgram(program)) {
    return 'flex'; // Cannot really be unique identified
  } else if (isRedirectProgram(program)) {
    return `redirect.${program.channel}`;
  } else if (isCustomProgram(program)) {
    return `custom.${program.customShowId}.${program.id}`;
  } else if (isFillerProgram(program)) {
    return `filler.${program.fillerListId}.${program.id}`;
  }

  return null;
}

export type ChannelProgramming = z.infer<typeof ChannelProgrammingSchema>;

export type CondensedContentProgram = z.infer<
  typeof CondensedContentProgramSchema
>;

export type CondensedChannelProgram = z.infer<
  typeof CondensedChannelProgramSchema
>;

export type CondensedChannelProgramming = z.infer<
  typeof CondensedChannelProgrammingSchema
>;

export type ExternalId = z.infer<typeof ExternalIdSchema>;
export type Identifier = z.infer<typeof IdentifierSchema>;

// Specific types
export type Movie = z.infer<typeof Movie>;
export type Episode = z.infer<typeof Episode>;
export type EpisodeWithHierarchy = z.infer<typeof EpisodeWithHierarchy>;
export type Show = z.infer<typeof Show>;
export type Season = z.infer<typeof Season>;
export type MusicTrack = z.infer<typeof MusicTrack>;
export type MusicAlbum = z.infer<typeof MusicAlbum>;
export type MusicArtist = z.infer<typeof MusicArtist>;
export type MusicTrackWithHierarchy = z.infer<typeof MusicTrackWithHierarchy>;
export type MusicVideo = z.infer<typeof MusicVideo>;
export type OtherVideo = z.infer<typeof OtherVideo>;

export type ProgramLike = z.infer<typeof ItemSchema>;
export type ProgramGrouping = z.infer<typeof ProgramGroupingSchema>;
export type TerminalProgram = z.infer<typeof TerminalProgramSchema>;
export type StructuralProgramGrouping = z.infer<
  typeof StructuralProgramGroupingSchema
>;
export type ProgramOrFolder = z.infer<typeof ItemOrFolder>;
export type Folder = z.infer<typeof Folder>;
export type Collection = z.infer<typeof Collection>;
export type Playlist = z.infer<typeof Playlist>;
export type Library = z.infer<typeof Library>;

export type MediaStream = z.infer<typeof MediaStream>;
export type MediaItem = z.infer<typeof MediaItem>;
export type MediaChapter = z.infer<typeof MediaChapter>;
export type MediaSubtitles = z.infer<typeof MediaSubtitles>;

// Metadata
export type MovieMetadata = z.infer<typeof MovieMetadata>;
export type EpisodeMetadata = z.infer<typeof EpisodeMetadata>;
export type SeasonMetadata = z.infer<typeof SeasonMetadata>;
export type ShowMetadata = z.infer<typeof ShowMetadata>;

export function isEpisodeWithHierarchy(
  f: TerminalProgram,
): f is EpisodeWithHierarchy {
  return f.type === 'episode' && !!f.season && !!f.season?.show;
}

export function isMusicTrackWithHierarchy(
  f: TerminalProgram,
): f is MusicTrackWithHierarchy {
  return f.type === 'track' && !!f.album && !!f.album?.artist;
}

export function getChildItemType(typ: ProgramOrFolder['type']) {
  switch (typ) {
    case 'show':
      return 'season';
    case 'season':
      return 'episode';
    case 'album':
      return 'track';
    case 'artist':
      return 'album';
    default:
      return 'item';
  }
}

export function getChildCount(input: ProgramOrFolder): number | undefined {
  switch (input.type) {
    case 'movie':
    case 'episode':
    case 'track':
    case 'music_video':
    case 'other_video':
      return undefined;
    case 'show':
    case 'season':
    case 'album':
    case 'artist':
    case 'folder':
    case 'collection':
    case 'playlist':
      return input.childCount;
  }
}

export function isTerminalItemType(
  type: string,
): type is TerminalProgram['type'];
export function isTerminalItemType(
  program: ProgramOrFolder | Library,
): program is TerminalProgram;
export function isTerminalItemType(
  program: ProgramOrFolder | Library | string,
): boolean {
  const type = typeof program === 'string' ? program : program.type;
  return (
    type === 'movie' ||
    type === 'music_video' ||
    type === 'episode' ||
    type === 'track' ||
    type === 'other_video'
  );
}

export function isStructuralItemType(
  type: string,
): type is StructuralProgramGrouping['type'];
export function isStructuralItemType(
  program: ProgramOrFolder | Library,
): program is StructuralProgramGrouping;
export function isStructuralItemType(
  program: ProgramOrFolder | Library | string,
): boolean {
  const type = typeof program === 'string' ? program : program.type;
  return (
    type === 'folder' ||
    type === 'collection' ||
    type === 'playlist' ||
    type === 'library'
  );
}
