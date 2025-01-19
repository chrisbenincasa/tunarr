import { getDatabase } from '@/db/DBAccess.js';
import { getSettings } from '@/db/SettingsDB.js';
import { transcodeConfigFromLegacySettings } from '@/db/schema/TranscodeConfig.js';
import Fixer from '@/tasks/fixers/fixer.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { map } from 'lodash-es';

export class EnsureTranscodeConfigIds extends Fixer {
  private static logger = LoggerFactory.child({
    className: EnsureTranscodeConfigIds.name,
  });

  constructor() {
    super();
  }

  protected async runInternal(): Promise<void> {
    const channelsMissingTranscodeId = await getDatabase()
      .selectFrom('channel')
      .where('channel.transcodeConfigId', 'is', null)
      .selectAll()
      .execute();

    if (channelsMissingTranscodeId.length === 0) {
      return;
    }

    let defaultConfig = await getDatabase()
      .selectFrom('transcodeConfig')
      .select('uuid')
      .where('isDefault', '=', 1)
      .limit(1)
      .executeTakeFirst();

    if (!defaultConfig) {
      EnsureTranscodeConfigIds.logger.warn(
        'No default transcode config found! Creating one.',
      );

      defaultConfig = { uuid: await this.createDefaultTranscodeConfig() };
    }

    await getDatabase()
      .updateTable('channel')
      .set({
        transcodeConfigId: defaultConfig.uuid,
      })
      .where('channel.uuid', 'in', map(channelsMissingTranscodeId, 'uuid'))
      .execute();
  }

  private async createDefaultTranscodeConfig() {
    return (
      await getDatabase()
        .insertInto('transcodeConfig')
        .values(
          transcodeConfigFromLegacySettings(
            getSettings().ffmpegSettings(),
            true,
          ),
        )
        .returning('uuid')
        .executeTakeFirstOrThrow()
    ).uuid;
  }
}
