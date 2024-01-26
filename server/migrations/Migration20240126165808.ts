import { Migration } from '@mikro-orm/migrations';

export class Migration20240126165808 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table `filler_show_content` add column `index` integer not null constraint `filler_show_content_filler_show_uuid_foreign` references `filler_show` (`uuid`) on update cascade constraint `filler_show_content_program_uuid_foreign` references `program` (`uuid`) on update cascade;',
    );
    this.addSql(
      'create unique index `filler_show_content_filler_show_uuid_program_uuid_index_unique` on `filler_show_content` (`filler_show_uuid`, `program_uuid`, `index`);',
    );

    // We're not going to add index values since these tables should be empty at the moment anyway
  }
}
