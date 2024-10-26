import type { CachedImageTable } from './CachedImage.d.ts';
import {
  ChannelCustomShowsTable,
  ChannelFallbackTable,
  ChannelFillerShowTable,
  ChannelProgramsTable,
  ChannelTable,
} from './Channel.ts';
import type {
  CustomShowContentTable,
  CustomShowTable,
} from './CustomShow.d.ts';
import type {
  FillerShowContentTable,
  FillerShowTable,
} from './FillerShow.d.ts';
import type { MediaSourceTable } from './MediaSource.d.ts';
import { ProgramTable } from './Program.ts';
import type { ProgramExternalIdTable } from './ProgramExternalId.d.ts';
import type { ProgramGroupingTable } from './ProgramGrouping.d.ts';
import type { ProgramGroupingExternalIdTable } from './ProgramGroupingExternalId.d.ts';

export type * from './CachedImage.d.ts';
export type * from './Channel.d.ts';
export type * from './FillerShow.d.ts';
export type * from './MediaSource.d.ts';
export type * from './Program.d.ts';
export type * from './ProgramExternalId.d.ts';
export type * from './ProgramGrouping.d.ts';
export type * from './ProgramGroupingExternalId.d.ts';

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
