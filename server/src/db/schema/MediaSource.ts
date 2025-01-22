import type { TupleToUnion } from '@tunarr/types';
import type { Generated, Insertable, Selectable } from 'kysely';
import type { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export const MediaSourceTypes = ['plex', 'jellyfin'] as const;

export type MediaSourceType = TupleToUnion<typeof MediaSourceTypes>;

type MediaSourceMap = {
  [k in Capitalize<(typeof MediaSourceTypes)[number]>]: Uncapitalize<k>;
};

export const MediaSourceType: MediaSourceMap = {
  Plex: 'plex',
  Jellyfin: 'jellyfin',
} as const;
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
