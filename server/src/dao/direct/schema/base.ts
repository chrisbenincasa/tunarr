import { ChannelIconSchema } from '@tunarr/types/schemas';
import { ColumnType } from 'kysely';
import { z } from 'zod';

export interface WithCreatedAt {
  createdAt: ColumnType<number, number, never>;
}

export interface WithUpdatedAt {
  updatedAt: ColumnType<number, number, number | undefined>;
}

export interface WithUuid {
  uuid: string;
}

export type ProgramExternalIdSourceType =
  | 'plex'
  | 'plex-guid'
  | 'tmdb'
  | 'imdb'
  | 'tvdb'
  | 'jellyfin';

export type ChannelStreamMode = 'hls' | 'hls_slower';

// export const DefaultChannelIcon = ChannelIconSchema.parse({});

export type ChannelIcon = z.infer<typeof ChannelIconSchema>;
