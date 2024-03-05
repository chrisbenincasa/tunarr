import { Migration } from '@mikro-orm/migrations';

export class Migration20240124115044 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `cached_image` (`hash` text not null, `url` text not null, `mime_type` text null, primary key (`hash`));');

    this.addSql('create table `channel` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `number` integer not null, `icon` json null, `guide_minimum_duration` integer not null, `disable_filler_overlay` integer not null default false, `name` text not null, `duration` integer not null, `stealth` integer not null default false, `group_title` text null, `start_time` integer not null, `offline` json null default \'{"mode":"clip"}\', `filler_repeat_cooldown` integer null, `watermark` json null, `transcoding` json null, primary key (`uuid`));');
    this.addSql('create unique index `channel_number_unique` on `channel` (`number`);');

    this.addSql('create table `custom_show` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `name` text not null, primary key (`uuid`));');

    this.addSql('create table `channel_custom_shows` (`channel_uuid` text not null, `custom_show_uuid` text not null, constraint `channel_custom_shows_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade, constraint `channel_custom_shows_custom_show_uuid_foreign` foreign key(`custom_show_uuid`) references `custom_show`(`uuid`) on delete cascade on update cascade, primary key (`channel_uuid`, `custom_show_uuid`));');
    this.addSql('create index `channel_custom_shows_channel_uuid_index` on `channel_custom_shows` (`channel_uuid`);');
    this.addSql('create index `channel_custom_shows_custom_show_uuid_index` on `channel_custom_shows` (`custom_show_uuid`);');

    this.addSql('create table `filler_show` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `name` text not null, primary key (`uuid`));');

    this.addSql('create table `channel_filler_show` (`channel_uuid` text not null, `filler_show_uuid` text not null, `weight` integer not null, `cooldown` integer not null, constraint `channel_filler_show_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on update cascade, constraint `channel_filler_show_filler_show_uuid_foreign` foreign key(`filler_show_uuid`) references `filler_show`(`uuid`) on update cascade, primary key (`channel_uuid`, `filler_show_uuid`));');
    this.addSql('create index `channel_filler_show_channel_uuid_index` on `channel_filler_show` (`channel_uuid`);');
    this.addSql('create index `channel_filler_show_filler_show_uuid_index` on `channel_filler_show` (`filler_show_uuid`);');

    this.addSql('create table `plex_server_settings` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `name` text not null, `uri` text not null, `access_token` text not null, `send_guide_updates` integer not null default true, `send_channel_updates` integer not null default true, `index` integer not null, primary key (`uuid`));');
    this.addSql('create unique index `plex_server_settings_name_uri_unique` on `plex_server_settings` (`name`, `uri`);');

    this.addSql('create table `program` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `source_type` text check (`source_type` in (\'plex\')) not null, `original_air_date` text null, `duration` integer not null, `episode` integer null, `episode_icon` text null, `file_path` text null, `icon` text null, `external_source_id` text not null, `external_key` text not null, `plex_rating_key` text null, `plex_file_path` text null, `parent_external_key` text null, `grandparent_external_key` text null, `rating` text null, `season` integer null, `season_icon` text null, `show_icon` text null, `show_title` text null, `summary` text null, `title` text not null, `type` text not null, `year` integer null, `custom_order` integer null, primary key (`uuid`));');
    this.addSql('create unique index `program_source_type_external_source_id_external_key_unique` on `program` (`source_type`, `external_source_id`, `external_key`);');

    this.addSql('create table `filler_show_content` (`filler_show_uuid` text not null, `program_uuid` text not null, constraint `filler_show_content_filler_show_uuid_foreign` foreign key(`filler_show_uuid`) references `filler_show`(`uuid`) on delete cascade on update cascade, constraint `filler_show_content_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on delete cascade on update cascade, primary key (`filler_show_uuid`, `program_uuid`));');
    this.addSql('create index `filler_show_content_filler_show_uuid_index` on `filler_show_content` (`filler_show_uuid`);');
    this.addSql('create index `filler_show_content_program_uuid_index` on `filler_show_content` (`program_uuid`);');

    this.addSql('create table `custom_show_content` (`custom_show_uuid` text not null, `content_uuid` text not null, `index` integer not null, constraint `custom_show_content_custom_show_uuid_foreign` foreign key(`custom_show_uuid`) references `custom_show`(`uuid`) on update cascade, constraint `custom_show_content_content_uuid_foreign` foreign key(`content_uuid`) references `program`(`uuid`) on update cascade, primary key (`custom_show_uuid`, `content_uuid`));');
    this.addSql('create index `custom_show_content_custom_show_uuid_index` on `custom_show_content` (`custom_show_uuid`);');
    this.addSql('create index `custom_show_content_content_uuid_index` on `custom_show_content` (`content_uuid`);');
    this.addSql('create unique index `custom_show_content_custom_show_uuid_content_uuid_index_unique` on `custom_show_content` (`custom_show_uuid`, `content_uuid`, `index`);');

    this.addSql('create table `channel_programs` (`channel_uuid` text not null, `program_uuid` text not null, constraint `channel_programs_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade, constraint `channel_programs_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on delete cascade on update cascade, primary key (`channel_uuid`, `program_uuid`));');
    this.addSql('create index `channel_programs_channel_uuid_index` on `channel_programs` (`channel_uuid`);');
    this.addSql('create index `channel_programs_program_uuid_index` on `channel_programs` (`program_uuid`);');

    this.addSql('create table `channel_fallback` (`channel_uuid` text not null, `program_uuid` text not null, constraint `channel_fallback_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade, constraint `channel_fallback_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on delete cascade on update cascade, primary key (`channel_uuid`, `program_uuid`));');
    this.addSql('create index `channel_fallback_channel_uuid_index` on `channel_fallback` (`channel_uuid`);');
    this.addSql('create index `channel_fallback_program_uuid_index` on `channel_fallback` (`program_uuid`);');
  }

}
