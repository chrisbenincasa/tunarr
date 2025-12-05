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
import Migration1758570688_AddLocalLibraries from './db/Migration1758570688_AddLocalLibraries.ts';
import Migration1758732083_FixLocalLibraryPath from './db/Migration1758732083_FixLocalLibraryPath.ts';
import Migration1758903045_FixLocalLibraryPathAgain from './db/Migration1758903045_FixLocalLibraryPathAgain.ts';
import Migration1759170884_AddArtworkAndMore from './db/Migration1759170884_AddArtworkAndMore.ts';
import Migration1759518565_AddProgramSubtitles from './db/Migration1759518565_AddProgramSubtitles.ts';
import Migration1760129429_AddProgramGroupingSourceType from './db/Migration1760129429_AddProgramGroupingSourceType.ts';
import Migration1760213210_AddMoreProgramGroupingFields from './db/Migration1760213210_AddMoreProgramGroupingFields.ts';
import Migration1760455673_UpdateForeignKeyCasacades from './db/Migration1760455673_UpdateForeignKeyCasacades.ts';
import Migration1762205138_AddCredits from './db/Migration1762205138_AddCredits.ts';
import Migration1762205207_ArtworkCachePathNullable from './db/Migration1762205207_ArtworkCachePathNullable.ts';
import Migration1763585155_AddProgramForeignKeys from './db/Migration1763585155_AddProgramForeignKeys.ts';
import Migration1763673215_MoreProgramForeignKeys from './db/Migration1763673215_MoreProgramForeignKeys.ts';
import Migration1763749592_AddProgramState from './db/Migration1763749592_AddProgramState.ts';
import Migration1764022266_AddCreditGroupingIndex from './db/Migration1764022266_AddCreditGroupingIndex.ts';
import Migration1764022464_AddArtworkIndexes from './db/Migration1764022464_AddArtworkIndexes.ts';
import { makeKyselyMigrationFromSqlFile } from './db/util.ts';

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
          migration1758570688: Migration1758570688_AddLocalLibraries,
          migration1758732083_FixLocalLibraryPath:
            Migration1758732083_FixLocalLibraryPath,
          migration1758903045_FixLocalLibraryPathAgain:
            Migration1758903045_FixLocalLibraryPathAgain,
          migration1759170884_AddArtworkAndMore:
            Migration1759170884_AddArtworkAndMore,
          migration1759518565_AddProgramSubtitles:
            Migration1759518565_AddProgramSubtitles,
          migration1760129429_AddProgramGroupingSourceType:
            Migration1760129429_AddProgramGroupingSourceType,
          migration1760213210_AddMoreProgramGroupingFields:
            Migration1760213210_AddMoreProgramGroupingFields,
          migration1760455673_UpdateForeignKeyCasacades:
            Migration1760455673_UpdateForeignKeyCasacades,
          migration1761309919_AddSmartCollections:
            makeKyselyMigrationFromSqlFile(
              './sql/0021_stormy_victor_mancha.sql',
            ),
          migration1762205138_AddCredits: Migration1762205138_AddCredits,
          migration1762205207_ArtworkCachePathNullable:
            Migration1762205207_ArtworkCachePathNullable,
          migration1763585155_AddProgramForeignKeys:
            Migration1763585155_AddProgramForeignKeys,
          migration1763673215_MoreProgramForeignKeys:
            Migration1763673215_MoreProgramForeignKeys,
          migration1763749592_AddProgramState:
            Migration1763749592_AddProgramState,
          migration1764022266_AddCreditGroupingIndex:
            Migration1764022266_AddCreditGroupingIndex,
          migration1764022464_AddArtworkIndexes:
            Migration1764022464_AddArtworkIndexes,
          migration1764695284_AddProgramGroupingMetadata:
            makeKyselyMigrationFromSqlFile('./sql/0029_hard_arachne.sql'),
          migration1764710105_AddGenreAndStudios:
            makeKyselyMigrationFromSqlFile('./sql/0030_redundant_glorian.sql'),
          migration1764773318: makeKyselyMigrationFromSqlFile(
            './sql/0031_bitter_dormammu.sql',
          ),
          // Add program grouping state,
          migration1764870206: makeKyselyMigrationFromSqlFile(
            './sql/0032_vengeful_network.sql',
          ),
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
