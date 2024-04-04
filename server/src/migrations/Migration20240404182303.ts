import { Migration } from '@mikro-orm/migrations';

export class Migration20240404182303 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `program_grouping` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `type` text not null, `title` text not null, `summary` text null, `icon` text null, `year` integer null, `index` integer null, `show_uuid` text null, `artist_uuid` text null, constraint `program_grouping_show_uuid_foreign` foreign key(`show_uuid`) references `program_grouping`(`uuid`) on delete set null on update cascade, constraint `program_grouping_artist_uuid_foreign` foreign key(`artist_uuid`) references `program_grouping`(`uuid`) on delete set null on update cascade, primary key (`uuid`));');
    this.addSql('create index `program_grouping_show_uuid_index` on `program_grouping` (`show_uuid`);');
    this.addSql('create index `program_grouping_artist_uuid_index` on `program_grouping` (`artist_uuid`);');

    this.addSql('create table `program_grouping_external_id` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `source_type` text check (`source_type` in (\'plex\')) not null, `external_source_id` text not null, `external_key` text not null, `external_file_path` text null, `group_uuid` text not null, constraint `program_grouping_external_id_group_uuid_foreign` foreign key(`group_uuid`) references `program_grouping`(`uuid`) on update cascade, primary key (`uuid`));');
    this.addSql('create index `program_grouping_external_id_group_uuid_index` on `program_grouping_external_id` (`group_uuid`);');
    this.addSql('create unique index `program_grouping_external_id_uuid_source_type_unique` on `program_grouping_external_id` (`uuid`, `source_type`);');

    this.addSql('alter table `program` add column `season_uuid` text null constraint `program_season_uuid_foreign` references `program_grouping` (`uuid`) on update cascade constraint `program_tv_show_uuid_foreign` references `program_grouping` (`uuid`) on update cascade constraint `program_album_uuid_foreign` references `program_grouping` (`uuid`) on update cascade constraint `program_artist_uuid_foreign` references `program_grouping` (`uuid`) on update cascade;');
    this.addSql('alter table `program` add column `tv_show_uuid` text null;');
    this.addSql('alter table `program` add column `album_uuid` text null;');
    this.addSql('alter table `program` add column `artist_uuid` text null;');
    this.addSql('create index `program_season_uuid_index` on `program` (`season_uuid`);');
    this.addSql('create index `program_tv_show_uuid_index` on `program` (`tv_show_uuid`);');
    this.addSql('create index `program_album_uuid_index` on `program` (`album_uuid`);');
    this.addSql('create index `program_artist_uuid_index` on `program` (`artist_uuid`);');
  }

}
