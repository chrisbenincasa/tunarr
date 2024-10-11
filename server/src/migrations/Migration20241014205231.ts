import { Migration } from '@mikro-orm/migrations';

export class Migration20241014205231 extends Migration {

  async up(): Promise<void> {
    this.addSql('pragma foreign_keys = off;');
    this.addSql('PRAGMA defer_foreign_keys = ON;');
    this.addSql('create table `channel_filler_show__temp_alter` (`filler_show_uuid` text not null, `channel_uuid` text not null, `weight` integer not null, `cooldown` integer not null, constraint `channel_filler_show_filler_show_uuid_foreign` foreign key(`filler_show_uuid`) references `filler_show`(`uuid`) on update cascade, constraint `channel_filler_show_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade, primary key (`filler_show_uuid`, `channel_uuid`));');
    this.addSql('insert into `channel_filler_show__temp_alter` select * from `channel_filler_show`;');
    this.addSql('drop table `channel_filler_show`;');
    this.addSql('alter table `channel_filler_show__temp_alter` rename to `channel_filler_show`;');
    this.addSql('create index `channel_filler_show_filler_show_uuid_index` on `channel_filler_show` (`filler_show_uuid`);');
    this.addSql('create index `channel_filler_show_channel_uuid_index` on `channel_filler_show` (`channel_uuid`);');
    this.addSql('pragma foreign_keys = on;');
    this.addSql('PRAGMA defer_foreign_keys = OFF;');
  }

}
