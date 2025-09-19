import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Channel } from './Channel.ts';
import {
  MediaSource,
  MediaSourceLibrary,
  MediaSourceLibraryRelations,
} from './MediaSource.ts';
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
  ProgramMediaStream,
  ProgramMediaStreamRelations,
} from './ProgramMediaStream.ts';
import { ProgramVersion, ProgramVersionRelations } from './ProgramVersion.ts';

// export { Program } from './Program.ts';

export const schema = {
  channels: Channel,
  program: Program,
  programVersion: ProgramVersion,
  programRelations: ProgramRelations,
  programVersionRelations: ProgramVersionRelations,
  programGrouping: ProgramGrouping,
  programGroupingRelations: ProgramGroupingRelations,
  programExternalId: ProgramExternalId,
  programExternalIdRelations: ProgramExternalIdRelations,
  programMediaStream: ProgramMediaStream,
  programMediaStreamRelations: ProgramMediaStreamRelations,
  programChapter: ProgramChapter,
  programChapterRelations: ProgramChapterRelations,
  mediaSource: MediaSource,
  mediaSourceLibrary: MediaSourceLibrary,
  mediaSourceLibraryRelations: MediaSourceLibraryRelations,
};

export type DrizzleDBAccess = BetterSQLite3Database<typeof schema>;
