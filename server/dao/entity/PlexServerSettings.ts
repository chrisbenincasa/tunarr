import { ColumnType, Insertable, Selectable } from 'kysely';

export interface PlexServerSettingsTable {
  id: string;
  name: string;
  uri: string;
  access_token: string;
  send_guide_updates: boolean;
  send_channel_updates: boolean;
  index: number;
  created_at: ColumnType<Date, string | undefined, never>;
  // updated_at: ColumnType<Date,
}

export type PlexServerSettings = Selectable<PlexServerSettingsTable>;
export type NewPlexServerSettings = Insertable<PlexServerSettingsTable>;
