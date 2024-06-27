import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface CachedImage {
  hash: string;
  mime_type: string | null;
  url: string;
}

export interface Channel {
  created_at: string | null;
  disable_filler_overlay: Generated<number>;
  duration: number;
  filler_repeat_cooldown: number | null;
  group_title: string | null;
  guide_flex_title: string | null;
  guide_minimum_duration: number;
  icon: string | null;
  name: string;
  number: number;
  offline: Generated<string | null>;
  start_time: number;
  stealth: Generated<number>;
  transcoding: string | null;
  updated_at: string | null;
  uuid: string;
  watermark: string | null;
}

export interface ChannelCustomShows {
  channel_uuid: string;
  custom_show_uuid: string;
}

export interface ChannelFallback {
  channel_uuid: string;
  program_uuid: string;
}

export interface ChannelFillerShow {
  channel_uuid: string;
  cooldown: number;
  filler_show_uuid: string;
  weight: number;
}

export interface ChannelPrograms {
  channel_uuid: string;
  program_uuid: string;
}

export interface CustomShow {
  created_at: string | null;
  name: string;
  updated_at: string | null;
  uuid: string;
}

export interface CustomShowContent {
  content_uuid: string;
  custom_show_uuid: string;
  index: number;
}

export interface FillerShow {
  created_at: string | null;
  name: string;
  updated_at: string | null;
  uuid: string;
}

export interface FillerShowContent {
  filler_show_uuid: string;
  index: number;
  program_uuid: string;
}

export interface MikroOrmMigrations {
  executed_at: Generated<string | null>;
  id: Generated<number>;
  name: string | null;
}

export interface PlexServerSettings {
  access_token: string;
  client_identifier: string | null;
  created_at: string | null;
  index: number;
  name: string;
  send_channel_updates: Generated<number>;
  send_guide_updates: Generated<number>;
  updated_at: string | null;
  uri: string;
  uuid: string;
}

export interface Program {
  album_name: string | null;
  album_uuid: string | null;
  artist_name: string | null;
  artist_uuid: string | null;
  created_at: string | null;
  duration: number;
  episode: number | null;
  episode_icon: string | null;
  external_key: string;
  external_source_id: string;
  file_path: string | null;
  grandparent_external_key: string | null;
  icon: string | null;
  original_air_date: string | null;
  parent_external_key: string | null;
  plex_file_path: string | null;
  plex_rating_key: string | null;
  rating: string | null;
  season_icon: string | null;
  season_number: number | null;
  season_uuid: string | null;
  show_icon: string | null;
  show_title: string | null;
  source_type: string;
  summary: string | null;
  title: string;
  tv_show_uuid: string | null;
  type: string;
  updated_at: string | null;
  uuid: string;
  year: number | null;
}

export interface ProgramExternalId {
  created_at: string | null;
  direct_file_path: string | null;
  external_file_path: string | null;
  external_key: string;
  external_source_id: string | null;
  program_uuid: string;
  source_type: string;
  updated_at: string | null;
  uuid: string;
}

export interface ProgramGrouping {
  artist_uuid: string | null;
  created_at: string | null;
  icon: string | null;
  index: number | null;
  show_uuid: string | null;
  summary: string | null;
  title: string;
  type: string;
  updated_at: string | null;
  uuid: string;
  year: number | null;
}

export interface ProgramGroupingExternalId {
  created_at: string | null;
  external_file_path: string | null;
  external_key: string;
  external_source_id: string;
  group_uuid: string;
  source_type: string;
  updated_at: string | null;
  uuid: string;
}

export interface DB {
  cached_image: CachedImage;
  channel: Channel;
  channel_custom_shows: ChannelCustomShows;
  channel_fallback: ChannelFallback;
  channel_filler_show: ChannelFillerShow;
  channel_programs: ChannelPrograms;
  custom_show: CustomShow;
  custom_show_content: CustomShowContent;
  filler_show: FillerShow;
  filler_show_content: FillerShowContent;
  mikro_orm_migrations: MikroOrmMigrations;
  plex_server_settings: PlexServerSettings;
  program: Program;
  program_external_id: ProgramExternalId;
  program_grouping: ProgramGrouping;
  program_grouping_external_id: ProgramGroupingExternalId;
}
