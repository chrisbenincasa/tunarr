import { Tag } from '@tunarr/types';
import { BackupConfiguration } from '@tunarr/types/schemas';
import { partition } from 'lodash-es';
import { DeepReadonly } from 'ts-essentials';
import { ArchiveDatabaseBackup } from '../dao/backup/ArchiveDatabaseBackup.ts';
import { getSettings } from '../dao/settings.ts';
import { Task, TaskId } from './Task.ts';

export class BackupTask extends Task {
  public ID: string | Tag<TaskId, unknown> = BackupTask.name;

  constructor(private config: DeepReadonly<BackupConfiguration>) {
    super();
  }

  protected async runInternal(): Promise<unknown> {
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
        const result = await new ArchiveDatabaseBackup(
          getSettings(),
          output,
        ).backup();
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
