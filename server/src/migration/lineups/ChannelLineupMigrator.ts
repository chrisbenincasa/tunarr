import { ChannelDB } from '@/db/ChannelDB.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import { RandomSlotDurationSpecMigration } from '@/migration/lineups/RandomSlotDurationSpecMigration.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { findIndex, map } from 'lodash-es';
import {
  CurrentLineupSchemaVersion,
  Lineup,
} from '../../db/derived_types/Lineup.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';
import { SlotShowIdMigration } from './SlotShowIdMigration.ts';

type MigrationFactory<From extends number, To extends number> = (
  channelDB: ChannelDB,
  programDB: ProgramDB,
) => ChannelLineupMigration<From, To>;

type MigrationStep<From extends number, To extends number> = [
  From,
  To,
  MigrationFactory<From, To>,
];

const MigrationSteps: MigrationStep<number, number>[] = [
  [0, 1, (cdb, pdb) => new SlotShowIdMigration(cdb, pdb)],
  [1, 2, (cdb, pdb) => new RandomSlotDurationSpecMigration(cdb, pdb)],
] as const;

type MigrationPipeline = [
  number,
  number,
  ChannelLineupMigration<number, number>,
][];

/**
 * One-way migrations for lineup JSON files.
 */
export class ChannelLineupMigrator {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  #migrationPipeline: MigrationPipeline;

  constructor(
    private channelDB: ChannelDB = new ChannelDB(),
    programDB: ProgramDB = new ProgramDB(),
  ) {
    this.#migrationPipeline = map(MigrationSteps, ([from, to, factory]) => [
      from,
      to,
      factory(channelDB, programDB),
    ]);
  }

  async run() {
    const lineups = await this.channelDB.loadAllLineupConfigs(true);
    for (const [channelId, { lineup }] of Object.entries(lineups)) {
      await this.runSingle(channelId, lineup);
    }
  }

  private async runSingle(channelId: string, lineup: Lineup): Promise<void> {
    const currVersion = lineup.version ?? 0;

    if (currVersion === CurrentLineupSchemaVersion) {
      this.#logger.debug(
        'Channel %s schema already on latest version (%d)',
        channelId,
        CurrentLineupSchemaVersion,
      );
      return;
    }

    let migrationIndex = findIndex(
      this.#migrationPipeline,
      ([from]) => from === currVersion,
    );

    if (migrationIndex === -1) {
      this.#logger.error(
        'Error determining which migration to start from for channel (id=%s)',
        channelId,
      );
      return;
    }

    try {
      while (
        lineup.version < CurrentLineupSchemaVersion &&
        migrationIndex < this.#migrationPipeline.length
      ) {
        const [, toVersion, migration] =
          this.#migrationPipeline[migrationIndex];
        await migration.migrate(lineup);
        lineup.version = toVersion;
        migrationIndex++;
      }

      await this.channelDB.saveLineup(channelId, lineup);
    } catch (e) {
      this.#logger.error(
        e,
        'Error while migrating channel lineup schema (id=%s)',
        channelId,
      );
    }
  }
}
