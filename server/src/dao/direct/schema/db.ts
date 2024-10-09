import { CachedImageTable } from './CachedImage';
import {
  ChannelCustomShowsTable,
  ChannelFallbackTable,
  ChannelFillerShowTable,
  ChannelProgramsTable,
  ChannelTable,
} from './Channel';
import { CustomShowContentTable, CustomShowTable } from './CustomShow';
import { FillerShowContentTable, FillerShowTable } from './FillerShow';
import { MediaSourceTable } from './MediaSource';
import { ProgramTable } from './Program';
import { ProgramExternalIdTable } from './ProgramExternalId';
import { ProgramGroupingTable } from './ProgramGrouping';
import { ProgramGroupingExternalIdTable } from './ProgramGroupingExternalId';

export * from './CachedImage';
export * from './Channel';
export * from './FillerShow';
export * from './MediaSource';
export * from './Program';
export * from './ProgramExternalId';
export * from './ProgramGrouping';
export * from './ProgramGroupingExternalId';

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
}
