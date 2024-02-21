import { Migration } from '@mikro-orm/migrations';

export class Migration20240221201014 extends Migration {
  async up(): Promise<void> {
    this.addSql('ALTER TABLE `filler_show_content` DROP COLUMN `index`;');
    this.addSql(
      'ALTER TABLE `filler_show_content` ADD COLUMN `index` integer not null;',
    );
    this.addSql(
      'create unique index `filler_show_content_filler_show_uuid_program_uuid_index_unique` on `filler_show_content` (`filler_show_uuid`, `program_uuid`, `index`);',
    );
  }

  async down(): Promise<void> {
    this.addSql('ALTER TABLE `filler_show_content` DROP COLUMN `index`;');
    this.addSql(
      'ALTER TABLE `filler_show_content` ADD COLUMN `index` integer not null;',
    );
  }
}
