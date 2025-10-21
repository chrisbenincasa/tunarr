import { jsonSchema } from '@/types/schemas.js';
import { inject, interfaces } from 'inversify';
import { findIndex, isArray } from 'lodash-es';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CurrentLineupSchemaVersion } from '../../db/derived_types/Lineup.ts';
import { GlobalOptions } from '../../globals.ts';
import { PersistentChannelCache } from '../../stream/ChannelCache.ts';
import { KEYS } from '../../types/inject.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { parseIntOrNull } from '../../util/index.ts';
import { getFirstValue } from '../../util/json.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { JsonFileMigrator, MigrationStep } from '../JsonFileMigrator.ts';
import { ClearStreamPlayCacheMigration } from './ClearStreamPlayCacheMigration.ts';

const MigrationSteps: interfaces.ServiceIdentifier<MigrationStep>[] = [
  ClearStreamPlayCacheMigration,
];

const CurrentVersion = 1;

export class StreamCacheMigrator extends JsonFileMigrator<MigrationStep> {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.GlobalOptions) private opts: GlobalOptions,
    @inject(PersistentChannelCache)
    private channelCache: PersistentChannelCache,
  ) {
    super(MigrationSteps);
  }

  async run(): Promise<void> {
    const cachePath = path.join(
      this.opts.databaseDirectory,
      'stream-cache.json',
    );
    if (!(await fileExists(cachePath))) {
      return;
    }
    const rawCacheContents = await fs.readFile(cachePath);
    const parsed = jsonSchema.parse(
      JSON.parse(rawCacheContents.toString('utf-8')),
    );
    if (
      (typeof parsed !== 'object' && typeof parsed !== 'function') ||
      parsed === null ||
      isArray(parsed)
    ) {
      this.logger.warn(
        'Got invalid cache JSON: %s. Expected object.',
        JSON.stringify(parsed),
      );
      return;
    }

    const version = getFirstValue('$.version@number()', parsed, parseIntOrNull);
    let currVersion = version ?? 0;

    if (currVersion === CurrentVersion) {
      this.logger.debug(
        'Cache schema already at latest version: %d',
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
        'Error determining which migration to start from for stream cache',
      );
      return;
    }

    try {
      do {
        const migration = this.pipeline?.[migrationIndex];
        if (!migration) {
          break;
        }

        await migration.migrate(parsed);
        currVersion = migration.to;
        parsed['version'] = currVersion;
        migrationIndex++;
      } while (currVersion <= CurrentLineupSchemaVersion);

      await fs.writeFile(
        path.join(this.opts.databaseDirectory, 'stream-cache.json'),
        JSON.stringify(parsed),
      );

      await this.channelCache.init();

      this.logger.info(
        'Successfully migrated stream cache from version %d to %d',
        version ?? 0,
        currVersion,
      );
    } catch (e) {
      this.logger.error(e, 'Error while migrating stream cache schema');
    }
  }
}
