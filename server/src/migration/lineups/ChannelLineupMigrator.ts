import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { RandomSlotDurationSpecMigration } from '@/migration/lineups/RandomSlotDurationSpecMigration.js';
import { KEYS } from '@/types/inject.js';
import { Json } from '@/types/schemas.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import dayjs from 'dayjs';
import { inject, injectable, interfaces } from 'inversify';
import { findIndex, isArray } from 'lodash-es';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CurrentLineupSchemaVersion } from '../../db/derived_types/Lineup.ts';
import { FileSystemService } from '../../services/FileSystemService.ts';
import { parseIntOrNull } from '../../util/index.ts';
import { getFirstValue } from '../../util/json.ts';
import { JsonFileMigrator } from '../JsonFileMigrator.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';
import { SlotProgrammingMigration } from './SlotProgrammingMigration.ts';
import { SlotShowIdMigration } from './SlotShowIdMigration.ts';

const MigrationSteps: interfaces.ServiceIdentifier<
  ChannelLineupMigration<number, number>
>[] = [
  SlotShowIdMigration,
  RandomSlotDurationSpecMigration,
  SlotProgrammingMigration,
];

/**
 * One-way migrations for lineup JSON files.
 */
@injectable()
export class ChannelLineupMigrator extends JsonFileMigrator<
  ChannelLineupMigration<number, number>
> {
  #migrationPipeline: ChannelLineupMigration<number, number>[];

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
  ) {
    super(MigrationSteps);
  }

  async run() {
    const lineups = await this.channelDB.loadAllRawLineups();
    for (const [channelId, { lineup }] of Object.entries(lineups)) {
      await this.runSingle(channelId, lineup);
    }
  }

  private async runSingle(channelId: string, lineup: Json): Promise<void> {
    if (
      (typeof lineup !== 'object' && typeof lineup !== 'function') ||
      lineup === null ||
      isArray(lineup)
    ) {
      this.logger.warn(
        'Got invalid lineup JSON: %s. Expected object.',
        JSON.stringify(lineup),
      );
      return;
    }

    const version = getFirstValue('$.version@number()', lineup, parseIntOrNull);
    let currVersion = version ?? 0;

    if (currVersion === CurrentLineupSchemaVersion) {
      this.logger.debug(
        'Channel %s schema already on latest version (%d)',
        channelId,
        CurrentLineupSchemaVersion,
      );
      return;
    }

    let migrationIndex = findIndex(
      this.#migrationPipeline,
      ({ from }) => from === currVersion,
    );

    if (migrationIndex === -1) {
      this.logger.error(
        'Error determining which migration to start from for channel (id=%s)',
        channelId,
      );
      return;
    }

    try {
      do {
        const migration = this.#migrationPipeline?.[migrationIndex];
        if (!migration) {
          break;
        }

        const backupPath = path.join(
          this.fileSystemService.backupPath,
          `${channelId}_lineup_v${currVersion}_${+dayjs()}.json.bak`,
        );
        await fs.writeFile(backupPath, JSON.stringify(lineup));
        this.logger.debug(
          'Successfully wrote lineup file backup for channel %s to %s',
          channelId,
          backupPath,
        );

        await migration.migrate(lineup);
        currVersion = migration.to;
        lineup['version'] = currVersion;
        migrationIndex++;
      } while (currVersion <= CurrentLineupSchemaVersion);

      await this.channelDB.saveLineup(channelId, lineup);
      this.logger.info(
        'Successfully migrated channel %s from lineup version %d to %d',
        channelId,
        version ?? -1,
        currVersion,
      );
    } catch (e) {
      this.logger.error(
        e,
        'Error while migrating channel lineup schema (id=%s)',
        channelId,
      );
    }
  }
}
