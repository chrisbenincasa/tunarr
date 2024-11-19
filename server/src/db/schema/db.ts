import type { CachedImageTable } from './CachedImage.js';
import {
  ChannelCustomShowsTable,
  ChannelFallbackTable,
  ChannelFillerShowTable,
  ChannelProgramsTable,
  ChannelTable,
} from './Channel.ts';
import type { CustomShowContentTable, CustomShowTable } from './CustomShow.js';
import type { FillerShowContentTable, FillerShowTable } from './FillerShow.js';
import type { MediaSourceTable } from './MediaSource.ts';
import { MikroOrmMigrationsTable } from './MikroOrmMigrations.js';
import { ProgramTable } from './Program.ts';
import type { ProgramExternalIdTable } from './ProgramExternalId.ts';
import type { ProgramGroupingTable } from './ProgramGrouping.ts';
import type { ProgramGroupingExternalIdTable } from './ProgramGroupingExternalId.ts';

export interface DB {
  cachedImage: CachedImageTable;
  channel: ChannelTable;
  channelPrograms: ChannelProgramsTable;
  channelFallback: ChannelFallbackTable;
  channelCustomShows: ChannelCustomShowsTable;
  channelFillerShow: ChannelFillerShowTable;
  customShow: CustomShowTable;
  customShowContent: CustomShowContentTable;
  fillerShow: FillerShowTable;
  fillerShowContent: FillerShowContentTable;
  mediaSource: MediaSourceTable;
  program: ProgramTable;
  programExternalId: ProgramExternalIdTable;
  programGrouping: ProgramGroupingTable;
  programGroupingExternalId: ProgramGroupingExternalIdTable;

  // Legacy migration table
  mikroOrmMigrations: MikroOrmMigrationsTable;
}
