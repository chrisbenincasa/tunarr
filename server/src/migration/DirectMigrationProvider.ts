import Migration1735044379_AddHlsDirect from '@/migration/db/Migration1735044379_AddHlsDirect.js';
import type { Migration, MigrationProvider } from 'kysely';
import { CompiledQuery } from 'kysely';
import { mapValues } from 'lodash-es';
import LegacyMigration0 from './db/LegacyMigration0.ts';
import LegacyMigration1 from './db/LegacyMigration1.ts';
import LegacyMigration10 from './db/LegacyMigration10.ts';
import LegacyMigration11 from './db/LegacyMigration11.ts';
import LegacyMigration12 from './db/LegacyMigration12.ts';
import LegacyMigration13 from './db/LegacyMigration13.ts';
import LegacyMigration14 from './db/LegacyMigration14.ts';
import LegacyMigration15 from './db/LegacyMigration15.ts';
import LegacyMigration16 from './db/LegacyMigration16.ts';
import LegacyMigration2 from './db/LegacyMigration2.ts';
import LegacyMigration3 from './db/LegacyMigration3.ts';
import LegacyMigration4 from './db/LegacyMigration4.ts';
import LegacyMigration5 from './db/LegacyMigration5.ts';
import LegacyMigration6 from './db/LegacyMigration6.ts';
import LegacyMigration7 from './db/LegacyMigration7.ts';
import LegacyMigration8 from './db/LegacyMigration8.ts';
import LegacyMigration9 from './db/LegacyMigration9.ts';
import Migration1730806741 from './db/Migration1730806741.ts';
import Migration1731982492 from './db/Migration1731982492.ts';
import Migration1732969335_AddTranscodeConfig from './db/Migration1732969335_AddTranscodeConfig.ts';
import Migration1738604866_AddEmby from './db/Migration1738604866_AddEmby.ts';
import Migration1740691984_ProgramMediaSourceId from './db/Migration1740691984_ProgramMediaSourceId.ts';
import Migration1741297998_AddProgramIndexes from './db/Migration1741297998_AddProgramIndexes.ts';
import Migration1741658292_MediaSourceIndex from './db/Migration1741658292_MediaSourceIndex.ts';
import Migration1744918641_AddMediaSourceUserInfo from './db/Migration1744918641_AddMediaSourceUserInfo.ts';
import Migration1745007030_ReaddMissingProgramExternalIdIndexes from './db/Migration1745007030_ReaddMissingProgramExternalIdIndexes.ts';
import Migration1746042667_AddSubtitles from './db/Migration1746042667_AddSubtitles.ts';
import Migration1746123876_ReworkSubtitleFilter from './db/Migration1746123876_ReworkSubtitleFilter.ts';
import Migration1746128022_FixSubtitlePriorityType from './db/Migration1746128022_FixSubtitlePriorityType.ts';
import Migration1748345299_AddMoreProgramTypes from './db/Migration1748345299_AddMoreProgramTypes.ts';
import Migration1756312561_InitialAdvancedTranscodeConfig from './db/Migration1756312561_InitialAdvancedTranscodeConfig.ts';
import Migration1756381281_AddLibraries from './db/Migration1756381281_AddLibraries.ts';
import Migration1757704591_AddProgramMediaSourceIndex from './db/Migration1757704591_AddProgramMediaSourceIndex.ts';
import Migration1758203109_AddProgramMedia from './db/Migration1758203109_AddProgramMedia.ts';

