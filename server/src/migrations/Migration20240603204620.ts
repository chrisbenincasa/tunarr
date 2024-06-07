import { Migration } from '@mikro-orm/migrations';

export class Migration20240603204620 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create unique index if not exists `unique_program_multiple_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NOT NULL;',
    );
    this.addSql(
      'create unique index if not exists `unique_program_single_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NULL;',
    );
  }
}
