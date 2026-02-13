import { TranscodeConfig } from '@tunarr/types';
import { count, eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { head, omit, sumBy } from 'lodash-es';
import { v4 } from 'uuid';
import { TranscodeConfigNotFoundError, WrappedError } from '../types/errors.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { Maybe } from '../types/util.ts';
import { ITranscodeConfigDB } from './ITranscodeConfigDB.ts';
import { Channel } from './schema/Channel.ts';
import {
  defaultTranscodeConfig,
  NewTranscodeConfigOrm,
  TranscodeConfig as TranscodeConfigTable,
  type TranscodeConfigOrm,
} from './schema/TranscodeConfig.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class TranscodeConfigDB implements ITranscodeConfigDB {
  constructor(@inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess) {}

  async getAll(): Promise<TranscodeConfigOrm[]> {
    return await this.drizzle.query.transcodeConfigs.findMany();
  }

  async getById(id: string): Promise<Maybe<TranscodeConfigOrm>> {
    return await this.drizzle.query.transcodeConfigs.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
    });
  }

  async getDefaultConfig(): Promise<Maybe<TranscodeConfigOrm>> {
    return await this.drizzle.query.transcodeConfigs.findFirst({
      where: (fields, { eq }) => eq(fields.isDefault, true),
    });
  }

  async getChannelConfig(channelId: string): Promise<TranscodeConfigOrm> {
    const channelConfig = await this.drizzle.query.channels.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, channelId),
      with: {
        transcodeConfig: true,
      },
    });

    if (channelConfig) {
      return channelConfig.transcodeConfig;
    }

    const defaultConfig = await this.getDefaultConfig();
    if (!defaultConfig) {
      throw new Error('Bad state - no default transcode config');
    }

    return defaultConfig;
  }

  async insertConfig(
    config: Omit<TranscodeConfig, 'id'>,
  ): Promise<TranscodeConfigOrm> {
    const id = v4();
    const newConfig: NewTranscodeConfigOrm = {
      ...omit(config, 'id'),
      uuid: id,
    };

    return head(
      await this.drizzle
        .insert(TranscodeConfigTable)
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
        await this.drizzle
          .insert(TranscodeConfigTable)
          .values(baseConfig)
          .returning()
          .execute(),
      )!;
    });
  }

  async updateConfig(
    id: string,
    updatedConfig: TranscodeConfig,
  ): Promise<void> {
    await this.drizzle
      .update(TranscodeConfigTable)
      .set({
        ...omit(updatedConfig, 'id'),
      })
      .where(eq(TranscodeConfigTable.uuid, id));
  }

  async deleteConfig(id: string) {
    // A few cases to handle:
    // 1. if we are deleting the default configuration, we have to pick a new one.
    // 2. If we are deleting the last configuration, we have to create a default configuration
    // 3. We have to update all related channels.
    await this.drizzle.transaction(async (tx) => {
      const numConfigs = await tx
        .select({
          count: count(),
        })
        .from(TranscodeConfigTable)
        .then((results) => sumBy(results, (r) => r.count));

      // If there are no configs (should be impossible) create a default, assign it to all channels
      // and move on.
      if (numConfigs === 0) {
        const newDefaultConfigId = await this.insertDefaultConfiguration(tx);
        await tx
          .update(Channel)
          .set({ transcodeConfigId: newDefaultConfigId })
          .execute();
        return;
      }

      const configToDelete = await tx.query.transcodeConfigs.findFirst({
        where: (fields, { eq }) => eq(fields.uuid, id),
      });

      if (!configToDelete) {
        return;
      }

      // If this is the last config, we'll need a new one and will have to assign it
      if (numConfigs === 1) {
        const newDefaultConfigId = await this.insertDefaultConfiguration(tx);
        await tx
          .update(Channel)
          .set({ transcodeConfigId: newDefaultConfigId })
          .execute();
        await tx
          .delete(TranscodeConfigTable)
          .where(eq(TranscodeConfigTable.uuid, id))
          .limit(1)
          .execute();
        return;
      }

      let replacementId: string;
      if (configToDelete.isDefault) {
        const newDefaultConfig = (
          await tx
            .select({ uuid: TranscodeConfigTable.uuid })
            .from(TranscodeConfigTable)
            .where(eq(TranscodeConfigTable.isDefault, false))
            .limit(1)
        )[0]!;
        await tx
          .update(TranscodeConfigTable)
          .set({ isDefault: true })
          .where(eq(TranscodeConfigTable.uuid, newDefaultConfig.uuid));
        replacementId = newDefaultConfig.uuid;
      } else {
        const defaultId = (
          await tx
            .select({ uuid: TranscodeConfigTable.uuid })
            .from(TranscodeConfigTable)
            .where(eq(TranscodeConfigTable.isDefault, true))
            .limit(1)
        )[0]!;
        replacementId = defaultId.uuid;
      }

      await tx
        .update(Channel)
        .set({ transcodeConfigId: replacementId })
        .where(eq(Channel.transcodeConfigId, configToDelete.uuid))
        .execute();

      await tx
        .delete(TranscodeConfigTable)
        .where(eq(TranscodeConfigTable.uuid, id))
        .limit(1)
        .execute();
    });
  }

  private async insertDefaultConfiguration(db: DrizzleDBAccess = this.drizzle) {
    return head(
      await db
        .insert(TranscodeConfigTable)
        .values(defaultTranscodeConfig(true))
        .returning({ uuid: TranscodeConfigTable.uuid }),
    )!.uuid;
  }
}
