import { Generated } from 'kysely';

export interface MikroOrmMigrations {
  executedAt: Generated<number | null>;
  id: Generated<number>;
  name: string | null;
}
