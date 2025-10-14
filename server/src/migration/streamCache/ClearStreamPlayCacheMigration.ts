import { injectable } from 'inversify';
import { JsonObject } from '../../types/schemas.ts';
import { MigrationStep } from '../JsonFileMigrator.ts';

@injectable()
export class ClearStreamPlayCacheMigration implements MigrationStep {
  from: number = 0;
  to = 1;

  migrate(input: JsonObject): Promise<void> {
    delete input['streamPlayCache'];
    return Promise.resolve(void 0);
  }
}
