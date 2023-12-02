import { Generated, Selectable } from 'kysely';

export interface PlexServerSettingsTable {
  id: Generated<number>;
}

export type PlexServerSettings = Selectable<PlexServerSettingsTable>;
