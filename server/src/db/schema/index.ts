import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Artwork, ArtworkRelations } from './Artwork.ts';
import { Channel, ChannelRelations } from './Channel.ts';
import {
  ChannelCustomShow,
  ChannelCustomShowRelations,
} from './ChannelCustomShow.ts';
import {
  ChannelFillerShow,
  ChannelFillerShowRelations,
} from './ChannelFillerShow.ts';
import {
  ChannelPrograms,
  ChannelProgramsRelations,
} from './ChannelPrograms.ts';
import { Credit, CreditRelations } from './Credit.ts';
import { CustomShow, CustomShowRelations } from './CustomShow.ts';
import {
  CustomShowContent,
  CustomShowContentRelations,
} from './CustomShowContent.ts';
import { FillerShow, FillerShowRelations } from './FillerShow.ts';
import {
  FillerShowContent,
  FillerShowContentRelations,
} from './FillerShowContent.ts';
import { EntityGenre, Genre, GenreRelations } from './Genre.ts';
import {
  LocalMediaFolder,
  LocalMediaFolderRelations,
} from './LocalMediaFolder.ts';
import {
  LocalMediaSourcePath,
  LocalMediaSourcePathRelations,
} from './LocalMediaSourcePath.ts';
import { MediaSource, MediaSourceRelations } from './MediaSource.ts';
import {
  MediaSourceLibrary,
  MediaSourceLibraryRelations,
} from './MediaSourceLibrary.ts';
import {
  MediaSourceLibraryReplacePath,
  MediaSourceLibraryReplacePathRelations,
} from './MediaSourceLibraryReplacePath.ts';
import { Program, ProgramRelations } from './Program.ts';
import { ProgramChapter, ProgramChapterRelations } from './ProgramChapter.ts';
import {
  ProgramExternalId,
  ProgramExternalIdRelations,
} from './ProgramExternalId.ts';
import {
  ProgramGrouping,
  ProgramGroupingRelations,
} from './ProgramGrouping.ts';
import {
  ProgramGroupingExternalId,
  ProgramGroupingExternalIdRelations,
} from './ProgramGroupingExternalId.ts';
import {
  ProgramMediaFile,
  ProgramMediaFileRelations,
} from './ProgramMediaFile.ts';
import {
  ProgramMediaStream,
  ProgramMediaStreamRelations,
} from './ProgramMediaStream.ts';
import {
  ProgramSubtitles,
  ProgramSubtitlesRelations,
} from './ProgramSubtitles.ts';
import { ProgramVersion, ProgramVersionRelations } from './ProgramVersion.ts';
import { SmartCollection } from './SmartCollection.ts';
import { Studio, StudioEntity, StudioRelations } from './Studio.ts';

// export { Program } from './Program.ts';

export const schema = {
  channels: Channel,
  channelRelations: ChannelRelations,
  channelPrograms: ChannelPrograms,
  channelCustomShows: ChannelCustomShow,
  channelCustomShowRelations: ChannelCustomShowRelations,
  channelFillerShow: ChannelFillerShow,
  channelFillerShowRelations: ChannelFillerShowRelations,
  channelProgramRelations: ChannelProgramsRelations,
  customShow: CustomShow,
  customShowRelations: CustomShowRelations,
  customShowContent: CustomShowContent,
  customShowContentRelations: CustomShowContentRelations,
  fillerShows: FillerShow,
  fillerShowRelations: FillerShowRelations,
  fillerShowContent: FillerShowContent,
  fillerShowContentRelations: FillerShowContentRelations,
  program: Program,
  programVersion: ProgramVersion,
  programRelations: ProgramRelations,
  programVersionRelations: ProgramVersionRelations,
  programGrouping: ProgramGrouping,
  programGroupingRelations: ProgramGroupingRelations,
  programExternalId: ProgramExternalId,
  programExternalIdRelations: ProgramExternalIdRelations,
  programGroupingExternalId: ProgramGroupingExternalId,
  programGroupingExternalIdRelations: ProgramGroupingExternalIdRelations,
  programMediaStream: ProgramMediaStream,
  programMediaStreamRelations: ProgramMediaStreamRelations,
  programChapter: ProgramChapter,
  programChapterRelations: ProgramChapterRelations,
  mediaSource: MediaSource,
  mediaSourceRelations: MediaSourceRelations,
  mediaSourceLibrary: MediaSourceLibrary,
  mediaSourceLibraryRelations: MediaSourceLibraryRelations,
  mediaSourceLibraryReplacePath: MediaSourceLibraryReplacePath,
  mediaSourceLibraryReplacePathRelations:
    MediaSourceLibraryReplacePathRelations,
  localMediaSourcePath: LocalMediaSourcePath,
  localMediaSourcePathRelations: LocalMediaSourcePathRelations,
  localMediaFolder: LocalMediaFolder,
  localMediaFolderRelations: LocalMediaFolderRelations,
  programMediaFile: ProgramMediaFile,
  programMediaFileRelations: ProgramMediaFileRelations,
  artwork: Artwork,
  artworkRelations: ArtworkRelations,
  programSubtitles: ProgramSubtitles,
  programSubtitlesRelations: ProgramSubtitlesRelations,
  smartCollection: SmartCollection,
  credit: Credit,
  creditRelations: CreditRelations,
  genre: Genre,
  genreEntity: EntityGenre,
  genreRelations: GenreRelations,
  studio: Studio,
  studioEntity: StudioEntity,
  studioRelations: StudioRelations,
};

export type DrizzleDBAccess = BetterSQLite3Database<typeof schema>;
