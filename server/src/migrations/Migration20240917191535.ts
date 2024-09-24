import { Migration } from '@mikro-orm/migrations';

export class Migration20240917191535 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "alter table `channel` add column `stream_mode` text check (`stream_mode` in ('hls', 'hls_slower', 'mpegts')) not null default 'hls';",
    );
  }

  async down(): Promise<void> {
    this.addSql('alter table `channel` drop column `stream_mode`;');
  }
}
