import type { CachedImageTable } from './CachedImage.js';
import type {
  ChannelCustomShowsTable,
  ChannelFallbackTable,
  ChannelFillerShowTable,
  ChannelProgramsTable,
  ChannelTable,
} from './Channel.ts';
import type { CustomShowContentTable, CustomShowTable } from './CustomShow.js';
import type { FillerShowContentTable, FillerShowTable } from './FillerShow.js';
import type {
  MediaSourceLibraryTable,
  MediaSourceTable,
} from './MediaSource.ts';
import type { MikroOrmMigrationsTable } from './MikroOrmMigrations.js';
import type { ProgramTable } from './Program.ts';
import type { ProgramChapterTable } from './ProgramChapter.ts';
import type { ProgramExternalIdTable } from './ProgramExternalId.ts';
import type { ProgramGroupingTable } from './ProgramGrouping.ts';
import type { ProgramGroupingExternalIdTable } from './ProgramGroupingExternalId.ts';
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
  mediaSource: MediaSourceTable;
  mediaSourceLibrary: MediaSourceLibraryTable;
  program: ProgramTable;
  programChapter: ProgramChapterTable;
  programExternalId: ProgramExternalIdTable;
  programMediaStream: ProgramMediaStreamTable;
  programVersion: ProgramVersionTable;
  programGrouping: ProgramGroupingTable;
  programGroupingExternalId: ProgramGroupingExternalIdTable;
  transcodeConfig: TranscodeConfigTable;

  // Legacy migration table
  mikroOrmMigrations: MikroOrmMigrationsTable;
}
