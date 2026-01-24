import type { ArchiveDatabaseBackupFactory } from '@/db/backup/ArchiveDatabaseBackup.js';
import type { Tag } from '@tunarr/types';
import type { BackupConfiguration } from '@tunarr/types/schemas';
import { partition } from 'lodash-es';
import type { DeepReadonly } from 'ts-essentials';
import { autoFactoryKey } from '../types/inject.ts';
import type { TaskMetadata } from './Task.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

export type BackupTaskFactory = (
  config: DeepReadonly<BackupConfiguration>,
) => () => BackupTask;

@simpleTaskDef({
  description: 'Performs a backup of Tunarr data per user configuration',
  injectKey: autoFactoryKey(BackupTask),
})
export class BackupTask extends SimpleTask {
  static KEY = Symbol.for(BackupTask.name);
  public ID: string | Tag<typeof BackupTask.name, TaskMetadata> =
    BackupTask.name;

  constructor(
    private config: DeepReadonly<BackupConfiguration>,
    private dbBackupFactory: ArchiveDatabaseBackupFactory,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Skipping backup configuration which is disabled');
      return;
    }

    const [validOutputs, invalidOutputs] = partition(
      this.config.outputs,
      (output) => output.type === 'file',
    );

    if (invalidOutputs.length > 0) {
      this.logger.warn(
        'Found invalid backup output options: %O',
        invalidOutputs,
      );
    }

    if (validOutputs.length === 0) {
      this.logger.warn(
        'Found no valid backup output options in this configuration: %O',
        this.config,
      );
      return;
    }

    for (const output of validOutputs) {
      try {
        const result = await this.dbBackupFactory().backup(output);
        if (result.type === 'success') {
          this.logger.info('Successfully generated backup to %s', result.data);
        }
      } catch (e) {
        this.logger.error(e, 'Error creating backup');
      }
    }

    return;
  }
}
