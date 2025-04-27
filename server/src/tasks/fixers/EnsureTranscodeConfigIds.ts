import { defaultTranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { head, isEmpty, map, reject } from 'lodash-es';
import { DB } from '../../db/schema/db.ts';

@injectable()
export class EnsureTranscodeConfigIds extends Fixer {
  constructor(
    @inject(KEYS.Logger) protected logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const defaultConfigs = await this.db
      .selectFrom('transcodeConfig')
      .select('uuid')
      .where('isDefault', '=', 1)
      .execute();
    let defaultConfig = head(defaultConfigs);

    if (isEmpty(defaultConfigs)) {
      this.logger.warn('No default transcode config found! Creating one.');

      defaultConfig = { uuid: await this.createDefaultTranscodeConfig() };
    } else if (defaultConfigs.length > 1) {
      this.logger.debug(
        'Found multiple default transcode configs. Marking one as the default',
      );
      const toMarkNonDefault = reject(defaultConfigs, {
        uuid: defaultConfig!.uuid,
      });
      await this.db
        .updateTable('transcodeConfig')
        .set({
          isDefault: 0,
        })
        .where(
          'uuid',
          'in',
          toMarkNonDefault.map(({ uuid }) => uuid),
        )
        .execute();
    }

    const channelsMissingTranscodeId = await this.db
      .selectFrom('channel')
      .where('channel.transcodeConfigId', 'is', null)
      .selectAll()
      .execute();

    if (channelsMissingTranscodeId.length === 0) {
      return;
    }

    await this.db
      .updateTable('channel')
      .set({
        transcodeConfigId: defaultConfig!.uuid,
      })
      .where('channel.uuid', 'in', map(channelsMissingTranscodeId, 'uuid'))
      .execute();
  }

  private async createDefaultTranscodeConfig() {
    return (
      await this.db
        .insertInto('transcodeConfig')
        .values(defaultTranscodeConfig(true))
        .returning('uuid')
        .executeTakeFirstOrThrow()
    ).uuid;
  }
}
