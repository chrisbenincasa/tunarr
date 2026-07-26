import type { RunResult } from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { Artwork, ArtworkRelations } from './Artwork.ts';
import { Channel, ChannelRelations } from './Channel.ts';

import {
  ChannelFallback,
  ChannelFallbackRelations,
} from './ChannelFallback.ts';
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
import {
  ExternalCollection,
  ExternalCollectionProgramRelations,
  ExternalCollectionPrograms,
  ExternalCollectionRelations,
} from './ExternalCollection.ts';
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
import {
  ProgramExtra,
  ProgramExtraRelations,
} from './ProgramExtra.ts';
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
  ProgramPlayHistory,
  ProgramPlayHistoryRelations,
} from './ProgramPlayHistory.ts';
import {
  ProgramSubtitles,
  ProgramSubtitlesRelations,
} from './ProgramSubtitles.ts';
import { ProgramVersion, ProgramVersionRelations } from './ProgramVersion.ts';
import { SmartCollection } from './SmartCollection.ts';
import { Studio, StudioEntity, StudioRelations } from './Studio.ts';
import {
  Tag,
  TagJoinRelationSchema,
  TagRelations,
  TagRelationSchema,
} from './Tag.ts';
import { StreamSelectionProfile } from './StreamSelectionProfile.ts';
import { TranscodeConfig } from './TranscodeConfig.ts';

// export { Program } from './Program.ts';

export const schema = {
  channels: Channel,
  channelRelations: ChannelRelations,
  channelPrograms: ChannelPrograms,
  channelFallback: ChannelFallback,
  channelFallbackRelations: ChannelFallbackRelations,
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
  programPlayHistory: ProgramPlayHistory,
  programPlayHistoryRelations: ProgramPlayHistoryRelations,
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
  programExtra: ProgramExtra,
  programExtraRelations: ProgramExtraRelations,
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
  externalCollections: ExternalCollection,
  externalCollectionPrograms: ExternalCollectionPrograms,
  externalCollectionRelations: ExternalCollectionRelations,
  externalCollectionProgramRelations: ExternalCollectionProgramRelations,
  tags: Tag,
  tagRelations: TagJoinRelationSchema,
  tagJoin: TagRelations,
  tagJoinRelations: TagRelationSchema,
  transcodeConfigs: TranscodeConfig,
  streamSelectionProfiles: StreamSelectionProfile,
};

export type DrizzleDBAccess = BetterSQLite3Database<typeof schema>;
export type BaseDrizzleDBAccess = BaseSQLiteDatabase<
  'sync',
  RunResult,
  typeof schema
>;
