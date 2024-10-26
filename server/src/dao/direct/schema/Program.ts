import { createExternalId } from '@tunarr/shared';
import { Insertable, Selectable, Updateable } from 'kysely';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export interface ProgramTable extends WithCreatedAt, WithUpdatedAt, WithUuid {
  albumName: string | null;
  albumUuid: string | null;
  artistName: string | null;
  artistUuid: string | null;
  duration: number;
  episode: number | null;
  episodeIcon: string | null;
  externalKey: string;
  externalSourceId: string;
  filePath: string | null;
  grandparentExternalKey: string | null;
  icon: string | null;
  originalAirDate: string | null;
  parentExternalKey: string | null;
  plexFilePath: string | null;
  plexRatingKey: string | null;
  rating: string | null;
  seasonIcon: string | null;
  seasonNumber: number | null;
  seasonUuid: string | null;
  showIcon: string | null;
  showTitle: string | null;
  sourceType: 'plex' | 'jellyfin';
  summary: string | null;
  title: string;
  tvShowUuid: string | null;
  type: 'movie' | 'episode' | 'track';
  year: number | null;
}

export type Program = Selectable<ProgramTable>;
export type NewProgram = Insertable<ProgramTable>;
export type ProgramUpdate = Updateable<ProgramTable>;

export function programExternalIdString(p: Program | NewProgram) {
  return createExternalId(p.sourceType, p.externalSourceId, p.externalKey);
}
