import { Migration } from '@mikro-orm/migrations';

export class Migration20240123182500 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `custom_show_content` (`custom_show_uuid` text not null, `content_uuid` text not null, `index` integer not null, constraint `custom_show_content_custom_show_uuid_foreign` foreign key(`custom_show_uuid`) references `custom_show`(`uuid`) on update cascade, constraint `custom_show_content_content_uuid_foreign` foreign key(`content_uuid`) references `program`(`uuid`) on update cascade, primary key (`custom_show_uuid`, `content_uuid`));',
    );
    this.addSql(
      'create index `custom_show_content_custom_show_uuid_index` on `custom_show_content` (`custom_show_uuid`);',
    );
    this.addSql(
      'create index `custom_show_content_content_uuid_index` on `custom_show_content` (`content_uuid`);',
    );
    this.addSql(
      'create unique index `custom_show_content_custom_show_uuid_content_uuid_index_unique` on `custom_show_content` (`custom_show_uuid`, `content_uuid`, `index`);',
    );
  }
}
