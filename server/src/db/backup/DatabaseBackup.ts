import type { SettingsDB } from '@/db/SettingsDB.js';

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
  constructor(protected settings: SettingsDB) {}

  abstract backup(): Promise<BackupResult<ResultType>>;
}
