import type { ArchiveDatabaseBackup } from '@/db/backup/ArchiveDatabaseBackup.js';
import type { BackupConfiguration } from '@tunarr/types/schemas';
import type { DeepReadonly } from 'ts-essentials';
import { setTestGlobalOptions } from '../testing/getFakeSettingsDb.ts';
import { BackupTask } from './BackupTask.ts';

beforeAll(async () => {
  await setTestGlobalOptions();
});

const config: DeepReadonly<BackupConfiguration> = {
  enabled: true,
  schedule: { type: 'every', increment: 1, unit: 'day', offsetMs: 0 },
  outputs: [
    {
      type: 'file',
      outputPath: '/tmp/tunarr-backup-test',
      archiveFormat: 'tar',
      maxBackups: 3,
    },
  ],
};

const backupReturning =
  (result: Awaited<ReturnType<ArchiveDatabaseBackup['backup']>>) => () =>
    ({
      backup: () => Promise.resolve(result),
    }) as unknown as ArchiveDatabaseBackup;

test('succeeds when the backup was written', async () => {
  const task = new BackupTask(
    config,
    backupReturning({ type: 'success', data: '/tmp/backup.tar' }),
  );

  const result = await task.run({});

  expect(result.isSuccess()).toBe(true);
});

test('fails when the backup could not be written', async () => {
  const task = new BackupTask(config, backupReturning({ type: 'error' }));

  const result = await task.run({});

  expect(result.isSuccess()).toBe(false);
});