export const LegacyMigrationNameToNewMigrationName = [
  ['Migration20240124115044', '_Legacy_Migration00'],
  ['Migration20240126165808', '_Legacy_Migration01'],
  ['Migration20240221201014', '_Legacy_Migration02'],
  ['Migration20240308184352', '_Legacy_Migration03'],
  ['Migration20240319192121', '_Legacy_Migration04'],
  ['Migration20240404182303', '_Legacy_Migration05'],
  ['Migration20240411104034', '_Legacy_Migration06'],
  ['Migration20240416113447', '_Legacy_Migration07'],
  // I dont know why this is duped, but it is...
  // this is not a bug!
  ['Migration20240422195031', '_Legacy_Migration08'],
  ['Migration20240423195250', '_Legacy_Migration08_dupe'],
  ['Migration20240531155641', '_Legacy_Migration09'],
  // Started using names here
  ['Add new external ID types to program_external_id', '_Legacy_Migration10'],
  ['Program External ID partial indexes', '_Legacy_Migration11'],
  ['Force regenerate program_external_id table', '_Legacy_Migration12'],
  ['rename_plex_server_settings_table', '_Legacy_Migration13'],
  ['add_jellyfin_sources', '_Legacy_Migration14'],
  ['add_channel_stream_mode', '_Legacy_Migration15'],
  ['cascade_channel_filler_show_deletes', '_Legacy_Migration16'],
] as const;

export class DirectMigrationProvider implements MigrationProvider {
  // Kysely migrations are strictly run in alphanumeric asc order
  // We need to ensure migrations pre-kyesely (from mikro-orm)
  // are run FIRST and in the correct order, in order to have a smooth
  // transition away. Legacy migrations are thus prefixed with '_'
  // to ensure they are always run first
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve(
      mapValues(
        {
          _ALWAYS_FIRST: {
            async up(db) {
              await db.executeQuery(CompiledQuery.raw('select 1;'));
            },
          } satisfies Migration,
          _Legacy_Migration00: LegacyMigration0,
          _Legacy_Migration01: LegacyMigration1,
          _Legacy_Migration02: LegacyMigration2,
          _Legacy_Migration03: LegacyMigration3,
          _Legacy_Migration04: LegacyMigration4,
          _Legacy_Migration05: LegacyMigration5,
          _Legacy_Migration06: LegacyMigration6,
          _Legacy_Migration07: LegacyMigration7,
          _Legacy_Migration08: LegacyMigration8,
          _Legacy_Migration08_dupe: {
            async up() {
              // NO-OP
            },
          },
          _Legacy_Migration09: LegacyMigration9,
          _Legacy_Migration10: LegacyMigration10,
          _Legacy_Migration11: LegacyMigration11,
          _Legacy_Migration12: LegacyMigration12,
          _Legacy_Migration13: LegacyMigration13,
          _Legacy_Migration14: LegacyMigration14,
          _Legacy_Migration15: LegacyMigration15,
          _Legacy_Migration16: LegacyMigration16,
          migration1730806741: Migration1730806741,
          migration1731982492: Migration1731982492,
          migration1732969335: Migration1732969335_AddTranscodeConfig,
          migration1735044379: Migration1735044379_AddHlsDirect,
          migration1738604866: Migration1738604866_AddEmby,
          migration1740691984: Migration1740691984_ProgramMediaSourceId,
          migration1741297998: Migration1741297998_AddProgramIndexes,
          migration1741658292: Migration1741658292_MediaSourceIndex,
          migration1744918641: Migration1744918641_AddMediaSourceUserInfo,
          migration1745007030:
            Migration1745007030_ReaddMissingProgramExternalIdIndexes,

          migration1746042667: Migration1746042667_AddSubtitles,
          migration1746123876: Migration1746123876_ReworkSubtitleFilter,
          migration1746128022: Migration1746128022_FixSubtitlePriorityType,
          migration1748345299: Migration1748345299_AddMoreProgramTypes,
          migration1756312561:
            Migration1756312561_InitialAdvancedTranscodeConfig,
          migration1756381281: Migration1756381281_AddLibraries,
          migration1757704591: Migration1757704591_AddProgramMediaSourceIndex,
          migration1758203109: Migration1758203109_AddProgramMedia,
        },
        wrapWithTransaction,
      ),
    );
  }
}

function wrapWithTransaction(m: Migration): Migration {
  return {
    ...m,
    up(db) {
      return db.transaction().execute((tx) => {
        return m.up(tx);
      });
    },
    down(db) {
      return db.transaction().execute((tx) => {
        return m.down?.(tx) ?? Promise.resolve(void 0);
      });
    },
  } satisfies Migration;
}

export interface TunarrDatabaseMigration extends Migration {
  inPlace?: boolean;
  fullCopy?: boolean;
}
