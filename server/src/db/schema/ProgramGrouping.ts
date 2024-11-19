import { Insertable, Selectable, Updateable } from 'kysely';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export const ProgramGroupingType: Readonly<
  Record<Capitalize<ProgramGroupingType>, ProgramGroupingType>
> = {
  Show: 'show',
  Season: 'season',
  Artist: 'artist',
  Album: 'album',
} as const;
export type ProgramGroupingType = 'show' | 'season' | 'artist' | 'album';

export interface ProgramGroupingTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  artistUuid: string | null;
  icon: string | null;
  index: number | null;
  showUuid: string | null;
  summary: string | null;
  title: string;
  type: ProgramGroupingType;
  year: number | null;
}

export type ProgramGrouping = Selectable<ProgramGroupingTable>;
export type NewProgramGrouping = Insertable<ProgramGroupingTable>;
export type ProgramGroupingUpdate = Updateable<ProgramGroupingTable>;
