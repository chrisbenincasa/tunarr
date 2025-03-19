import { transcodeConfigFromLegacySettings } from '@/db/schema/TranscodeConfig.js';
import Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { map } from 'lodash-es';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { DB } from '../../db/schema/db.ts';

@injectable()
export class EnsureTranscodeConfigIds extends Fixer {
  constructor(
    @inject(KEYS.Logger) protected logger: Logger,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(KEYS.Database) private db: Kysely<DB>,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const channelsMissingTranscodeId = await this.db
      .selectFrom('channel')
      .where('channel.transcodeConfigId', 'is', null)
      .selectAll()
      .execute();

    if (channelsMissingTranscodeId.length === 0) {
      return;
    }

    let defaultConfig = await this.db
      .selectFrom('transcodeConfig')
      .select('uuid')
      .where('isDefault', '=', 1)
      .limit(1)
      .executeTakeFirst();

    if (!defaultConfig) {
      this.logger.warn('No default transcode config found! Creating one.');

      defaultConfig = { uuid: await this.createDefaultTranscodeConfig() };
    }

    await this.db
      .updateTable('channel')
      .set({
        transcodeConfigId: defaultConfig.uuid,
      })
      .where('channel.uuid', 'in', map(channelsMissingTranscodeId, 'uuid'))
      .execute();
  }

  private async createDefaultTranscodeConfig() {
    return (
      await this.db
        .insertInto('transcodeConfig')
        .values(
          transcodeConfigFromLegacySettings(
            this.settingsDB.ffmpegSettings(),
            true,
          ),
        )
        .returning('uuid')
        .executeTakeFirstOrThrow()
    ).uuid;
  }
}
