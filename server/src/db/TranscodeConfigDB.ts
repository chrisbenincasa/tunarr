import { booleanToNumber } from '@/util/sqliteUtil.js';
import { Resolution, TranscodeConfig } from '@tunarr/types';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { head, omit } from 'lodash-es';
import { StrictOmit } from 'ts-essentials';
import { v4 } from 'uuid';
import { TranscodeConfigNotFoundError, WrappedError } from '../types/errors.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import {
  NewTranscodeConfig,
  NewTranscodeConfigOrm,
  TranscodeConfig as TranscodeConfigDAO,
  TranscodeConfigOrm,
} from './schema/TranscodeConfig.ts';
import { DB } from './schema/db.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class TranscodeConfigDB {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {}

  async getAll() {
    return await this.drizzleDB.query.transcodeConfigs.findMany();
  }

  async getById(id: string) {
    return await this.drizzleDB.query.transcodeConfigs.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
    });
  }

  async getDefaultConfig() {
    return await this.drizzleDB.query.transcodeConfigs.findFirst({
      where: (fields, { eq }) => eq(fields.isDefault, true),
    });
  }

  async getChannelConfig(channelId: string) {
    const result = await this.drizzleDB.query.channels.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, channelId),
      columns: {},
      with: {
        transcodeConfig: true,
      },
    });

    const channelConfig = result?.transcodeConfig;
    if (channelConfig) {
      return channelConfig;
    }

    const defaultConfig = await this.getDefaultConfig();
    if (!defaultConfig) {
      throw new Error(
        `Channel ID ${channelId} has no transcode config and there is no default!`,
      );
    }

    return defaultConfig;
  }

  async insertConfig(config: Omit<TranscodeConfig, 'id'>) {
    const id = v4();
    const newConfig: NewTranscodeConfigOrm = {
      ...omit(config, 'id'),
      uuid: id,
    };

    return head(
      await this.drizzleDB
        .insert(TranscodeConfigDAO)
        .values(newConfig)
        .returning(),
    )!;
  }

  async duplicateConfig(
    id: string,
  ): Promise<
    Result<TranscodeConfigOrm, TranscodeConfigNotFoundError | WrappedError>
  > {
    const baseConfig = await this.getById(id);
    if (!baseConfig) {
      return Result.failure(new TranscodeConfigNotFoundError(id));
    }

    const newId = v4();
    baseConfig.uuid = newId;
    baseConfig.isDefault = false;
    baseConfig.name = `${baseConfig.name} (copy)`;

    return Result.attemptAsync(async () => {
      return head(
        await this.drizzleDB
          .insert(TranscodeConfigDAO)
          .values(baseConfig)
          .returning(),
      )!;
    });
  }

  updateConfig(id: string, updatedConfig: TranscodeConfig) {
    const update: StrictOmit<NewTranscodeConfigOrm, 'uuid'> = {
      ...omit(updatedConfig, 'id'),
    };

    return this.drizzleDB
      .update(TranscodeConfigDAO)
      .set(update)
      .where(eq(TranscodeConfigDAO.uuid, id))
      .limit(1)
      .execute();
  }

  deleteConfig(id: string) {
    // A few cases to handle:
    // 1. if we are deleting the default configuration, we have to pick a new one.
    // 2. If we are deleting the last configuration, we have to create a default configuration
    // 3. We have to update all related channels.
    return this.db.transaction().execute(async (tx) => {
      const numConfigs = await tx
        .selectFrom('transcodeConfig')
        .select((eb) => eb.fn.count<number>('uuid').as('count'))
        .executeTakeFirst()
        .then((res) => res?.count ?? 0);

      // If there are no configs (should be impossible) create a default, assign it to all channels
      // and move on.
      if (numConfigs === 0) {
        const { uuid: newDefaultConfigId } =
          await this.insertDefaultConfiguration(tx);
        await tx
          .updateTable('channel')
          .set('transcodeConfigId', newDefaultConfigId)
          .execute();
        return;
      }

      const configToDelete = await tx
        .selectFrom('transcodeConfig')
        .where('uuid', '=', id)
        .selectAll()
        .limit(1)
        .executeTakeFirst();

      if (!configToDelete) {
        return;
      }

      // If this is the last config, we'll need a new one and will have to assign it
      if (numConfigs === 1) {
        const { uuid: newDefaultConfigId } =
          await this.insertDefaultConfiguration(tx);
        await tx
          .updateTable('channel')
          .set('transcodeConfigId', newDefaultConfigId)
          .execute();
        await tx
          .deleteFrom('transcodeConfig')
          .where('uuid', '=', id)
          .limit(1)
          .execute();
        return;
      }

      // We're deleting the default config. Pick a random one to make the new default. Not great!
      if (configToDelete.isDefault) {
        const newDefaultConfig = await tx
          .selectFrom('transcodeConfig')
          .where('uuid', '!=', id)
          .where('isDefault', '=', 0)
          .select('uuid')
          .limit(1)
          .executeTakeFirstOrThrow();
        await tx
          .updateTable('transcodeConfig')
          .set('isDefault', 1)
          .where('uuid', '=', newDefaultConfig.uuid)
          .limit(1)
          .execute();
        await tx
          .updateTable('channel')
          .set('transcodeConfigId', newDefaultConfig.uuid)
          .execute();
      }

      await tx
        .deleteFrom('transcodeConfig')
        .where('uuid', '=', id)
        .limit(1)
        .execute();
    });
  }

  private async insertDefaultConfiguration(db: Kysely<DB> = this.db) {
    return db
      .insertInto('transcodeConfig')
      .values(TranscodeConfigDB.createDefaultConfiguration())
      .returning('uuid as uuid')
      .executeTakeFirstOrThrow();
  }

  private static createDefaultConfiguration(): NewTranscodeConfig {
    const id = v4();
    return {
      uuid: id,
      name: 'Default Config',
      threadCount: 0,
      resolution: JSON.stringify({
        widthPx: 1920,
        heightPx: 1080,
      } satisfies Resolution),
      audioBitRate: 192,
      audioBufferSize: 192 * 3,
      audioChannels: 2,
      audioSampleRate: 48,
      audioFormat: 'aac',
      hardwareAccelerationMode: 'none',
      normalizeFrameRate: booleanToNumber(false),
      deinterlaceVideo: booleanToNumber(true),
      videoBitRate: 3500,
      videoBufferSize: 3500 * 2,
      videoFormat: 'h264',
      isDefault: booleanToNumber(true),
    };
  }
}
