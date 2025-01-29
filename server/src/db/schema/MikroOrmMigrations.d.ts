import type { Generated, Selectable } from 'kysely';

export interface MikroOrmMigrationsTable {
  executedAt: Generated<number>; // Timestamp
  id: Generated<number>;
  name: string;
}

export type MikroOrmMigrations = Selectable<MikroOrmMigrationsTable>;
