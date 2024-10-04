import { Insertable, Selectable, Updateable } from 'kysely';
import { ProgramGroupingType } from '../../entities/ProgramGrouping';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base';

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
  type: `${ProgramGroupingType}`;
  year: number | null;
}

export type ProgramGrouping = Selectable<ProgramGroupingTable>;
export type NewProgramGrouping = Insertable<ProgramGroupingTable>;
export type ProgramGroupingUpdate = Updateable<ProgramGroupingTable>;
