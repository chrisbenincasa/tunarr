import type { FileBackupOutput } from '@tunarr/types/schemas';
import type { ISettingsDB } from '../interfaces/ISettingsDB.ts';

export type SuccessfulBackupResult<T> = {
  type: 'success';
  data: T;
};

export type FailureBackupResult = {
  type: 'error';
};

export type BackupResult<T = void> =
  | SuccessfulBackupResult<T>
  | FailureBackupResult;

export abstract class DatabaseBackup<ResultType> {
  constructor(protected settings: ISettingsDB) {}

  abstract backup(config: FileBackupOutput): Promise<BackupResult<ResultType>>;
}
