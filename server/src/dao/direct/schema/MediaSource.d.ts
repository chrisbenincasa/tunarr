import { Selectable } from 'kysely';
import { Generated } from '../types.gen';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base';

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
