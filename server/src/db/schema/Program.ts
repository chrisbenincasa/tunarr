import { createExternalId } from '@tunarr/shared';
import { TupleToUnion } from '@tunarr/types';
import { Insertable, Selectable, Updateable } from 'kysely';
import { MediaSourceType } from './MediaSource.ts';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export const ProgramTypes = ['movie', 'episode', 'track'] as const;
export const ProgramType = {
  Movie: 'movie',
  Episode: 'episode',
  Track: 'track',
} as const;
export type ProgramType = TupleToUnion<typeof ProgramTypes>;

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
  sourceType: MediaSourceType;
  summary: string | null;
  title: string;
  tvShowUuid: string | null;
  type: ProgramType;
  year: number | null;
}

export type ProgramDao = Selectable<ProgramTable>;
export type NewProgramDao = Insertable<ProgramTable>;
export type ProgramDaoUpdate = Updateable<ProgramTable>;

export function programExternalIdString(p: ProgramDao | NewProgramDao) {
  return createExternalId(p.sourceType, p.externalSourceId, p.externalKey);
}
