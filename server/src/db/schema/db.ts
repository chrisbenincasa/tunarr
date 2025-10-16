import type { CachedImageTable } from './CachedImage.js';
import type { ChannelTable } from './Channel.ts';
import type { ChannelCustomShowsTable } from './ChannelCustomShow.ts';
import type { ChannelFallbackTable } from './ChannelFallback.ts';
import type { ChannelFillerShowTable } from './ChannelFillerShow.ts';
import type { ChannelProgramsTable } from './ChannelPrograms.ts';
import type { CustomShowTable } from './CustomShow.js';
import type { CustomShowContentTable } from './CustomShowContent.ts';
import type { FillerShowTable } from './FillerShow.js';
import type { FillerShowContentTable } from './FillerShowContent.ts';
import type { LocalMediaFolderTable } from './LocalMediaFolder.ts';
import type { LocalMediaSourcePathTable } from './LocalMediaSourcePath.ts';
import type { MediaSourceTable } from './MediaSource.ts';
import type { MediaSourceLibraryTable } from './MediaSourceLibrary.ts';
import type { MikroOrmMigrationsTable } from './MikroOrmMigrations.js';
import type { ProgramTable } from './Program.ts';
import type { ProgramChapterTable } from './ProgramChapter.ts';
import type { ProgramExternalIdTable } from './ProgramExternalId.ts';
import type { ProgramGroupingTable } from './ProgramGrouping.ts';
import type { ProgramGroupingExternalIdTable } from './ProgramGroupingExternalId.ts';
import type { ProgramMediaFileTable } from './ProgramMediaFile.ts';
import type { ProgramMediaStreamTable } from './ProgramMediaStream.ts';
import type { ProgramVersionTable } from './ProgramVersion.ts';
import type {
  ChannelSubtitlePreferencesTable,
  CustomShowSubtitlePreferencesTable,
} from './SubtitlePreferences.ts';
import type { TranscodeConfigTable } from './TranscodeConfig.ts';

export interface DB {
  cachedImage: CachedImageTable;
  channel: ChannelTable;
  channelPrograms: ChannelProgramsTable;
  channelSubtitlePreferences: ChannelSubtitlePreferencesTable;
  channelFallback: ChannelFallbackTable;
  channelCustomShows: ChannelCustomShowsTable;
  channelFillerShow: ChannelFillerShowTable;
  customShow: CustomShowTable;
  customShowContent: CustomShowContentTable;
  customShowSubtitlePreferences: CustomShowSubtitlePreferencesTable;
  fillerShow: FillerShowTable;
  fillerShowContent: FillerShowContentTable;
  localMediaSourcePath: LocalMediaSourcePathTable;
  localMediaFolder: LocalMediaFolderTable;
  mediaSource: MediaSourceTable;
  mediaSourceLibrary: MediaSourceLibraryTable;
  program: ProgramTable;
  programChapter: ProgramChapterTable;
  programExternalId: ProgramExternalIdTable;
  programMediaStream: ProgramMediaStreamTable;
  programMediaFile: ProgramMediaFileTable;
  programVersion: ProgramVersionTable;
  programGrouping: ProgramGroupingTable;
  programGroupingExternalId: ProgramGroupingExternalIdTable;
  transcodeConfig: TranscodeConfigTable;

  // Legacy migration table
  mikroOrmMigrations: MikroOrmMigrationsTable;
}
