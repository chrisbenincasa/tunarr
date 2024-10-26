import { Generated, Selectable } from 'kysely';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export interface MediaSourceTable
  extends WithUpdatedAt,
    WithUuid,
    WithCreatedAt {
  accessToken: string;
  clientIdentifier: string | null;
  index: number;
  name: string;
  sendChannelUpdates: Generated<number>;
  sendGuideUpdates: Generated<number>;
  type: 'plex' | 'jellyfin';
  uri: string;
}

export type MediaSource = Selectable<MediaSourceTable>;
