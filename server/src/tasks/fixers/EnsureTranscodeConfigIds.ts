import { getDatabase } from '@/db/DBAccess.ts';
import Fixer from '@/tasks/fixers/fixer.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.ts';
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

    const defaultConfig = await getDatabase()
      .selectFrom('transcodeConfig')
      .selectAll()
      .where('isDefault', '=', 1)
      .limit(1)
      .executeTakeFirst();

    if (!defaultConfig) {
      EnsureTranscodeConfigIds.logger.error(
        'No default transcode config found!',
      );
      return;
    }

    await getDatabase()
      .updateTable('channel')
      .set({
        transcodeConfigId: defaultConfig.uuid,
      })
      .where('channel.uuid', 'in', map(channelsMissingTranscodeId, 'uuid'))
      .execute();
  }
}
