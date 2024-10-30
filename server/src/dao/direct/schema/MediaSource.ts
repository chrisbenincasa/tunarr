import { TupleToUnion } from '@tunarr/types';
import { Generated, Insertable, Selectable } from 'kysely';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export const MediaSourceTypes = ['plex', 'jellyfin'] as const;
export const MediaSourceType: Record<string, MediaSourceType> = {
  PLEX: 'plex',
  JELLYFIN: 'jellyfin',
} as const;
export type MediaSourceType = TupleToUnion<typeof MediaSourceTypes>;

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
  type: MediaSourceType;
  uri: string;
}

export type MediaSource = Selectable<MediaSourceTable>;
export type NewMediaSource = Insertable<MediaSourceTable>;
