import type { Maybe } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import type { Migrator } from 'kysely';
import { isNil, isUndefined } from 'lodash-es';

export async function isWrongMigrationDirection(
  name: Maybe<string>,
  expectedMigrationDiration: 'up' | 'down',
  migrator: Migrator,
) {
  if (!isNonEmptyString(name)) {
    return false;
  }

  const migrations = await migrator.getMigrations();

  return !isUndefined(
    migrations.find(
      (migration) =>
        migration.name === name &&
        ((expectedMigrationDiration === 'up' && !isNil(migration.executedAt)) ||
          (expectedMigrationDiration === 'down' &&
            isNil(migration.executedAt))),
    ),
  );
}
