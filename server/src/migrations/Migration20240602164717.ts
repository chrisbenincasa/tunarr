import { Migration } from '@mikro-orm/migrations';

export class Migration20240602164717 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'drop index if exists `program_external_id_program_uuid_uuid_source_type_external_source_id_unique`;',
    );

    this.addSql(
      'create unique index `unique_program_single_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NULL;',
    );

    this.addSql(
      'create unique index `unique_program_multiple_external_id` on `program_external_id` (`program_uuid`, `source_type`, `external_source_id`) WHERE `external_source_id` IS NOT NULL;',
    );
  }
}
