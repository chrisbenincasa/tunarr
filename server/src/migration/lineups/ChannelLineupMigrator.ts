import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { RandomSlotDurationSpecMigration } from '@/migration/lineups/RandomSlotDurationSpecMigration.js';
import { KEYS } from '@/types/inject.js';
import type { Json } from '@/types/schemas.js';
import { InjectLogger } from '@/util/inject.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import dayjs from 'dayjs';
import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { findIndex, isArray, isNumber, isString } from 'lodash-es';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LineupRepository } from '../../db/channel/LineupRepository.ts';
import {
  CurrentLineupSchemaVersion,
  LineupSchema,
} from '../../db/derived_types/Lineup.ts';
import { FileSystemService } from '../../services/FileSystemService.ts';
import { parseIntOrNull } from '../../util/index.ts';
import { getFirstValue } from '../../util/json.ts';
import { JsonFileMigrator } from '../JsonFileMigrator.ts';
import { AddSlotIdMigration } from './AddSlotIdMigration.ts';
import type { ChannelLineupMigration } from './ChannelLineupMigration.ts';
import { SlotProgrammingMigration } from './SlotProgrammingMigration.ts';
import { SlotShowIdMigration } from './SlotShowIdMigration.ts';

const MigrationSteps: ServiceIdentifier<
  ChannelLineupMigration<number, number>
>[] = [
  SlotShowIdMigration,
  RandomSlotDurationSpecMigration,
  SlotProgrammingMigration,
  AddSlotIdMigration,
];

/**
 * One-way migrations for lineup JSON files.
 */
@injectable()
export class ChannelLineupMigrator extends JsonFileMigrator<
  ChannelLineupMigration<number, number>
> {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
    @inject(LineupRepository) private lineupRepository: LineupRepository,
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

    const version = getFirstValue('$.version@number()', lineup, (value) => {
      if (isNumber(value)) {
        return value;
      } else if (!isString(value)) {
        return;
      }
      return parseIntOrNull(value);
    });
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
      this.pipeline,
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
        const migration = this.pipeline[migrationIndex];
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

      // Crazy run around - first ensure we have a proper schema
      // We have to save it directly to avoid a read out from Low
      // which may have an invalid schema still.
      const parseResult = LineupSchema.safeParse(lineup);
      if (!parseResult.success) {
        this.logger.error(
          parseResult.error,
          'ChannelLineupMigrator did not produce a valid schema. Database may be corrupt.',
        );
        throw parseResult.error;
      }

      await this.lineupRepository.saveChannelLineupDirect(
        channelId,
        parseResult.data,
      );

      await this.lineupRepository.getFileDb(channelId, true);
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
