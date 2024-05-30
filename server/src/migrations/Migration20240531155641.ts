import { Migration } from '@mikro-orm/migrations';

export class Migration20240531155641 extends Migration {
  async up(): Promise<void> {
    this.addSql('drop table if exists `program_external_id`;');
    this.addSql(
      'drop index if exists `program_external_id_program_uuid_index`;',
    );
    this.addSql(
      'drop index if exists `program_external_id_uuid_source_type_unique`;',
    );
    this.addSql(
      "create table `program_external_id` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `source_type` text check (`source_type` in ('plex', 'plex-guid')) not null, `external_source_id` text null, `external_key` text not null, `external_file_path` text null, `direct_file_path` text null, `program_uuid` text not null, constraint `program_external_id_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on update cascade, primary key (`uuid`));",
    );
    this.addSql(
      'create index `program_external_id_program_uuid_index` on `program_external_id` (`program_uuid`);',
    );
    this.addSql(
      'create unique index `program_external_id_uuid_source_type_unique` on `program_external_id` (`uuid`, `source_type`);',
    );
  }
}
